import { redirect } from "next/navigation";

import { FrontPorchPage } from "@/features/front-porch/front-porch-page";
import { legacyAnalyticalOverviewHref } from "@/lib/analytical-navigation-handoff";
import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata = pageMetadataForRoute("/");

// The public root must reflect the current Front Porch after each deployment.
export const dynamic = "force-dynamic";

type SearchParamValue = string | string[] | undefined;

interface RootPageProps {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

export default async function Page({ searchParams }: RootPageProps) {
  const legacyOverviewHref = legacyAnalyticalOverviewHref(await searchParams);
  if (legacyOverviewHref) {
    redirect(legacyOverviewHref);
  }
  return <FrontPorchPage />;
}
