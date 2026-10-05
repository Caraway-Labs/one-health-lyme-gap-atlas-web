"use client";

import Link from "next/link";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { RESET_AI_RESPONSIBLE_USE_PATH } from "@/features/ux-reset/routes";

/**
 * Trust links for the signed-in workspace.
 * Privacy stays on the public `/privacy` route, outside the `/app` auth gate.
 * AI / Responsible Use stays inside that gate. This footer reuses the existing
 * browser analytics choice and does not start the analytics SDK.
 */
export function ProfessionalTrustFooter() {
  return (
    <footer className="ux-reset-trust-footer">
      <nav aria-label="Trust" className="ux-reset-trust-links">
        <Link className="footer-link" href="/privacy">
          Privacy
        </Link>
        <Link className="footer-link" href={RESET_AI_RESPONSIBLE_USE_PATH}>
          AI / Responsible Use
        </Link>
        <PrivacyPreferences />
      </nav>
    </footer>
  );
}
