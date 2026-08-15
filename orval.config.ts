import { defineConfig } from "orval";

export default defineConfig({
  atlas: {
    input: "./contracts/openapi.json",
    output: {
      mode: "split",
      target: "./src/generated/atlas.ts",
      schemas: "./src/generated/models",
      client: "react-query",
      httpClient: "fetch",
      override: { mutator: { path: "./src/lib/api-mutator.ts", name: "apiMutator" } },
    },
  },
});
