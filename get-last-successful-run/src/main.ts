import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import execa from "execa";

async function run() {
  try {
    const token = core.getInput("token", { required: true });

    const octokit = getOctokit(token);

    const res1 = await octokit.actions.getWorkflowRun({
      ...context.repo,
      run_id: context.runId,
    });

    core.info("Finding most recent successful workflow run for this workflow.");

    const workflowRun = await findLatestSuccessfulWorkflowRunInHistory(
      octokit,
      res1.data.workflow_id
    );

    if (workflowRun) {
      core.info(
        "Found run " + workflowRun.id + " on commit " + workflowRun.head_sha
      );
    } else {
      core.info("None found. Output null.");
    }

    core.setOutput("run", workflowRun);
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();

async function findLatestSuccessfulWorkflowRunInHistory(
  octokit: Octokit,
  workflowId: number
): Promise<WorkflowRun | null> {
  const { stdout: branch } = await execa("git", ["branch", "--show-current"]);

  let page = 0;
  let limit = 100;

  let res: ListWorkflowRunsResult;
  do {
    // assumes these are listed from most recent to least
    res = await octokit.actions.listWorkflowRuns({
      workflow_id: workflowId,
      ...context.repo,
      status: "success" as any,
      branch,
      per_page: limit,
      page,
    });

    for (const workflowRun of res.data.workflow_runs) {
      const sha = workflowRun.head_sha;
      core.info("Check " + sha);
      try {
        // only accept commits that are ancestors of this one
        await execa("git", ["merge-base", "--is-ancestor", sha, "HEAD"]);
        return workflowRun;
      } catch (err) {
        if (err.exitCode === 128) {
          // commit not found
        } else {
          throw err;
        }
      }
    }

    page++;
  } while (page * limit < res.data.total_count);

  return null;
}

type UnwrapPromise<T> = T extends Promise<infer U> ? U : never;
type UnwrapArray<T> = T extends Array<infer U> ? U : never;
type Octokit = ReturnType<typeof getOctokit>;
type ListWorkflowRunsResult = UnwrapPromise<
  ReturnType<Octokit["actions"]["listWorkflowRuns"]>
>;
type WorkflowRun = UnwrapArray<ListWorkflowRunsResult["data"]["workflow_runs"]>;
