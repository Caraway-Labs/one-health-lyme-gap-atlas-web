"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import {
  OPEN_ATLAS_LABEL,
  PRO_APP_PATH,
  PUBLIC_SITE_HOME,
  PUBLIC_SITE_NAV,
  isPrototypeRouteActive,
} from "@/features/ux-lab/public-site-pro-app/paths";

const openAtlasClassName = buttonVariants({ size: "lg" });

export function PublicSiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="ux-lab-public-site">
      <header className="ux-lab-public-header">
        <div className="ux-lab-public-brand-row">
          <Link className="public-brand" href={PUBLIC_SITE_HOME}>
            <span aria-hidden="true" className="brand-mark">
              +
            </span>
            <span>One Health Lyme Gap Atlas</span>
          </Link>
          <Badge variant="secondary">Public site</Badge>
        </div>
        <nav aria-label="Public site" className="ux-lab-public-nav">
          {PUBLIC_SITE_NAV.map((item) => {
            const current = isPrototypeRouteActive(item, pathname);
            return (
              <Link
                key={item.id}
                aria-current={current ? "page" : undefined}
                href={item.href}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <Link className={openAtlasClassName} href={PRO_APP_PATH}>
          {OPEN_ATLAS_LABEL}
        </Link>
      </header>
      <main className="ux-lab-public-main">{children}</main>
      <footer className="ux-lab-public-footer">
        <p>{UX_LAB_SAMPLE_NOTICE}</p>
      </footer>
    </div>
  );
}
