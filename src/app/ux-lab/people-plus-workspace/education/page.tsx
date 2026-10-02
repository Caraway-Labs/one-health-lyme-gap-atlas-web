import type { Metadata } from "next";

import {
  REVIEWED_HANDOFF_QUERY,
  peopleReviewedHandoffFromParam,
} from "@/features/ux-lab/people-plus-workspace/handoff-content";
import { PeopleEducationPageContent } from "@/features/ux-lab/people-plus-workspace/people-education-view";

export const metadata: Metadata = {
  title: "Education and prevention",
};

export default async function PeopleEducationPage({
  searchParams,
}: {
  searchParams: Promise<{ [REVIEWED_HANDOFF_QUERY]?: string | string[] }>;
}) {
  const params = await searchParams;
  const handoff = peopleReviewedHandoffFromParam(
    params[REVIEWED_HANDOFF_QUERY]
  );

  return <PeopleEducationPageContent handoff={handoff} />;
}
