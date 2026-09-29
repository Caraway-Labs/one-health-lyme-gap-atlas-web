import type { Metadata } from "next";
import type { ReactNode } from "react";

import { PeoplePlusWorkspaceTestingNote } from "@/features/ux-lab/people-plus-workspace/people-plus-testing-note";
import { PeoplePlusShell } from "@/features/ux-lab/people-plus-workspace/people-shell";
import { UX_LAB_ROBOTS } from "@/features/ux-lab/prototype-contract";

import "@/features/ux-lab/people-plus-workspace/people-plus-workspace.css";

export const metadata: Metadata = {
  robots: UX_LAB_ROBOTS,
};

export default function PeoplePlusWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <PeoplePlusWorkspaceTestingNote />
      <PeoplePlusShell>{children}</PeoplePlusShell>
    </>
  );
}
