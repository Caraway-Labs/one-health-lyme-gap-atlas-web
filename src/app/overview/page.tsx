import { pageMetadataForRoute } from "@/lib/navigation";

import { AtlasHomePage } from "../atlas-home-page";

export const metadata = pageMetadataForRoute("/overview");

// The analytical overview includes navigation that must reflect a completed
// deployment. Render it on request so a stale static page cannot outlive it.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AtlasHomePage />;
}
