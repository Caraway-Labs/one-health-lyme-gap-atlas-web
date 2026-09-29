import type { Metadata } from "next";

import { PeopleFirstProfessionalStubPage } from "@/features/ux-lab/people-first-hub/task-pages";

export const metadata: Metadata = {
  title: "Public-health tools",
};

export default function Page() {
  return <PeopleFirstProfessionalStubPage taskId="public-health" />;
}
