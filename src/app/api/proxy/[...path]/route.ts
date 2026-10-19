import { handlePlaygroundGet } from "@/lib/api-playground-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(request: Request): Promise<Response> {
  return handlePlaygroundGet(request);
}
