import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  decideLatestMainDeploy,
  formatDeployIdentity,
  runDeployGuard,
  runDeployRecord,
} from "../scripts/production-deploy-guard";

const candidate = "a".repeat(40);
const newerMain = "b".repeat(40);
const identity = {
  branch: "main",
  runId: "4242",
  runUrl:
    "https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/actions/runs/4242",
  timestamp: "2026-09-27T22:30:00.000Z",
};

describe("latest-main production deploy guard", () => {
  it("deploys only when the candidate is still origin/main", () => {
    expect(
      decideLatestMainDeploy({ candidateSha: candidate, mainSha: candidate })
    ).toMatchObject({
      decision: "proceed",
      reason: "candidate is current origin/main",
    });
  });

  it("skips a superseded candidate without failing", () => {
    const decision = decideLatestMainDeploy({
      candidateSha: candidate,
      mainSha: newerMain,
    });
    expect(decision).toMatchObject({ decision: "skip", reason: "superseded" });

    const log = formatDeployIdentity({
      ...identity,
      candidateSha: decision.candidateSha,
      mainSha: decision.mainSha,
      reason: decision.reason,
      result: "skip",
    });
    expect(missingLines(log, skipLogLines())).toStrictEqual([]);
  });

  it("does not treat a disabled guard as a successful production deploy", () => {
    const decision = decideLatestMainDeploy({
      candidateSha: candidate,
      latestMainWins: "false",
      mainSha: newerMain,
    });
    expect(decision.decision).toBe("proceed");
    expect(decision.reason).toBe("latest-main guard disabled");
  });

  it("fails closed when the commit SHA is missing", () => {
    expect(() =>
      decideLatestMainDeploy({ candidateSha: "abc", mainSha: candidate })
    ).toThrow(/CANDIDATE_SHA/);
  });

  it("records success and failure without rebuilding another SHA", () => {
    const success = runDeployRecord({
      ...identityEnv(candidate),
      DEPLOY_REASON: "digitalocean deploy succeeded",
      DEPLOY_RESULT: "success",
    });
    expect(
      missingLines(success, [`result=success`, `candidate_sha=${candidate}`])
    ).toStrictEqual([]);
    expect(success).not.toContain("Deployment skipped.");

    const failure = runDeployRecord({
      ...identityEnv(candidate),
      DEPLOY_REASON: "digitalocean deploy failed",
      DEPLOY_RESULT: "failure",
    });
    expect(
      missingLines(failure, [`result=failure`, `current_main_sha=${candidate}`])
    ).toStrictEqual([]);
  });

  it("writes a skip decision for a stale CLI invocation", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "deploy-guard-"));
    const outputPath = path.join(directory, "github-output.txt");
    const env = {
      ...identityEnv(candidate),
      GITHUB_OUTPUT: outputPath,
      MAIN_SHA: newerMain,
    };
    try {
      const log = runDeployGuard(env);
      expect(
        missingLines(log, ["Reason: superseded", "result=skip"])
      ).toStrictEqual([]);
      const output = readFileSync(outputPath, "utf-8");
      expect(
        missingLines(output, [
          "decision=skip",
          `candidate_sha=${candidate}`,
          `main_sha=${newerMain}`,
        ])
      ).toStrictEqual([]);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });

  it("runs the CLI as a successful skip", () => {
    const directory = mkdtempSync(path.join(tmpdir(), "deploy-guard-cli-"));
    const outputPath = path.join(directory, "github-output.txt");
    try {
      const result = spawnSync(
        process.execPath,
        [
          "--experimental-strip-types",
          "--disable-warning=ExperimentalWarning",
          "scripts/production-deploy-guard.ts",
          "guard",
        ],
        {
          encoding: "utf-8",
          env: {
            ...process.env,
            ...identityEnv(candidate),
            GITHUB_OUTPUT: outputPath,
            MAIN_SHA: newerMain,
          },
        }
      );
      expect(result.status).toBe(0);
      expect(
        missingLines(
          `${result.stdout ?? ""}\n${readFileSync(outputPath, "utf-8")}`,
          ["Reason: superseded", "decision=skip"]
        )
      ).toStrictEqual([]);
    } finally {
      rmSync(directory, { recursive: true });
    }
  });
});

function missingLines(text: string, lines: readonly string[]): string[] {
  return lines.filter((line) => !text.includes(line));
}

function skipLogLines(): string[] {
  return [
    "Deployment skipped.",
    `Candidate SHA: ${candidate}`,
    `Current main SHA: ${newerMain}`,
    "Reason: superseded",
    "app=web",
    "result=skip",
    `run_id=${identity.runId}`,
    `run_url=${identity.runUrl}`,
    "branch=main",
    `timestamp=${identity.timestamp}`,
  ];
}

function identityEnv(sha: string): NodeJS.ProcessEnv {
  return {
    CANDIDATE_SHA: sha,
    NODE_ENV: "test",
    DEPLOY_BRANCH: identity.branch,
    DEPLOY_RUN_ID: identity.runId,
    DEPLOY_RUN_URL: identity.runUrl,
    DEPLOY_TIMESTAMP: identity.timestamp,
    LATEST_MAIN_WINS: "true",
    MAIN_SHA: sha,
  };
}

describe("quality and deploy workflow", () => {
  const workflow = readFileSync(
    ".github/workflows/quality-deploy.yml",
    "utf-8"
  );

  it("keeps the quality job and its existing gates", () => {
    expect(workflow).toMatch(/^ {2}quality:$/m);
    expect(
      missingLines(workflow, [
        "npm audit --audit-level=moderate",
        "npm run typecheck",
        "npm run lint",
        "npm run check:design-system",
        "npm run check:ux-reset",
        "npx vitest run --coverage",
        "Auth/account unit tests (soft-fail)",
        "continue-on-error: true",
        "codecov/codecov-action@v5",
        "npx playwright test",
        "docker build --build-arg",
        "gitleaks",
      ])
    ).toStrictEqual([]);
  });

  it("does not serialize CI with the production concurrency group", () => {
    expect(workflow).not.toMatch(/^concurrency:/m);
    const qualityJob = workflow.slice(
      workflow.indexOf("\n  quality:"),
      workflow.indexOf("\n  deploy-guard:")
    );
    expect(qualityJob).not.toContain("concurrency:");
    expect(qualityJob).toContain("CI_MAX_PARALLEL");
  });

  it("serializes production deploys and cancels superseded deploy work", () => {
    const deployJob = workflow.slice(workflow.indexOf("\n  deploy:"));
    expect(
      missingLines(deployJob, [
        "vars.WEB_PRODUCTION_CONCURRENCY_GROUP || 'atlas-web-production'",
        "cancel-in-progress: true",
        "needs: [quality, deploy-guard]",
        "digitalocean/app_action/deploy@v2",
      ])
    ).toStrictEqual([]);
    expect(deployJob).not.toContain("git checkout origin/main");
    expect(deployJob).not.toContain("git reset --hard origin/main");
  });

  it("deploys a green main push or an explicit manual production dispatch", () => {
    expect(workflow).toContain(
      "github.event_name == 'push' && github.ref == 'refs/heads/main'"
    );
    expect(workflow).toContain(
      "github.event_name == 'workflow_dispatch' && inputs.deploy_production"
    );
    expect(workflow).toContain(
      "needs.deploy-guard.outputs.decision == 'proceed'"
    );
  });
});
