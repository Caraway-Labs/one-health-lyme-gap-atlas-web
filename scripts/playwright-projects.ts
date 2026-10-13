import { devices, type Project } from "@playwright/test";

const mobileProjectName = "mobile";

function mobileProjectRequested(
  argv: readonly string[],
  env: NodeJS.ProcessEnv
): boolean {
  if (env.ATLAS_E2E_MOBILE === "1") {
    return true;
  }

  let previous = "";
  for (const argument of argv) {
    if (
      argument === `--project=${mobileProjectName}` ||
      (previous === "--project" && argument === mobileProjectName)
    ) {
      return true;
    }
    previous = argument;
  }

  return false;
}

export function atlasBrowserProjects(
  argv: readonly string[] = process.argv,
  env: NodeJS.ProcessEnv = process.env
): Project[] {
  const projects: Project[] = [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ];
  if (mobileProjectRequested(argv, env)) {
    projects.push({ name: "mobile", use: { ...devices["Pixel 7"] } });
  }
  return projects;
}
