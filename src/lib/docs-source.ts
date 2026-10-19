import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";

export const docsSource = loader({
  baseUrl: "/docs",
  plugins: [openapiPlugin()],
  source: docs.toFumadocsSource(),
});
