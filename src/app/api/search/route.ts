import { createFromSource } from "fumadocs-core/search/server";

import { buildDocsSearchIndex } from "@/lib/docs-search";
import { docsSource } from "@/lib/docs-source";

export const { GET } = createFromSource(docsSource, {
  buildIndex: buildDocsSearchIndex,
  language: "english",
});
