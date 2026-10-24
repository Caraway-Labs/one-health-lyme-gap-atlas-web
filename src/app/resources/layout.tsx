import { Suspense, type ReactNode } from "react";

import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";
import { WorkspaceConnectingScreen } from "@/features/ux-reset/workspace-connecting-screen";

import "@/features/ux-reset/trust-footer.css";
import "@/features/ux-reset/ux-reset.css";

/**
 * Same sidebar and top bar as Atlas Explorer, without a sign-in gate.
 * Resources stays reachable without a session.
 */
export default function ResourcesLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceConnectingScreen />}>
      <ResetProfessionalShell>{children}</ResetProfessionalShell>
    </Suspense>
  );
}
