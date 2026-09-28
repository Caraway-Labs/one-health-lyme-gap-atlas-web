import type { Metadata } from "next";

import { readPublicFirstPlace } from "@/features/ux-lab/public-first/content";
import { PublicFirstFrontDoor } from "@/features/ux-lab/public-first/front-door";

export const metadata: Metadata = {
  title: "Public-First Local Snapshot",
};

export default async function PublicFirstPage({
  searchParams,
}: {
  searchParams: Promise<{ place?: string | string[] }>;
}) {
  const params = await searchParams;
  return (
    <PublicFirstFrontDoor selection={readPublicFirstPlace(params.place)} />
  );
}
