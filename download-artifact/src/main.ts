import * as core from "@actions/core";
import { context, getOctokit } from "@actions/github";
import AdmZip from "adm-zip";
import path from "path";

async function run() {
  try {
    const octokit = getOctokit(core.getInput("token", { required: true }));

    const {
      data: { artifacts },
    } = await octokit.actions.listWorkflowRunArtifacts({
      ...context.repo,
      run_id: parseInt(core.getInput("run_id", { required: true })),
    });

    const artifact = artifacts.find(
      (artifact) =>
        artifact.name === core.getInput("artifact", { required: true })
    );

    if (!artifact) {
      core.setFailed(
        "Unable to find artifact " +
          core.getInput("artifact", { required: true }) +
          " in workflow run " +
          core.getInput("run_id", { required: true })
      );
      return;
    }

    const { data: file } = await octokit.actions.downloadArtifact({
      ...context.repo,
      artifact_id: artifact.id,
      archive_format: "zip",
    });

    const zip = new AdmZip(Buffer.from(file));

    for (const entry of zip.getEntries()) {
      console.log(path.join(core.getInput("path"), entry.entryName));
    }

    zip.extractAllTo(core.getInput("path"), true);
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();
