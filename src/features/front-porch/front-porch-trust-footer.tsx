import Link from "next/link";
import type { ReactNode } from "react";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { FRONT_PORCH_FOOTER_LINKS } from "@/features/front-porch/front-porch-copy";
import { TrustFooterFrame } from "@/features/ux-reset/trust-footer-frame";

type FrontPorchTrustFooterProps = {
  extraControls?: ReactNode;
};

/**
 * Anonymous-safe public trust footer. Link targets stay on `/privacy` and
 * `/ai-ethics`. Privacy settings opens the shared consent dialog, so signed-out
 * visitors are not sent to workspace Settings. `extraControls` is for
 * contracted route-specific controls. The Front Porch call site leaves it empty.
 * Docs and the analytical shell reuse this footer.
 */
export function FrontPorchTrustFooter({
  extraControls = null,
}: FrontPorchTrustFooterProps) {
  return (
    <TrustFooterFrame>
      {FRONT_PORCH_FOOTER_LINKS.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
      {extraControls}
      <PrivacyPreferences />
    </TrustFooterFrame>
  );
}
