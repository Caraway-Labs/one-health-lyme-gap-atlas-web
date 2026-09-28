import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/features/ux-lab/three-lanes/three-lanes.css";

export const metadata: Metadata = {
  description:
    "One Atlas with Learn, Clinical Resources, and Public Health & Intelligence as peer lanes. Product research prototype.",
  robots: { follow: false, index: false },
  title: "One Atlas / Three Lanes",
};

export default function ThreeLanesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
