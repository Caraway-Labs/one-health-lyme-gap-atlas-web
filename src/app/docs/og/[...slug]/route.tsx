import { readFileSync } from "node:fs";
import path from "node:path";

import { ImageResponse } from "next/og";

import { DocsOpenGraphCard } from "@/lib/docs-open-graph-card";
import { DOCS_OPEN_GRAPH_SIZE, docsSectionLabel } from "@/lib/docs-social";
import { docsSource } from "@/lib/docs-source";

export const runtime = "nodejs";

export function generateStaticParams(): { slug: string[] }[] {
  return docsSource.generateParams().map((page) => ({
    slug: [...(page.slug ?? []), "image.png"],
  }));
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string[] }> }
): Promise<ImageResponse | Response> {
  const { slug } = await context.params;
  const pageSlug = slug.at(-1) === "image.png" ? slug.slice(0, -1) : slug;
  const page = docsSource.getPage(pageSlug.length === 0 ? undefined : pageSlug);
  if (!page) return new Response("Not found", { status: 404 });

  const mark = readFileSync(
    path.join(process.cwd(), "public/android-chrome-192x192.png")
  );

  return new ImageResponse(
    <DocsOpenGraphCard
      markSrc={`data:image/png;base64,${mark.toString("base64")}`}
      section={docsSectionLabel(page.url)}
      title={page.data.title}
    />,
    {
      height: DOCS_OPEN_GRAPH_SIZE.height,
      width: DOCS_OPEN_GRAPH_SIZE.width,
    }
  );
}
