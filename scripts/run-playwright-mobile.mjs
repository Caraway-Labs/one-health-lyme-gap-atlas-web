import { spawnSync } from "node:child_process";
import path from "node:path";

const forwarded = process.argv.slice(2);
const storybook = forwarded[0] === "--storybook";
const testArguments = storybook ? forwarded.slice(1) : forwarded;
const cli = path.resolve("node_modules/@playwright/test/cli.js");
const result = spawnSync(
  process.execPath,
  [
    cli,
    "test",
    "--project=mobile",
    ...(storybook ? ["--config", "playwright.storybook.config.ts"] : []),
    ...testArguments,
  ],
  {
    env: { ...process.env, ATLAS_E2E_MOBILE: "1" },
    stdio: "inherit",
  }
);

if (result.status === null) {
  process.exit(1);
}
process.exit(result.status);
