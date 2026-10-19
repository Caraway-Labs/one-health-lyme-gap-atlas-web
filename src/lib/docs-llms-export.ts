import { createHash } from "node:crypto";

import { getSiteOrigin } from "@/lib/public-origins";

const PRIVATE_DOCS_VALUE =
  /-----BEGIN [A-Z ]*PRIVATE KEY-----|SUPABASE_SERVICE_ROLE|sb_secret_[A-Za-z0-9]|sk-(?:live|proj|ant)-[A-Za-z0-9]|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|postgres(?:ql)?:\/\/[^:\s]+:[^@\s]+@/;

export type DocsMarkdownKind = "processed" | "raw";

export type PinnedPublicContract = {
  sha256: string;
  sourceCommit: string;
};

export function absoluteSiteUrl(pathname: string): string {
  const origin = getSiteOrigin().replace(/\/$/, "");
  const path = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return `${origin}${path}`;
}

/** Turn root-relative Markdown links into this deployment's absolute URLs. */
export function withAbsoluteSiteLinks(
  markdown: string,
  siteOrigin = getSiteOrigin()
): string {
  const origin = siteOrigin.replace(/\/$/, "");
  return markdown.replaceAll("](/", `](${origin}/`);
}

export function markdownKindFromSuffix(
  suffix: string | undefined
): DocsMarkdownKind | null {
  switch (suffix) {
    case "content.md": {
      return "processed";
    }
    case "content.mdx": {
      return "raw";
    }
    default: {
      return null;
    }
  }
}

/**
 * Internal rewrite segments end in `content.md` or `content.mdx`.
 * A trailing `index` segment addresses the folder index page.
 */
export function pageSlugsFromContentSegments(
  segments: readonly string[] | undefined
): { kind: DocsMarkdownKind; slugs: string[] } | null {
  if (!segments || segments.length === 0) return null;
  const kind = markdownKindFromSuffix(segments.at(-1));
  if (!kind) return null;
  const slugs = segments.slice(0, -1);
  if (slugs.at(-1) === "index") slugs.pop();
  return { kind, slugs };
}

export function renderPublicDocsPage(page: {
  description?: string;
  processed: string;
  title: string;
  url: string;
}): string {
  const lines = [`# ${page.title} (${page.url})`, ""];
  const description = page.description?.trim() ?? "";
  if (description.length > 0) {
    lines.push(`> ${description}`, "");
  }
  const processed = withAbsoluteSiteLinks(page.processed.trim());
  if (processed.length > 0) lines.push(processed);
  return lines
    .join("\n")
    .replaceAll(/\n{3,}/g, "\n\n")
    .trimEnd();
}

export function renderDocsExportIndex(
  generatedIndex: string,
  siteOrigin = getSiteOrigin()
): string {
  const origin = siteOrigin.replace(/\/$/, "");
  const index = withAbsoluteSiteLinks(generatedIndex.trimEnd(), origin);
  return `${index}

## Exports

- [llms.txt](${origin}/llms.txt): This index of the current documentation pages.
- [llms-full.txt](${origin}/llms-full.txt): Every current documentation page in one Markdown file, generated from the docs source for this deployment.
- Append \`.md\` to a page URL for that page's processed Markdown.
- Append \`.mdx\` to a page URL for that page's current MDX source.
`;
}

export function joinDocsExport(pages: readonly string[]): string {
  return `${pages.join("\n\n").trimEnd()}\n`;
}

export function docsExportMatchesPinnedRelease(
  markdown: string,
  pin: PinnedPublicContract
): boolean {
  return markdown.includes(pin.sourceCommit) && markdown.includes(pin.sha256);
}

export function findPrivateDocsValue(text: string): boolean {
  return PRIVATE_DOCS_VALUE.test(text);
}

export function publicMarkdownResponse(body: string): Response {
  if (findPrivateDocsValue(body)) {
    return new Response("Documentation export withheld.\n", {
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/plain; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
      status: 500,
    });
  }
  const digest = createHash("sha256").update(body).digest("hex");
  return new Response(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
      "Content-Type": "text/markdown; charset=utf-8",
      ETag: `"${digest}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
