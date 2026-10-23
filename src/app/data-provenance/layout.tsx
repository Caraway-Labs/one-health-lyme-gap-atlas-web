import { Suspense, type ReactNode } from "react";

import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { WorkspaceConnectingScreen } from "@/features/ux-reset/workspace-connecting-screen";

import "@/features/ux-reset/trust-footer.css";
import "@/features/ux-reset/ux-reset.css";

/**
 * Same sidebar and top bar as Atlas Explorer, without the starting-view gate.
 * Data Provenance stays reachable without a session; only the chrome changes.
 */
export default function DataProvenanceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense fallback={<WorkspaceConnectingScreen />}>
      <ResetProfessionalShell contentLandmark={false}>
        {children}
      </ResetProfessionalShell>
    </Suspense>
  );
}
