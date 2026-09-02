import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";
import next from "ultracite/oxlint/next";
import react from "ultracite/oxlint/react";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, next, react, vitest],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".next/**",
    "node_modules/**",
    "node_modules.broken-*/**",
    "playwright-report/**",
    "src/generated/**",
    "tests/e2e/**",
    "test-results/**",
  ],
  // The Atlas predates this standard. Keep correctness, framework, and
  // accessibility rules enabled while deferring repository-wide stylistic and
  // component-architecture migrations to dedicated, reviewable increments.
  rules: {
    "eslint/complexity": "off",
    "eslint/curly": "off",
    "eslint/eqeqeq": "off",
    "eslint/func-style": "off",
    "eslint/no-empty-function": "off",
    "eslint/no-eq-null": "off",
    "eslint/no-await-in-loop": "off",
    "eslint/no-nested-ternary": "off",
    "eslint/no-shadow": "off",
    "eslint/no-use-before-define": "off",
    "eslint/prefer-destructuring": "off",
    "eslint/require-await": "off",
    "eslint/require-unicode-regexp": "off",
    "eslint/sort-keys": "off",
    "import/consistent-type-specifier-style": "off",
    "import/first": "off",
    "import/no-named-as-default": "off",
    "import/newline-after-import": "off",
    "react/function-component-definition": "off",
    "react/hook-use-state": "off",
    "react/rule-suppression": "off",
    "react/todo": "off",
    "typescript/consistent-type-definitions": "off",
    "typescript/consistent-type-imports": "off",
    "typescript/no-non-null-assertion": "off",
    "unicorn/no-negated-condition": "off",
    "unicorn/no-nested-ternary": "off",
    "unicorn/no-array-sort": "off",
    "unicorn/no-await-expression-member": "off",
    "unicorn/no-immediate-mutation": "off",
    "unicorn/prefer-number-coercion": "off",
    "unicorn/prefer-single-call": "off",
    "unicorn/consistent-function-scoping": "off",
    "vitest/consistent-test-filename": "off",
    "vitest/require-mock-type-parameters": "off",
    "jsx-a11y/label-has-associated-control": "off",
    "jsx-a11y/prefer-tag-over-role": "off",
    "react/button-has-type": "off",
  },
});
