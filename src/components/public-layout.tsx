"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrandMark } from "@/components/brand-mark";
import { FeedbackTrigger } from "@/components/feedback-dialog";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";

const FOOTER_FEEDBACK_ROUTES = new Set([
  "/privacy",
  "/ai-ethics",
  "/data-provenance",
]);

export function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="public-layout">
      <header className="public-header">
        <Link
          aria-label="One Health Lyme Gap Atlas home"
          className="public-brand"
          href="/"
        >
          <BrandMark size={28} />
          <span>One Health Lyme Gap Atlas</span>
        </Link>
      </header>
      {children}
      <FrontPorchTrustFooter
        extraControls={
          FOOTER_FEEDBACK_ROUTES.has(pathname) ? (
            <FeedbackTrigger
              controlId="feedback_footer_open"
              label="Feedback"
            />
          ) : null
        }
      />
    </div>
  );
}
