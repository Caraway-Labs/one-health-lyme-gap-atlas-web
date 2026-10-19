import { renderCurrentDocsExport } from "@/lib/docs-llms";
import { publicMarkdownResponse } from "@/lib/docs-llms-export";

export const dynamic = "force-static";
export const revalidate = false;

export async function GET(): Promise<Response> {
  return publicMarkdownResponse(await renderCurrentDocsExport());
}
