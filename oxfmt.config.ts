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
  ],
});
