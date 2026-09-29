import type { Metadata } from "next";

import { PeopleFirstPublicHealthPage } from "@/features/ux-lab/people-first-hub/public-health-page";

export const metadata: Metadata = {
  title: "Public-health tools",
};

export default function Page() {
  return <PeopleFirstPublicHealthPage />;
}
