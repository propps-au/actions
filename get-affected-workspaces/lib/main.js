"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const cli_1 = require("@yarnpkg/cli");
const core_1 = __importDefault(require("@yarnpkg/core"));
const fslib_1 = require("@yarnpkg/fslib");
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const includeDependencies = !core.getInput("include-dependencies") ||
                core.getInput("include-dependencies") !== "false";
            const cwd = fslib_1.ppath.cwd();
            const plugins = cli_1.getPluginConfiguration();
            const configuration = yield core_1.default.Configuration.find(cwd, plugins);
            const cache = yield core_1.default.Cache.find(configuration);
            const { project } = yield core_1.default.Project.find(configuration, cwd);
            yield project.resolveEverything({ report: new core_1.default.ThrowReport(), cache });
            const changedWorkspaces = core
                .getInput("workspaces", { required: true })
                .split(" ")
                .map((packageName) => {
                let workspace = project.workspaces.find((item) => getWorkspacePackageName(item) === packageName);
                if (!workspace) {
                    core.setFailed("There is no workspace with the package name " + packageName);
                    process.exit(1);
                }
                return workspace;
            });
            const changedWorkspacesSet = new Set(changedWorkspaces);
            const dependentWorkspaces = getDependentWorkspacesRecursive(changedWorkspacesSet, project);
            const dependencies = getWorkspaceDependenciesRecursive(mergeSets(changedWorkspacesSet, dependentWorkspaces), project);
            const result = Array.from(new Set([
                ...changedWorkspacesSet,
                ...dependentWorkspaces,
                ...(includeDependencies ? dependencies : []),
            ]));
            core.setOutput("affected-workspaces", result);
        }
        catch (err) {
            core.setFailed(err.message);
        }
    });
}
run();
function getWorkspacePackageName(workspace) {
    var _a, _b, _c;
    return ((((_a = workspace.manifest.name) === null || _a === void 0 ? void 0 : _a.scope) ? "@" + workspace.manifest.name.scope + "/"
        : "") + ((_c = (_b = workspace.manifest.name) === null || _b === void 0 ? void 0 : _b.name) !== null && _c !== void 0 ? _c : ""));
}
function getDependentWorkspacesRecursive(leafDependencies, project) {
    const dependentWorkspaceIdents = new Set();
    const traceDependents = (dependency) => {
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
    const dependentWorkspaces = new Set();
    for (const identHash of dependentWorkspaceIdents) {
        dependentWorkspaces.add(project.workspacesByIdent.get(identHash));
    }
    return dependentWorkspaces;
}
const getWorkspaceDependenciesRecursive = (rootWorkspaces, project) => {
    const workspaceList = new Set();
    const visitWorkspace = (workspace) => {
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
function toSet(value) {
    if (value instanceof Set) {
        return value;
    }
    return new Set([value]);
}
function mergeSets(a, b) {
    return new Set([...a, ...b]);
}
function excludeSet(a, b) {
    for (const item of b) {
        a.delete(item);
    }
}
