import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";

import { ResetProfessionalShell } from "@/features/ux-reset/professional-shell";

import "@/features/ux-reset/ux-reset.css";
import "@/features/ux-reset/trust-footer.css";

export const metadata: Metadata = {
  description:
    "Authenticated professional workspace for the One Health Lyme Gap Atlas.",
  title: "Professional workspace | One Health Lyme Gap Atlas",
};

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
