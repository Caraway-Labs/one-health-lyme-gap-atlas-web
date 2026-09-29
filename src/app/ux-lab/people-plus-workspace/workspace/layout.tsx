import type { ReactNode } from "react";

import { PeoplePlusProfessionalShell } from "@/features/ux-lab/people-plus-workspace/professional-shell";

import "@/features/ux-lab/public-site-pro-app/public-site-pro-app.css";

export default function PeopleProfessionalWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PeoplePlusProfessionalShell>{children}</PeoplePlusProfessionalShell>;
}
