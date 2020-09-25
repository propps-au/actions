import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";

async function run() {
  try {
    const octokit = getOctokit(core.getInput("token", { required: true }), {
      previews: ["ant-man", "flash"],
    });

    const res1 = await octokit.repos.createDeployment({
      ...context.repo,
      ref: core.getInput("ref", { required: true }),
      environment: core.getInput("environment", { required: true }),
      auto_merge: false,
      production_environment: !!core
        .getInput("environment", { required: true })
        .match(/production/i),
    });

    if ("id" in res1.data) {
      core.saveState("deployment-id", res1.data.id);
    } else {
      throw new Error(res1.data.message);
    }
    core.setOutput("deployment", { id: res1.data.id });
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
