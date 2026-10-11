import Link from "next/link";
import type { ReactNode } from "react";

import { ABOUT_CARAWAY_LABS_PATH } from "@/features/ux-reset/routes";

type TrustFooterFrameProps = {
  children: ReactNode;
  brandMark?: ReactNode;
};

/**
 * Shared trust-footer chrome. Callers supply the trust controls so the public
 * page can keep anonymous consent without using the signed-in Settings route.
 */
export function TrustFooterFrame({
  children,
  brandMark,
}: TrustFooterFrameProps) {
  return (
    <footer className="ux-reset-trust-footer">
      <div className="ux-reset-trust-footer-bar">
        <Link
          className="ux-reset-trust-brand"
          href={ABOUT_CARAWAY_LABS_PATH}
          rel="noopener noreferrer"
          target="_blank"
        >
          {brandMark}
          <span>
            One Health Atlas by Caraway Labs
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only"> (opens in a new tab)</span>
          </span>
        </Link>
        <nav aria-label="Trust" className="ux-reset-trust-links">
          {children}
        </nav>
      </div>
    </footer>
  );
}
