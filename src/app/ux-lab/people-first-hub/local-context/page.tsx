import type { Metadata } from "next";

import { PeopleFirstLocalContextPage } from "@/features/ux-lab/people-first-hub/task-pages";

export const metadata: Metadata = {
  title: "Local context",
};

export default function Page() {
  return <PeopleFirstLocalContextPage />;
}
