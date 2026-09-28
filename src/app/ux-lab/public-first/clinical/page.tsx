import type { Metadata } from "next";

import { readPublicFirstPlace } from "@/features/ux-lab/public-first/content";
import { PublicFirstClinicalPage } from "@/features/ux-lab/public-first/professional-pages";

export const metadata: Metadata = {
  title: "Clinical Resources",
};

export default async function PublicFirstClinicalRoute({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PublicFirstClinicalPage selection={readPublicFirstPlace(params.place)} />
  );
}
