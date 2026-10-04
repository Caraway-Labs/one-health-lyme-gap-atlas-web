import type { Metadata } from "next";
import type { ReactNode } from "react";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import "@/features/ux-reset/ux-reset.css";

export const metadata: Metadata = pageMetadataForResetRoute("overview");

export default function ResetAppLayout({ children }: { children: ReactNode }) {
  return <ResetProfessionalShell>{children}</ResetProfessionalShell>;
}
