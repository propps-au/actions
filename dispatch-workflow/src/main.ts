import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import * as z from "zod";

const StateSchema = z.enum([
  "error",
  "inactive",
  "failure",
  "in_progress",
  "queued",
  "pending",
  "success",
]);

async function run() {
  try {
    const octokit = getOctokit(core.getInput("token", { required: true }), {});

    const { data } = await octokit.actions.listRepoWorkflows({
      ...context.repo,
    });

    const specifiers = core.getInput("workflow", { required: true }).split(",");

    for (const specifier of specifiers) {
      const workflow = data.workflows.find(
        (workflow) =>
          workflow.path === ".github/workflows/" + specifier + ".yml"
      );

      if (!workflow) {
        core.setFailed(
          'Could not find a workflow in the repository matching the specifier "' +
            specifier +
            '".'
        );
        return;
      }

      await octokit.actions.createWorkflowDispatch({
        ...context.repo,
        ref: core.getInput("workflow-ref", { required: true }),
        workflow_id: workflow.id,
        inputs: core.getInput("inputs")
          ? JSON.parse(core.getInput("inputs"))
          : {},
      });

      core.info("Dispatched workflow " + workflow.name);
    }
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
