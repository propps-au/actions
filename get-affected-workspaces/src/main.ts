import * as core from "@actions/core";
import { getPluginConfiguration } from "@yarnpkg/cli";
import yarn from "@yarnpkg/core";
import { ppath } from "@yarnpkg/fslib";

async function run() {
  try {
    const includeDependencies =
      !core.getInput("include-dependencies") ||
      core.getInput("include-dependencies") !== "false";

    const cwd = ppath.cwd();
    const plugins = getPluginConfiguration();
    const configuration = await yarn.Configuration.find(cwd, plugins);
    const cache = await yarn.Cache.find(configuration);

    const { project } = await yarn.Project.find(configuration, cwd);

    await project.resolveEverything({ report: new yarn.ThrowReport(), cache });

    const changedWorkspaces = core
      .getInput("workspaces", { required: true })
      .split(" ")
      .map((packageName) => {
        let workspace = project.workspaces.find(
          (item) => getWorkspacePackageName(item) === packageName
        );

        if (!workspace) {
          core.setFailed(
            "There is no workspace with the package name " + packageName
          );
          process.exit(1);
        }

        return workspace;
      });

    const changedWorkspacesSet = new Set(changedWorkspaces);

    const dependentWorkspaces = getDependentWorkspacesRecursive(
      changedWorkspacesSet,
      project
    );

    const dependencies = getWorkspaceDependenciesRecursive(
      mergeSets(changedWorkspacesSet, dependentWorkspaces),
      project
    );

    const result = Array.from(
      new Set([
        ...changedWorkspacesSet,
        ...dependentWorkspaces,
        ...(includeDependencies ? dependencies : []),
      ])
    );

    core.setOutput("affected-workspaces", result);
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

function getDependentWorkspacesRecursive(
  leafDependencies: yarn.Workspace | Set<yarn.Workspace>,
  project: yarn.Project
) {
  const dependentWorkspaceIdents = new Set<string>();
  const traceDependents = (dependency: yarn.Workspace) => {
    const dependents = project.workspaces.filter((item) => {
      return item.dependencies.get(dependency.locator.identHash);
    });

    for (const dependent of dependents) {
      if (!dependentWorkspaceIdents.has(dependent.locator.identHash)) {
        dependentWorkspaceIdents.add(dependent.locator.identHash);
        traceDependents(dependent);
      }
    }
  };

  for (const dependency of toSet(leafDependencies)) {
    traceDependents(dependency);
  }

  const dependentWorkspaces = new Set<yarn.Workspace>();
  for (const identHash of dependentWorkspaceIdents) {
    dependentWorkspaces.add(
      project.workspacesByIdent.get(identHash as yarn.IdentHash)!
    );
  }

  return dependentWorkspaces;
}

const getWorkspaceDependenciesRecursive = (
  rootWorkspaces: yarn.Workspace | Set<yarn.Workspace>,
  project: yarn.Project
): Set<yarn.Workspace> => {
  const workspaceList = new Set<yarn.Workspace>();

  const visitWorkspace = (workspace: yarn.Workspace) => {
    const dependencies = new Map([
      ...workspace.manifest.dependencies,
      ...workspace.manifest.devDependencies,
    ]);
    for (const descriptor of dependencies.values()) {
      const foundWorkspace = project.tryWorkspaceByDescriptor(descriptor);
      if (foundWorkspace !== null && !workspaceList.has(foundWorkspace)) {
        workspaceList.add(foundWorkspace);
        visitWorkspace(foundWorkspace);
      }
    }
  };

  for (const rootWorkspace of toSet(rootWorkspaces)) {
    visitWorkspace(rootWorkspace);
  }

  return workspaceList;
};

function toSet<T>(value: T | Set<T>): Set<T> {
  if (value instanceof Set) {
    return value;
  }
  return new Set([value]);
}

function mergeSets<T, U>(a: Set<T>, b: Set<U>): Set<T | U> {
  return new Set([...a, ...b]);
}

function excludeSet<T>(a: Set<T>, b: Set<T>) {
  for (const item of b) {
    a.delete(item);
  }
}
