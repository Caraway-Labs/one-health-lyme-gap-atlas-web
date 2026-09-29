"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  OPEN_ATLAS_LABEL,
  PEOPLE_HOME,
  PEOPLE_PUBLIC_NAV,
  PEOPLE_WORKSPACE_PATH,
} from "@/features/ux-lab/people-plus-workspace/paths";
import { UX_LAB_SAMPLE_NOTICE } from "@/features/ux-lab/prototype-contract";
import { isPrototypeRouteActive } from "@/features/ux-lab/public-site-pro-app/paths";
import { cn } from "@/lib/utils";

const openAtlasClassName = cn(
  buttonVariants({ size: "lg" }),
  "people-plus-open-atlas"
);

export function PeoplePlusShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const onWorkspace = pathname.startsWith(PEOPLE_WORKSPACE_PATH);

  if (onWorkspace) {
    return children;
  }

  return (
    <div className="people-plus-environment">
      <header className="people-plus-header">
        <div className="people-plus-brand-row">
          <Link className="people-plus-brand" href={PEOPLE_HOME}>
            <span aria-hidden="true" className="brand-mark">
              +
            </span>
            <span>One Health Lyme Gap Atlas</span>
          </Link>
          <Badge variant="secondary">People-first</Badge>
        </div>
        <nav aria-label="People-first Atlas" className="people-plus-nav">
          {PEOPLE_PUBLIC_NAV.map((item) => {
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
        <Link className={openAtlasClassName} href={PEOPLE_WORKSPACE_PATH}>
          {OPEN_ATLAS_LABEL}
        </Link>
      </header>
      <main className="people-plus-main">{children}</main>
      <div className="people-plus-footer" role="contentinfo">
        <p>{UX_LAB_SAMPLE_NOTICE}</p>
        <p className="type-small">
          No sign-in is required for this prototype. Accounts and saved
          preferences are not connected.
        </p>
      </div>
    </div>
  );
}
