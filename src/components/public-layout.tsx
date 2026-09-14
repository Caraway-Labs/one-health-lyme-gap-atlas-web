import Link from "next/link";

import { SiteFooter } from "@/components/site-footer";

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
        <Link className="public-home-link" href="/">
          Back to Atlas
        </Link>
      </header>
      {children}
      <SiteFooter />
    </div>
  );
}
