import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PeopleFirstHubTestingStatement } from "@/features/ux-lab/people-first-hub/testing-statement";
import { UX_LAB_ROBOTS } from "@/features/ux-lab/prototype-contract";

import "@/features/ux-lab/people-first-hub/people-first-hub.css";

export const metadata: Metadata = {
  robots: UX_LAB_ROBOTS,
};

export default function PeopleFirstHubLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <PeopleFirstHubTestingStatement />
      {children}
    </>
  );
}
