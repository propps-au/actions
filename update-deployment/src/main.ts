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
    const octokit = getOctokit(core.getInput("token", { required: true }), {
      previews: ["ant-man", "flash"],
    });

    const state = StateSchema.parse(core.getInput("state", { required: true }));

    const deployment = JSON.parse(
      core.getInput("deployment", { required: true })
    ) as { id: number };

    const res1 = await octokit.repos.createDeploymentStatus({
      ...context.repo,
      deployment_id: deployment.id,
      log_url: `https://github.com/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}`,
      state,
      auto_inactive: true,
    });
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
