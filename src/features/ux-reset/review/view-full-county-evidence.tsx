"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  EXPLORER_EVIDENCE_MODE,
  EXPLORER_MODE_PARAM,
} from "@/features/ux-reset/review/explorer-mode";
import { ATLAS_EXPLORER_PATH } from "@/features/ux-reset/routes";
import { cn } from "@/lib/utils";

export function ViewFullCountyEvidence({
  fips,
  onViewCountyEvidence,
}: {
  fips: string;
  onViewCountyEvidence?: (fips: string) => void;
}) {
  const pathname = usePathname() ?? ATLAS_EXPLORER_PATH;
  const searchParams = useSearchParams();
  if (onViewCountyEvidence) {
    return (
      <Button
        data-county={fips}
        data-testid="review-view-county-evidence"
        type="button"
        onClick={() => {
          onViewCountyEvidence(fips);
        }}
      >
        View Full County Evidence
      </Button>
    );
  }
  const params = new URLSearchParams(searchParams?.toString() ?? "");
  params.set("county", fips);
  params.set(EXPLORER_MODE_PARAM, EXPLORER_EVIDENCE_MODE);
  return (
    <Link
      className={cn(buttonVariants())}
      data-county={fips}
      data-testid="review-view-county-evidence"
      href={`${pathname}?${params.toString()}`}
    >
      View Full County Evidence
    </Link>
  );
}
