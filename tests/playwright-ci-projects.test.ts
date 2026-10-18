import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { atlasBrowserProjects } from "../scripts/playwright-projects";

const workflowPaths = [
  ".github/workflows/quality-deploy.yml",
  ".github/workflows/storybook-pages.yml",
] as const;

function projectNames(mobileFlag?: string): string[] {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    ...(mobileFlag === undefined ? {} : { ATLAS_E2E_MOBILE: mobileFlag }),
  };
  return atlasBrowserProjects(env).flatMap((project) =>
    project.name === undefined ? [] : [project.name]
  );
}

function workerProjectNames(env: NodeJS.ProcessEnv): string[] {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      "import { atlasBrowserProjects } from './scripts/playwright-projects.ts'; process.stdout.write(atlasBrowserProjects().map((project) => project.name).join(','));",
    ],
    {
      encoding: "utf-8",
      env,
    }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || "Worker config reload failed.");
  }
  return result.stdout.split(",").filter((name) => name.length > 0);
}

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("Playwright release projects", () => {
  it("schedules only desktop Chromium unless the mobile env var is set", () => {
    expect(projectNames()).toStrictEqual(["desktop"]);
    expect(projectNames("true")).toStrictEqual(["desktop"]);
    expect(projectNames("1")).toStrictEqual(["desktop", "mobile"]);
  });

  it("keeps the mobile project when a worker reloads config without CLI flags", () => {
    const env: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "test" };
    delete env.ATLAS_E2E_MOBILE;
    expect(workerProjectNames(env)).toStrictEqual(["desktop"]);
    expect(workerProjectNames({ ...env, ATLAS_E2E_MOBILE: "1" })).toStrictEqual(
      ["desktop", "mobile"]
    );
  });

  it("keeps the standard npm scripts on desktop and the opt-in scripts on Pixel 7", () => {
    const scripts = JSON.parse(readText("package.json")).scripts as Record<
      string,
      string
    >;
    const runner = readText("scripts/run-playwright-mobile.mjs");
    expect(scripts["test:e2e"]).toBe("playwright test --project=desktop");
    expect(scripts["test:e2e:mobile"]).toBe(
      "node scripts/run-playwright-mobile.mjs"
    );
    expect(scripts["test:storybook"]).toBe(
      "playwright test --config playwright.storybook.config.ts --project=desktop"
    );
    expect(scripts["test:storybook:mobile"]).toBe(
      "node scripts/run-playwright-mobile.mjs --storybook"
    );
    expect(runner).toContain('ATLAS_E2E_MOBILE: "1"');
  });

  it("selects desktop in every CI Playwright command", () => {
    const commands = workflowPaths.flatMap((path) =>
      readText(path)
        .split("\n")
        .filter((line) => line.includes("playwright test"))
    );
    expect(commands.length).toBeGreaterThan(0);
    expect(
      commands.filter((line) => !line.includes("--project=desktop"))
    ).toStrictEqual([]);
    expect(
      commands.some((line) => line.includes("--project=mobile"))
    ).toBeFalsy();
  });

  it("installs Chromium for desktop and does not schedule the mobile scripts", () => {
    const workflows = workflowPaths
      .map((path) => readText(path))
      .join("\n")
      .split("\n")
      .filter((line) => !line.trim().startsWith("#"))
      .join("\n");
    expect(workflows).toContain("npx playwright install --with-deps chromium");
    expect(workflows).not.toContain("playwright install --with-deps webkit");
    expect(workflows).not.toContain("playwright install --with-deps firefox");
    expect(workflows).not.toMatch(/test:(?:storybook|e2e):mobile/);
    expect(workflows).toContain("npm run test:storybook");
  });

  it("loads browser projects from the shared helper in both configs", () => {
    for (const path of [
      "playwright.config.ts",
      "playwright.storybook.config.ts",
    ]) {
      const source = readText(path);
      expect(source).toContain("atlasBrowserProjects()");
      expect(source).not.toContain('devices["Pixel 7"]');
    }
  });
});
