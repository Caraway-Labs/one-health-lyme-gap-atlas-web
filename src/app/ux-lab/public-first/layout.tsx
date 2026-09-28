import type { Metadata } from "next";
import type { ReactNode } from "react";

import { UX_LAB_ROBOTS } from "@/features/ux-lab/prototype-contract";
import { UxLabTestingStatement } from "@/features/ux-lab/ux-lab-testing-statement";

import "@/features/ux-lab/public-first/public-first.css";

export const metadata: Metadata = {
  robots: UX_LAB_ROBOTS,
};

export default function PublicFirstLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <UxLabTestingStatement conceptId="public-first" />
      {children}
    </>
  );
}
