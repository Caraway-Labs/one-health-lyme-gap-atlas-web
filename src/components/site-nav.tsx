"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATA_DICTIONARY } from "@/lib/data-dictionary";

const variants = [
  ["/variant_1", "County review starting point"],
  ["/variant_2", "Guided county review"],
  ["/variant_3", "County evidence workspace"],
  ["/variant_4", "Score explained"],
  ["/variant_5", "County comparison"],
  ["/variant_6", "Wide evidence workspace"],
  ["/variant_7", "Geographic explorer"],
] as const;

export function SiteNav() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sectionHref = (section: string) =>
    `${pathname}${searchParams.size ? `?${searchParams.toString()}` : ""}#${section}`;

  return (
    <nav className="topbar" aria-label="Main navigation">
      <Link
        data-atlas-analytics-control="nav_home"
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
            data-atlas-analytics-control="nav_atlas"
            href={sectionHref("atlas")}
          >
            Atlas
          </Link>
          <Link
            data-atlas-analytics-control="nav_scoring"
            href={sectionHref("scoring")}
          >
            How counties are prioritized
          </Link>
          <Link
            data-atlas-analytics-control="nav_methods"
            href={sectionHref("methods")}
          >
            How to interpret the Atlas
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                data-atlas-analytics-control="nav_variants"
                variant="ghost"
                className="nav-action"
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
                    data-atlas-analytics-control="nav_variant_link"
                    href={href}
                  />
                }
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <Dialog>
          <DialogTrigger
            render={
              <Button
                data-atlas-analytics-control="nav_data_dictionary"
                variant="ghost"
                className="nav-action"
              />
            }
          >
            Data dictionary
          </DialogTrigger>
          <DialogContent
            className="dictionary-content"
            aria-labelledby="data-dictionary-title"
          >
            <DialogHeader>
              <span className="eyebrow">Reference</span>
              <DialogTitle id="data-dictionary-title">
                Data dictionary
              </DialogTitle>
              <DialogDescription>
                Definitions used throughout the Atlas release.
              </DialogDescription>
            </DialogHeader>
            <dl className="dictionary-list">
              {DATA_DICTIONARY.map(({ term, definition }) => (
                <div key={term}>
                  <dt>{term}</dt>
                  <dd>{definition}</dd>
                </div>
              ))}
            </dl>
            <DialogFooter>
              <DialogClose
                render={
                  <Button
                    data-atlas-analytics-control="nav_data_dictionary_close"
                    variant="secondary"
                    aria-label="Close data dictionary"
                  />
                }
              >
                Close
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {process.env.NEXT_PUBLIC_KG_CHAT_ENABLED === "true" && (
          <Link href="/knowledge-graph">Evidence chat</Link>
        )}
      </div>
    </nav>
  );
}
