"use client";

import Link from "next/link";

import {
  ABOUT_CARAWAY_LABS_PATH,
  RESET_AI_RESPONSIBLE_USE_PATH,
  RESET_SETTINGS_PATH,
} from "@/features/ux-reset/routes";

/**
 * Trust footer for the signed-in workspace.
 * The brand opens the public About route from issue 523 in a new tab.
 * Privacy stays on `/privacy`. AI / Responsible Use stays inside the workspace.
 * Privacy settings navigates to Settings in the same tab. Consent controls stay
 * on the shared privacy preference surface, not in this footer.
 */
export function ProfessionalTrustFooter() {
  return (
    <footer className="ux-reset-trust-footer">
      <div className="ux-reset-trust-footer-bar">
        <Link
          className="ux-reset-trust-brand"
          href={ABOUT_CARAWAY_LABS_PATH}
          rel="noopener noreferrer"
          target="_blank"
        >
          One Health Atlas by Caraway Labs
          <span aria-hidden="true"> ↗</span>
          <span className="sr-only"> (opens in a new tab)</span>
        </Link>
        <nav aria-label="Trust" className="ux-reset-trust-links">
          <Link href="/privacy">Privacy</Link>
          <Link href={RESET_AI_RESPONSIBLE_USE_PATH}>AI / Responsible Use</Link>
          <Link href={RESET_SETTINGS_PATH}>Privacy settings</Link>
        </nav>
      </div>
    </footer>
  );
}
