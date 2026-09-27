import { appendFileSync } from "node:fs";

const commitShaPattern = /^[0-9a-f]{40}$/u;

type DeployDecision = "proceed" | "skip";
type DeployResult = "failure" | "pending" | "skip" | "success";
type GuardCommand = "guard" | "record";

export interface LatestMainDecision {
  candidateSha: string;
  decision: DeployDecision;
  mainSha: string;
  reason: string;
}

function requiredText(value: string | undefined, name: string): string {
  const text = (value ?? "").trim();
  if (text.length === 0) {
    throw new Error(`${name} is required.`);
  }
  return text;
}

function normalizeCommitSha(value: string | undefined, name: string): string {
  const sha = requiredText(value, name).toLowerCase();
  if (!commitShaPattern.test(sha)) {
    throw new Error(`${name} must be a 40-character hex commit SHA.`);
  }
  return sha;
}

function guardEnabled(latestMainWins: string | undefined): boolean {
  return (
    requiredText(latestMainWins ?? "true", "LATEST_MAIN_WINS").toLowerCase() !==
    "false"
  );
}

function assertDeployResult(result: string): DeployResult {
  switch (result) {
    case "failure":
    case "pending":
    case "skip":
    case "success": {
      return result;
    }
    default: {
      throw new Error(`Unexpected deploy result: ${result}`);
    }
  }
}

export function decideLatestMainDeploy(input: {
  candidateSha: string | undefined;
  latestMainWins?: string | undefined;
  mainSha: string | undefined;
}): LatestMainDecision {
  const candidateSha = normalizeCommitSha(input.candidateSha, "CANDIDATE_SHA");
  const mainSha = normalizeCommitSha(input.mainSha, "MAIN_SHA");
  if (candidateSha === mainSha) {
    return {
      candidateSha,
      decision: "proceed",
      mainSha,
      reason: "candidate is current origin/main",
    };
  }
  if (!guardEnabled(input.latestMainWins)) {
    return {
      candidateSha,
      decision: "proceed",
      mainSha,
      reason: "latest-main guard disabled",
    };
  }
  return {
    candidateSha,
    decision: "skip",
    mainSha,
    reason: "superseded",
  };
}

export function formatDeployIdentity(input: {
  branch: string | undefined;
  candidateSha: string | undefined;
  mainSha: string | undefined;
  reason: string | undefined;
  result: string;
  runId: string | undefined;
  runUrl: string | undefined;
  timestamp: string | undefined;
}): string {
  const result = assertDeployResult(input.result);
  const candidateSha = normalizeCommitSha(input.candidateSha, "CANDIDATE_SHA");
  const mainSha = normalizeCommitSha(input.mainSha, "MAIN_SHA");
  const reason = requiredText(input.reason, "reason");
  const identity = [
    "app=web",
    `candidate_sha=${candidateSha}`,
    `current_main_sha=${mainSha}`,
    `branch=${requiredText(input.branch, "DEPLOY_BRANCH")}`,
    `run_id=${requiredText(input.runId, "DEPLOY_RUN_ID")}`,
    `run_url=${requiredText(input.runUrl, "DEPLOY_RUN_URL")}`,
    `timestamp=${requiredText(input.timestamp, "DEPLOY_TIMESTAMP")}`,
    `result=${result}`,
    `reason=${reason}`,
  ];
  if (result === "skip" && reason === "superseded") {
    return [
      "Deployment skipped.",
      `Candidate SHA: ${candidateSha}`,
      `Current main SHA: ${mainSha}`,
      "Reason: superseded",
      ...identity,
      "",
    ].join("\n");
  }
  return [...identity, ""].join("\n");
}

function identityFromEnv(
  env: NodeJS.ProcessEnv,
  candidateSha: string,
  mainSha: string,
  reason: string,
  result: DeployResult
): string {
  return formatDeployIdentity({
    branch: env.DEPLOY_BRANCH,
    candidateSha,
    mainSha,
    reason,
    result,
    runId: env.DEPLOY_RUN_ID,
    runUrl: env.DEPLOY_RUN_URL,
    timestamp: env.DEPLOY_TIMESTAMP ?? new Date().toISOString(),
  });
}

function writeGitHubOutput(
  env: NodeJS.ProcessEnv,
  values: Record<string, string>
): void {
  const outputPath = env.GITHUB_OUTPUT;
  if (!outputPath) return;
  const lines = Object.entries(values).map(([key, value]) => `${key}=${value}`);
  appendFileSync(outputPath, `${lines.join("\n")}\n`);
}

export function runDeployGuard(env: NodeJS.ProcessEnv = process.env): string {
  const decision = decideLatestMainDeploy({
    candidateSha: env.CANDIDATE_SHA,
    latestMainWins: env.LATEST_MAIN_WINS,
    mainSha: env.MAIN_SHA,
  });
  const result: DeployResult =
    decision.decision === "skip" ? "skip" : "pending";
  writeGitHubOutput(env, {
    candidate_sha: decision.candidateSha,
    decision: decision.decision,
    main_sha: decision.mainSha,
    reason: decision.reason,
  });
  return identityFromEnv(
    env,
    decision.candidateSha,
    decision.mainSha,
    decision.reason,
    result
  );
}

function assertTerminalResult(result: DeployResult): "failure" | "success" {
  switch (result) {
    case "failure":
    case "success": {
      return result;
    }
    case "pending":
    case "skip": {
      throw new Error("DEPLOY_RESULT must be success or failure.");
    }
    default: {
      const unexpected: never = result;
      throw new Error(`Unexpected deploy result: ${String(unexpected)}`);
    }
  }
}

export function runDeployRecord(env: NodeJS.ProcessEnv = process.env): string {
  const result = assertTerminalResult(
    assertDeployResult(requiredText(env.DEPLOY_RESULT, "DEPLOY_RESULT"))
  );
  return identityFromEnv(
    env,
    requiredText(env.CANDIDATE_SHA, "CANDIDATE_SHA"),
    requiredText(env.MAIN_SHA, "MAIN_SHA"),
    requiredText(env.DEPLOY_REASON, "DEPLOY_REASON"),
    result
  );
}

function assertGuardCommand(command: string): GuardCommand {
  switch (command) {
    case "guard":
    case "record": {
      return command;
    }
    default: {
      throw new Error(`Unexpected guard command: ${command}`);
    }
  }
}

function runCommand(command: GuardCommand, env: NodeJS.ProcessEnv): string {
  switch (command) {
    case "guard": {
      return runDeployGuard(env);
    }
    case "record": {
      return runDeployRecord(env);
    }
    default: {
      const unexpected: never = command;
      throw new Error(`Unexpected guard command: ${String(unexpected)}`);
    }
  }
}

function main(): void {
  const command = assertGuardCommand(process.argv[2] ?? "guard");
  process.stdout.write(runCommand(command, process.env));
}

const invokedDirectly = process.argv[1]?.endsWith("production-deploy-guard.ts");
if (invokedDirectly) {
  try {
    main();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
