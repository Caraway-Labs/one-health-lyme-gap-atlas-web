import { docsLlms } from "@/lib/docs-llms";
import {
  publicMarkdownResponse,
  renderDocsExportIndex,
} from "@/lib/docs-llms-export";

export const dynamic = "force-static";
export const revalidate = false;

export async function GET(): Promise<Response> {
  return publicMarkdownResponse(renderDocsExportIndex(await docsLlms.index()));
}
