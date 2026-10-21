"use client";

import { Database } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ReviewReleaseEvidence } from "@/features/ux-reset/review/review-release-evidence";
import { RESET_DATA_PROVENANCE_PATH } from "@/features/ux-reset/routes";
import type { AtlasMetadata } from "@/generated/models";

import "./explorer-visual-first.css";

const MONTH_YEAR = new Intl.DateTimeFormat("en-US", {
  month: "short",
  timeZone: "UTC",
  year: "numeric",
});

/**
 * Short, honest release label. It uses the release generation date from API
 * metadata. Nothing is shown as a date when the metadata does not parse.
 */
export function explorerReleaseLabel(
  metadata: Pick<AtlasMetadata, "generated_at" | "release_id"> | undefined
): string | null {
  if (!metadata) {
    return null;
  }
  const generated = new Date(metadata.generated_at);
  if (Number.isNaN(generated.getTime())) {
    return `Release ${metadata.release_id}`;
  }
  return `Release ${MONTH_YEAR.format(generated)}`;
}

/**
 * One badge states which release every number on screen belongs to. The sheet
 * holds the layered release and methodology evidence that used to sit in a
 * disclosure at the bottom of the page (UX audit C7).
 */
export function ExplorerReleaseBadge({
  errorMessage,
  isError,
  isLoading,
  metadata,
}: {
  errorMessage?: string | null;
  isError: boolean;
  isLoading: boolean;
  metadata: AtlasMetadata | undefined;
}) {
  const label = explorerReleaseLabel(metadata);
  return (
    <Sheet>
      <SheetTrigger
        render={
          <Button
            aria-label={
              label
                ? `${label}. Open release and methodology`
                : "Release and methodology"
            }
            data-testid="explorer-release-badge"
            size="sm"
            type="button"
            variant="outline"
          />
        }
      >
        <Database aria-hidden="true" data-icon="inline-start" />
        <span className="max-sm:sr-only">{label ?? "Release"}</span>
      </SheetTrigger>
      <SheetContent
        className="ux-reset-explorer-release-sheet"
        data-testid="explorer-release-sheet"
        side="right"
      >
        <SheetHeader>
          <SheetTitle>Release and methodology</SheetTitle>
          <SheetDescription>
            Every value on this page belongs to this release.
          </SheetDescription>
        </SheetHeader>
        <div className="ux-reset-explorer-release-body">
          {metadata ? (
            <p className="ux-reset-explorer-release-id">
              <Badge variant="secondary">{metadata.release_id}</Badge>
            </p>
          ) : null}
          <ReviewReleaseEvidence
            errorMessage={errorMessage}
            isError={isError}
            isLoading={isLoading}
            metadata={metadata}
          />
          <p className="ux-reset-explorer-release-link">
            <Link href={RESET_DATA_PROVENANCE_PATH}>Open Data Provenance</Link>
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
