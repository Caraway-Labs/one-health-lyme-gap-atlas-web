import type { Metadata } from "next";

import { PeopleFirstHubFrontDoor } from "@/features/ux-lab/people-first-hub/front-door";

export const metadata: Metadata = {
  title: "People-First Atlas Hub",
};

export default function PeopleFirstHubPage() {
  return <PeopleFirstHubFrontDoor />;
}
