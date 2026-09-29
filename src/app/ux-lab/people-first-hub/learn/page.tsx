import type { Metadata } from "next";

import { PeopleFirstLearnPage } from "@/features/ux-lab/people-first-hub/task-pages";

export const metadata: Metadata = {
  title: "Learn about Lyme",
};

export default function Page() {
  return <PeopleFirstLearnPage />;
}
