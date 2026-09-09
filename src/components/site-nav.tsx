"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { DataDictionaryDialog } from "@/components/data-dictionary-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  analyticsControlAttributes,
  trackMethodologyOpened,
  trackProvenanceOpened,
} from "@/lib/atlas-analytics";

const variants = [
  ["/variant_1", "County review starting point"],
  ["/variant_2", "Guided county review"],
  ["/variant_3", "County evidence workspace"],
  ["/variant_4", "Score explained"],
  ["/variant_5", "County comparison"],
  ["/variant_6", "Wide evidence workspace"],
  ["/geographic_explorer", "Geographic explorer"],
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionHref = (section: string) =>
    `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}#${section}`;

  return (
    <nav className="topbar" aria-label="Main navigation">
      <Link
        {...analyticsControlAttributes("nav_home")}
        className="brand"
        href="/#atlas"
        aria-label="One Health Lyme Gap Atlas home"
      >
        <span className="brand-mark">+</span>
        <span>One Health Lyme Gap Atlas</span>
      </Link>
      <div className="nav-links">
        <div className="section-links">
          <Link
            {...analyticsControlAttributes("nav_atlas")}
            href={sectionHref("atlas")}
          >
            Atlas
          </Link>
          <Link
            {...analyticsControlAttributes("nav_scoring")}
            href={sectionHref("scoring")}
          >
            How counties are prioritized
          </Link>
          <Link
            {...analyticsControlAttributes("nav_methods")}
            href={sectionHref("methods")}
            onClick={() =>
              trackMethodologyOpened(pathname, "methods_navigation")
            }
          >
            How to interpret the Atlas
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                {...analyticsControlAttributes("nav_variants")}
                variant="ghost"
                className="nav-action"
                onClick={() =>
                  trackProvenanceOpened(pathname, "data_dictionary")
                }
              />
            }
          >
            Variants
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="nav-menu-content">
            {variants.map(([href, label]) => (
              <DropdownMenuItem
                key={href}
                render={
                  <Link
                    {...analyticsControlAttributes("nav_variant_link")}
                    href={href}
                  />
                }
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <DataDictionaryDialog />
        {process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true" && (
          <Link href="/knowledge-graph">Evidence chat</Link>
        )}
        <Link href={`/auth/sign-in?next=${encodeURIComponent(`${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}`)}`}>Sign in</Link>
      </div>
    </nav>
  );
}
