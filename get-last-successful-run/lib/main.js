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
const github_1 = require("@actions/github");
const execa_1 = __importDefault(require("execa"));
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const token = core.getInput("token", { required: true });
            const octokit = github_1.getOctokit(token);
            const res1 = yield octokit.actions.getWorkflowRun(Object.assign(Object.assign({}, github_1.context.repo), { run_id: github_1.context.runId }));
            core.info("Finding most recent successful workflow run for this workflow.");
            const workflowRun = yield findLatestSuccessfulWorkflowRunInHistory(octokit, res1.data.workflow_id);
            if (workflowRun) {
                core.info("Found run " + workflowRun.id + " on commit " + workflowRun.head_sha);
            }
            else {
                core.info("None found. Output null.");
            }
            core.setOutput("run", workflowRun);
        }
        catch (err) {
            core.setFailed(err.message);
        }
    });
}
run();
function findLatestSuccessfulWorkflowRunInHistory(octokit, workflowId) {
    return __awaiter(this, void 0, void 0, function* () {
        const { stdout: branch } = yield execa_1.default("git", ["branch", "--show-current"]);
        let page = 0;
        let limit = 100;
        let res;
        do {
            // assumes these are listed from most recent to least
            res = yield octokit.actions.listWorkflowRuns(Object.assign(Object.assign({ workflow_id: workflowId }, github_1.context.repo), { status: "success", branch, per_page: limit, page }));
            for (const workflowRun of res.data.workflow_runs) {
                const sha = workflowRun.head_sha;
                core.info("Check " + sha);
                try {
                    // only accept commits that are ancestors of this one
                    yield execa_1.default("git", ["merge-base", "--is-ancestor", sha, "HEAD"]);
                    return workflowRun;
                }
                catch (err) {
                    if (err.exitCode === 128) {
                        // commit not found
                    }
                    else {
                        throw err;
                    }
                }
            }
            page++;
        } while (page * limit < res.data.total_count);
        return null;
    });
}
