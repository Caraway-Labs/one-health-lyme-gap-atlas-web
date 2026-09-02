import { defineConfig } from "orval";

export default defineConfig({
  atlas: {
    input: "./contracts/openapi.json",
    output: {
      client: "react-query",
      httpClient: "fetch",
      mode: "split",
      override: {
        mutator: { name: "apiMutator", path: "./src/lib/api-mutator.ts" },
      },
      schemas: "./src/generated/models",
      target: "./src/generated/atlas.ts",
    },
  },
});
