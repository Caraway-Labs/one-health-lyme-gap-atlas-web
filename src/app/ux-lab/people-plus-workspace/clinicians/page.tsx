import type { Metadata } from "next";

import {
  REVIEWED_HANDOFF_QUERY,
  peopleReviewedHandoffFromParam,
} from "@/features/ux-lab/people-plus-workspace/handoff-content";
import { PeopleCliniciansPageContent } from "@/features/ux-lab/people-plus-workspace/people-clinicians-view";

export const metadata: Metadata = {
  title: "Clinician resources",
};

export default async function PeopleCliniciansPage({
  searchParams,
}: {
  searchParams: Promise<{ [REVIEWED_HANDOFF_QUERY]?: string | string[] }>;
}) {
  const params = await searchParams;
  const handoff = peopleReviewedHandoffFromParam(
    params[REVIEWED_HANDOFF_QUERY]
  );

  return <PeopleCliniciansPageContent handoff={handoff} />;
}
