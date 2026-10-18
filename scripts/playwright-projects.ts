import { devices, type Project } from "@playwright/test";

export function atlasBrowserProjects(
  env: NodeJS.ProcessEnv = process.env
): Project[] {
  const projects: Project[] = [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ];
  // Workers reload this file without the parent CLI arguments. The env var is
  // inherited, so the project list stays stable across those processes.
  if (env.ATLAS_E2E_MOBILE === "1") {
    projects.push({ name: "mobile", use: { ...devices["Pixel 7"] } });
  }
  return projects;
}
