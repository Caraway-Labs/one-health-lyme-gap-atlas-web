import type { Metadata } from "next";
import type { ReactNode } from "react";

import { UX_LAB_ROBOTS } from "@/features/ux-lab/prototype-contract";
import { UxLabTestingStatement } from "@/features/ux-lab/ux-lab-testing-statement";

import "@/features/ux-lab/three-lanes/three-lanes.css";

export const metadata: Metadata = {
  description:
    "One Atlas with Learn, Clinical Resources, and Public Health & Intelligence as peer lanes. Product research prototype.",
  robots: UX_LAB_ROBOTS,
  title: "One Atlas / Three Lanes",
};

export default function ThreeLanesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <UxLabTestingStatement conceptId="three-lanes" />
      {children}
    </>
  );
}
