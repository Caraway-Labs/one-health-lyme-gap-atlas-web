import Link from "next/link";
import type { ReactNode } from "react";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { FRONT_PORCH_FOOTER_LINKS } from "@/features/front-porch/front-porch-copy";
import { TrustFooterFrame } from "@/features/ux-reset/trust-footer-frame";

type FrontPorchTrustFooterProps = {
  extraControls?: ReactNode;
};

/**
 * Public Front Porch trust footer. Link targets are anonymous-safe:
 * `/app/ai-responsible-use` and `/app/settings` redirect signed-out visitors
 * to sign-in, and Settings does not yet expose analytics consent (issues 427 and 527).
 * `extraControls` is for contracted route-specific controls. The Front Porch
 * call site leaves it empty.
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
