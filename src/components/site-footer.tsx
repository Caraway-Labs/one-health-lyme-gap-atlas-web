import Link from "next/link";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { FOOTER_NAVIGATION_ITEMS } from "@/lib/navigation";

export function SiteFooter() {
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
        <PrivacyPreferences />
        <a
          {...analyticsControlAttributes("footer_back_to_atlas")}
          href="#atlas"
        >
          Back to Atlas ↑
        </a>
      </nav>
    </footer>
  );
}
