import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";
import { ATLAS_OVERVIEW_PATH } from "@/lib/navigation";

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-layout">
      <header className="public-header">
        <Link
          aria-label="One Health Lyme Gap Atlas home"
          className="public-brand"
          href="/"
        >
          <span aria-hidden="true" className="brand-mark">
            +
          </span>
          <span>One Health Lyme Gap Atlas</span>
        </Link>
        <Link className="public-home-link" href={ATLAS_OVERVIEW_PATH}>
          Back to Atlas
        </Link>
      </header>
      {children}
      <SiteFooter />
    </div>
  );
}
