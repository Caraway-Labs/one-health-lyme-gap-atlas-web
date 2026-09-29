import type { Metadata } from "next";
import type { ReactNode } from "react";

import { GeographyFirstV2TestingStatement } from "@/features/ux-lab/geography-first-v2/geography-first-v2-testing-statement";
import { UX_LAB_ROBOTS } from "@/features/ux-lab/prototype-contract";

export const metadata: Metadata = {
  robots: UX_LAB_ROBOTS,
};

export default function GeographyFirstV2Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <>
      <GeographyFirstV2TestingStatement />
      {children}
    </>
  );
}
