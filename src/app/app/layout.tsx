import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { StartingViewGate } from "@/features/ux-reset/onboarding/starting-view-gate";
import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import "@/features/ux-reset/ux-reset.css";
import "@/features/ux-reset/trust-footer.css";

export const metadata: Metadata = pageMetadataForResetRoute("overview");

export default function ResetAppLayout({ children }: { children: ReactNode }) {
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
