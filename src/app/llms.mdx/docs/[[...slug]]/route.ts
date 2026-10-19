import { docsMarkdownParams, readDocsPageExport } from "@/lib/docs-llms";
import {
  pageSlugsFromContentSegments,
  publicMarkdownResponse,
} from "@/lib/docs-llms-export";
import { docsSource } from "@/lib/docs-source";

export const dynamic = "force-static";
export const dynamicParams = false;
export const revalidate = false;

type DocsMarkdownRouteProps = {
  params: Promise<{ slug?: string[] }>;
};

export function generateStaticParams(): { slug: string[] }[] {
  return docsMarkdownParams();
}

export async function GET(
  _request: Request,
  { params }: DocsMarkdownRouteProps
): Promise<Response> {
  const decoded = pageSlugsFromContentSegments((await params).slug);
  if (!decoded) {
    return new Response("Documentation page not found.\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 404,
    });
  }
  const page = docsSource.getPage(decoded.slugs);
  if (!page) {
    return new Response("Documentation page not found.\n", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      status: 404,
    });
  }
  return publicMarkdownResponse(await readDocsPageExport(page, decoded.kind));
}
