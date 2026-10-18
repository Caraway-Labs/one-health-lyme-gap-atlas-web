import type { ReactNode } from "react";

import { ProfessionalWorkspaceLayout } from "@/features/ux-reset/professional-workspace-layout";

import "@/features/ux-reset/trust-footer.css";
import "@/features/ux-reset/ux-reset.css";

export { professionalWorkspaceMetadata as metadata } from "@/features/ux-reset/professional-workspace-layout";

export default function ResetAppLayout({ children }: { children: ReactNode }) {
  return <ProfessionalWorkspaceLayout>{children}</ProfessionalWorkspaceLayout>;
}
