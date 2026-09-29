import type { Metadata } from "next";

import { PeopleFirstCliniciansPage } from "@/features/ux-lab/people-first-hub/clinicians-page";

export const metadata: Metadata = {
  title: "Clinician resources",
};

export default function Page() {
  return <PeopleFirstCliniciansPage />;
}
