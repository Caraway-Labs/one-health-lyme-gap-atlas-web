"use client";

import Link from "next/link";

import { PrivacyPreferences } from "@/components/privacy-preferences";

/**
 * Trust links for the signed-in workspace.
 * Privacy stays on the public `/privacy` route, outside the `/app` auth gate.
 * This footer reuses the existing browser analytics choice and does not start
 * the analytics SDK.
 */
export function ProfessionalTrustFooter() {
  return (
    <footer className="ux-reset-trust-footer">
      <nav aria-label="Trust" className="ux-reset-trust-links">
        <Link className="footer-link" href="/privacy">
          Privacy
        </Link>
        <PrivacyPreferences />
      </nav>
    </footer>
  );
}
