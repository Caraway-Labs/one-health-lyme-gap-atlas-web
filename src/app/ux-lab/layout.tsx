import type { Metadata } from "next";
import type { ReactNode } from "react";

import { uxLabMetadata } from "@/features/ux-lab/prototype-contract";
import { UxLabShell } from "@/features/ux-lab/ux-lab-shell";

import "@/features/ux-lab/ux-lab.css";

export const metadata: Metadata = uxLabMetadata();

export default function UxLabLayout({ children }: { children: ReactNode }) {
  return <UxLabShell>{children}</UxLabShell>;
}
