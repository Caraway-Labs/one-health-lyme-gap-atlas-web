import { permanentRedirect } from "next/navigation";

import { investigationWorkspaceHref } from "@/lib/investigation-workspace-route";

type SearchParamValue = string | string[] | undefined;

interface LegacyVariantSixPageProps {
  searchParams: Promise<Record<string, SearchParamValue>>;
}

export default async function LegacyVariantSixPage({
  searchParams,
}: LegacyVariantSixPageProps) {
  permanentRedirect(investigationWorkspaceHref(await searchParams));
}
