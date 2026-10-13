import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { atlasBrowserProjects } from "../scripts/playwright-projects";

const workflowPaths = [
  ".github/workflows/quality-deploy.yml",
  ".github/workflows/storybook-pages.yml",
] as const;

function projectNames(argv: readonly string[], mobileFlag?: string): string[] {
  const env: NodeJS.ProcessEnv = {
    NODE_ENV: "test",
    ...(mobileFlag === undefined ? {} : { ATLAS_E2E_MOBILE: mobileFlag }),
  };
  return atlasBrowserProjects(argv, env).flatMap((project) =>
    project.name === undefined ? [] : [project.name]
  );
}

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

describe("Playwright release projects", () => {
  it("schedules only desktop Chromium by default", () => {
    expect(projectNames([])).toStrictEqual(["desktop"]);
    expect(projectNames(["--project=desktop"])).toStrictEqual(["desktop"]);
    expect(projectNames(["tests/e2e/mobile-viewport.spec.ts"])).toStrictEqual([
      "desktop",
    ]);
    expect(projectNames([], "true")).toStrictEqual(["desktop"]);
    expect(projectNames(["--project=mobile-extra"])).toStrictEqual(["desktop"]);
  });

  it("adds Pixel 7 only for an explicit mobile request", () => {
    expect(projectNames(["--project=mobile"])).toStrictEqual([
      "desktop",
      "mobile",
    ]);
    expect(projectNames(["--project", "mobile"])).toStrictEqual([
      "desktop",
      "mobile",
    ]);
    expect(projectNames([], "1")).toStrictEqual(["desktop", "mobile"]);
  });

  it("keeps the standard npm scripts on desktop and the opt-in scripts on Pixel 7", () => {
    const scripts = JSON.parse(readText("package.json")).scripts as Record<
      string,
      string
    >;
    expect(scripts["test:e2e"]).toBe("playwright test --project=desktop");
    expect(scripts["test:e2e:mobile"]).toBe("playwright test --project=mobile");
    expect(scripts["test:storybook"]).toBe(
      "playwright test --config playwright.storybook.config.ts --project=desktop"
    );
    expect(scripts["test:storybook:mobile"]).toBe(
      "playwright test --config playwright.storybook.config.ts --project=mobile"
    );
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
