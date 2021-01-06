import * as core from "@actions/core";
import { getPluginConfiguration } from "@yarnpkg/cli";
import yarn from "@yarnpkg/core";
import { ppath } from "@yarnpkg/fslib";
import { getChangedFilesForRoots } from "jest-changed-files";

async function run() {
  try {
    const cwd = ppath.cwd();
    const plugins = getPluginConfiguration();
    const configuration = await yarn.Configuration.find(cwd, plugins);
    const cache = await yarn.Cache.find(configuration);

    const { project } = await yarn.Project.find(configuration, cwd);

    await project.resolveEverything({ report: new yarn.ThrowReport(), cache });

    const { changedFiles: changedFilesSet } = await getChangedFilesForRoots(
      [project.cwd],
      {
        changedSince: core.getInput("since", { required: true }),
      }
    );
    const changedFiles = Array.from(changedFilesSet);

    const changedWorkspaces = project.workspaces.filter((workspace) =>
      changedFiles.some((filename) => filename.startsWith(workspace.cwd))
    );

    const result = changedWorkspaces
      .map((workspace) => getWorkspacePackageName(workspace))
      .filter((item) => !!item.trim());

    core.info(result.join(" "));
    core.setOutput("changed-workspaces", result);
  } catch (err) {
    core.setFailed(err.message);
  }
}

run();

function getWorkspacePackageName(workspace: yarn.Workspace) {
  return (
    (workspace.manifest.name?.scope
      ? "@" + workspace.manifest.name.scope + "/"
      : "") + (workspace.manifest.name?.name ?? "")
  );
}
