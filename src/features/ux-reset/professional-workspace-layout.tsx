import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { StartingViewGate } from "@/features/ux-reset/onboarding/starting-view-gate";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

export const professionalWorkspaceMetadata: Metadata = {
  description:
    "Authenticated professional workspace for the One Health Lyme Gap Atlas.",
  robots: { follow: false, index: false },
  title: "Professional workspace | One Health Lyme Gap Atlas",
};

export function ProfessionalWorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <Suspense
      fallback={
        <main className="app-content ux-reset-pro-main">
          Loading workspace…
        </main>
      }
    >
      <StartingViewGate>
        <ResetProfessionalShell>{children}</ResetProfessionalShell>
      </StartingViewGate>
    </Suspense>
  );
}
