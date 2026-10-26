import { metaSchema, pageSchema } from "fumadocs-core/source/schema";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

import { docsLastModifiedTime } from "./src/lib/docs-last-modified";
import { remarkPublicOrigins } from "./src/lib/remark-public-origins";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    // fumadocs-mdx 15 reads `lastModified`. `lastModifiedTime` is not a config key in this version.
    lastModified: docsLastModifiedTime,
    postprocess: {
      includeProcessedMarkdown: true,
    },
    schema: pageSchema,
  },
  meta: {
    schema: metaSchema,
  },
});

export default defineConfig({
  mdxOptions: {
    remarkPlugins: (plugins) => [remarkPublicOrigins, ...plugins],
  },
});
