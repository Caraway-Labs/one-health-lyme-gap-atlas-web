import { llms } from "fumadocs-core/source";

import {
  absoluteSiteUrl,
  joinDocsExport,
  renderPublicDocsPage,
} from "@/lib/docs-llms-export";
import { docsSource } from "@/lib/docs-source";

type DocsPage = NonNullable<ReturnType<typeof docsSource.getPage>>;

export const docsLlms = llms(docsSource, {
  renderPage: async (page: DocsPage) =>
    renderPublicDocsPage({
      description: page.data.description,
      processed: await page.data.getText("processed"),
      title: page.data.title,
      url: absoluteSiteUrl(page.url),
    }),
});

export async function renderCurrentDocsExport(): Promise<string> {
  const pages = [...docsSource.getPages()].sort((left, right) =>
    left.url.localeCompare(right.url, "en")
  );
  const rendered = await Promise.all(
    pages.map(async (page) => docsLlms.page(page))
  );
  return joinDocsExport(rendered);
}

export function docsMarkdownParams(): { slug: string[] }[] {
  const params: { slug: string[] }[] = [];
  for (const item of docsSource.generateParams()) {
    const slug = item.slug ?? [];
    params.push(
      { slug: [...slug, "content.md"] },
      { slug: [...slug, "content.mdx"] }
    );
  }
  params.sort((left, right) =>
    left.slug.join("/").localeCompare(right.slug.join("/"), "en")
  );
  return params;
}

export async function readDocsPageExport(
  page: DocsPage,
  kind: "processed" | "raw"
): Promise<string> {
  switch (kind) {
    case "processed": {
      return docsLlms.page(page);
    }
    case "raw": {
      const raw = await page.data.getText("raw");
      return raw.endsWith("\n") ? raw : `${raw}\n`;
    }
    default: {
      const unreachable: never = kind;
      return unreachable;
    }
  }
}
