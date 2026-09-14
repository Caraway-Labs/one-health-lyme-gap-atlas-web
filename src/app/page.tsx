import { pageMetadataForRoute } from "@/lib/navigation";

import { AtlasHomePage } from "./atlas-home-page";

export const metadata = pageMetadataForRoute("/");

// The homepage includes global navigation that must reflect a completed deployment.
// Render this route on request so an obsolete static homepage cannot outlive it.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AtlasHomePage />;
}
