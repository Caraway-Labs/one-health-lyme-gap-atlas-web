import type { Metadata } from "next";

import { readPublicFirstPlace } from "@/features/ux-lab/public-first/content";
import { PublicFirstSurveillancePage } from "@/features/ux-lab/public-first/professional-pages";

export const metadata: Metadata = {
  title: "Public Health & Surveillance",
};

export default async function PublicFirstSurveillanceRoute({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PublicFirstSurveillancePage
      selection={readPublicFirstPlace(params.place)}
    />
  );
}
