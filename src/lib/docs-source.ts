import { docs } from "collections/server";
import { loader } from "fumadocs-core/source";
import { openapiPlugin } from "fumadocs-openapi/server";

import { withDocsSidebarTabs } from "@/lib/docs-sidebar-tabs";

export const docsSource = loader({
  baseUrl: "/docs",
  pageTree: {
    transformers: [
      {
        root(tree) {
          return withDocsSidebarTabs(tree);
        },
      },
    ],
  },
  plugins: [openapiPlugin()],
  source: docs.toFumadocsSource(),
});
