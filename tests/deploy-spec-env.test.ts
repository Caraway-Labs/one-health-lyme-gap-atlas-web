import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const root = path.join(import.meta.dirname, "..");
const appSpec = readFileSync(path.join(root, ".do/app.yaml"), "utf-8");
const workflow = readFileSync(
  path.join(root, ".github/workflows/quality-deploy.yml"),
  "utf-8"
);

const PLACEHOLDER = /\$\{(?<name>NEXT_PUBLIC_[A-Z0-9_]+)\}/g;

function deployStepEnv(): string {
  const start = workflow.indexOf("uses: digitalocean/app_action/deploy@v2");
  expect(start).toBeGreaterThan(-1);
  const end = workflow.indexOf("with: {", start);
  return workflow.slice(start, end);
}

describe("DigitalOcean deploy spec placeholders", () => {
  it("passes every NEXT_PUBLIC placeholder in .do/app.yaml to the deploy step from a secret", () => {
    const placeholders = [...appSpec.matchAll(PLACEHOLDER)].map(
      (match) => match.groups?.name
    );
    expect(placeholders).toContain("NEXT_PUBLIC_AMPLITUDE_API_KEY");

    const stepEnv = deployStepEnv();
    for (const name of new Set(placeholders)) {
      expect(stepEnv).toContain(`${name}: \${{ secrets.${name} }}`);
    }
  });
});
