import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "vendor/**",
    "storybook-static/**",
    // Owner originals and generated visual evidence must remain byte-for-byte.
    "design-references/front-porch/approved-hero.html",
    "design-references/front-porch/review/**",
    // Byte-for-byte pin of the public API contract. Formatting would change
    // the checksum that identifies the generated reference.
    "contracts/public-openapi.json",
    // Byte-for-byte pin of the API changelog. Formatting would change the
    // checksum that must match the contract commit.
    "contracts/api-changelog.md",
    // Generated from that pin. docs:check compares it to the renderer.
    "content/docs/develop/changelog.mdx",
    // Byte-for-byte pin of the approved first-party API contract.
    "contracts/openapi.json",
    // Generator output. docs:api:check compares these files to the pin.
    "content/docs/api-reference/**",
    // Pinned contract bytes plus the generated Postman collection. Formatting
    // would change the checksum or the docs:api:check snapshot.
    "public/downloads/**",
  ],
});
