"use client";

import Link from "next/link";

import { BrandMark } from "@/components/brand-mark";
import {
  RESET_AI_RESPONSIBLE_USE_PATH,
  RESET_SETTINGS_PATH,
} from "@/features/ux-reset/routes";
import { TrustFooterFrame } from "@/features/ux-reset/trust-footer-frame";

/**
 * Trust footer for the signed-in workspace.
 * The brand opens the public About route from issue 523 in a new tab.
 * Privacy stays on `/privacy`. AI / Responsible Use stays inside the workspace.
 * Privacy settings navigates to Settings in the same tab. Consent controls
 * stay on that page through PrivacyPreferences, not in this footer.
 */
export function ProfessionalTrustFooter() {
  return (
    <TrustFooterFrame brandMark={<BrandMark size={24} />}>
      <Link href="/privacy">Privacy</Link>
      <Link href={RESET_AI_RESPONSIBLE_USE_PATH}>AI / Responsible Use</Link>
      <Link href={RESET_SETTINGS_PATH}>Privacy settings</Link>
    </TrustFooterFrame>
  );
}
