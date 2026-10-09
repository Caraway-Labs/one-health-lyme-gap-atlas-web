import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    "vendor/**",
    // Owner originals and generated visual evidence must remain byte-for-byte.
    "design-references/front-porch/approved-hero.html",
    "design-references/front-porch/review/**",
  ],
});
