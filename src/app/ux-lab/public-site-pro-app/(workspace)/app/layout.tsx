import type { ReactNode } from "react";

import { ProfessionalAppShell } from "@/features/ux-lab/public-site-pro-app/professional-app-shell";

export default function ProfessionalAppLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <ProfessionalAppShell>{children}</ProfessionalAppShell>;
}
