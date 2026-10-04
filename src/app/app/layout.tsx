import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { pageMetadataForResetRoute } from "@/features/ux-reset/paths";
import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import "@/features/ux-reset/ux-reset.css";

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
      <ResetProfessionalShell>{children}</ResetProfessionalShell>
    </Suspense>
  );
}
