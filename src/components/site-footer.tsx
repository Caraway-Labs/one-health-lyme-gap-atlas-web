"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

import {
  FeedbackTrigger,
  useOptionalFeedbackController,
} from "@/components/feedback-dialog";
import { PrivacyPreferences } from "@/components/privacy-preferences";
import { backToAtlasHref } from "@/lib/analytical-navigation-handoff";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { ATLAS_OVERVIEW_PATH, FOOTER_NAVIGATION_ITEMS } from "@/lib/navigation";

function BackToAtlasLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <a
      {...analyticsControlAttributes("footer_back_to_atlas")}
      href={backToAtlasHref(pathname, searchParams)}
    >
      Back to Atlas ↑
    </a>
  );
}

export function SiteFooter() {
  const pathname = usePathname();
  const feedback = useOptionalFeedbackController();
  const showFooterFeedback =
    Boolean(feedback) && (pathname === "/privacy" || pathname === "/ai-ethics");

  return (
    <footer>
      <div className="footer-brand">
        <span className="brand-mark">+</span>
        <span>One Health Lyme Gap Atlas</span>
      </div>
      <p>
        Independent Caraway Labs prototype. Views do not represent an employer
        or public health laboratory.
      </p>
      <nav className="footer-links" aria-label="Footer navigation">
        {FOOTER_NAVIGATION_ITEMS.map((item) =>
          item.external ? (
            <a
              href={item.href}
              key={item.id}
              rel="noopener noreferrer"
              target="_blank"
            >
              {item.label}
            </a>
          ) : (
            <Link
              {...analyticsControlAttributes("footer_privacy")}
              href={item.href}
              key={item.id}
            >
              {item.label}
            </Link>
          )
        )}
        {showFooterFeedback ? (
          <FeedbackTrigger
            className="footer-feedback"
            controlId="feedback_footer_open"
            label="Feedback"
          />
        ) : null}
        <PrivacyPreferences />
        <Suspense
          fallback={
            <a
              {...analyticsControlAttributes("footer_back_to_atlas")}
              href={`${ATLAS_OVERVIEW_PATH}#atlas`}
            >
              Back to Atlas ↑
            </a>
          }
        >
          <BackToAtlasLink />
        </Suspense>
      </nav>
    </footer>
  );
}
