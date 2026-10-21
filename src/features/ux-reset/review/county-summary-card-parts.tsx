"use client";

import {
  ArrowDown,
  ArrowUp,
  Bug,
  ChevronDown,
  Equal,
  FileDown,
  GitCompareArrows,
  ListChecks,
  Microscope,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode, Ref } from "react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { MeterIndicator, MeterRoot, MeterTrack } from "@/components/ui/meter";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { EvidenceStateGlyph } from "@/features/ux-reset/evidence/evidence-state-glyph";
import type { EvidenceAvailability } from "@/features/ux-reset/evidence/types";
import { DownloadCountyPdfButton } from "@/features/ux-reset/review/download-county-pdf-button";
import { formatGapScore } from "@/features/ux-reset/review/explorer-ranked-counties";
import type { AdjustedCountyScenario } from "@/features/ux-reset/review/explorer-scenario-score";
import { REVIEW_PRIORITY_QUALIFIER } from "@/features/ux-reset/review/review-priority-copy";
import { reviewRationaleEvidence } from "@/features/ux-reset/review/review-rationale-provenance";
import {
  EXPLORER_MAP_FOLLOW_UP_ID,
  scrollToSuggestedFollowUp,
} from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import { ViewFullCountyEvidence } from "@/features/ux-reset/review/view-full-county-evidence";
import type { CountyDetail } from "@/generated/models";
import { cn } from "@/lib/utils";

import "./explorer-visual-first.css";

/** Header: county name is the one display heading in the summary. */
export function CountySummaryHeader({
  county,
  fips,
  fipsTestId = "review-preview-fips",
  stateCode,
  stateName,
}: {
  county: string;
  fips: string;
  fipsTestId?: string;
  stateCode: string;
  stateName: string;
}) {
  return (
    <header className="county-summary-header">
      <h2 data-testid="review-preview-title">
        {county}, {stateName}
      </h2>
      <div className="county-summary-identity">
        <Badge variant="secondary">{stateCode}</Badge>
        <span data-testid={fipsTestId}>FIPS {fips}</span>
      </div>
    </header>
  );
}

function ScenarioDelta({
  published,
  scenario,
}: {
  published: number;
  scenario: AdjustedCountyScenario;
}) {
  if (scenario.kind === "limited") {
    return null;
  }
  const delta = scenario.score - published;
  let DeltaIcon = Equal;
  if (delta > 0) {
    DeltaIcon = ArrowUp;
  } else if (delta < 0) {
    DeltaIcon = ArrowDown;
  }
  return (
    <p className="county-summary-delta" data-testid="county-summary-delta">
      <SlidersHorizontal aria-hidden="true" />
      <span>
        Published {formatGapScore(published)} → scenario{" "}
        {formatGapScore(scenario.score)}
      </span>
      <DeltaIcon aria-hidden="true" />
      <span className="sr-only">
        {delta === 0 ? "no change" : `${delta > 0 ? "up" : "down"}`}
      </span>
    </p>
  );
}

/**
 * Published review score on the same ramp as the map legend. The marker is
 * the Meter indicator edge; a second marker shows the browser scenario value
 * when one is active. The qualifier travels with the number (audit A3).
 */
export function CountyScoreRamp({
  scenario = null,
  score,
}: {
  scenario?: AdjustedCountyScenario | null;
  score: number | null;
}) {
  if (score === null || !Number.isFinite(score)) {
    return (
      <div
        className="county-summary-score atlas-state-unavailable"
        data-testid="county-summary-score-unavailable"
      >
        <span>No published Atlas gap score</span>
      </div>
    );
  }
  const adjusted = scenario?.kind === "adjusted" ? scenario : null;
  const scenarioPercent = adjusted
    ? Math.min(100, Math.max(0, adjusted.score))
    : null;
  return (
    <div className="county-summary-score" data-testid="county-summary-score">
      <MeterRoot
        aria-label="Published Atlas gap score out of 100"
        className="county-summary-score-meter"
        max={100}
        min={0}
        value={score}
      >
        <span className="sr-only">{formatGapScore(score)} out of 100.</span>
        <Badge className="county-summary-qualifier" variant="outline">
          {REVIEW_PRIORITY_QUALIFIER}
        </Badge>
        <MeterTrack className="county-summary-ramp">
          <MeterIndicator className="county-summary-ramp-marker" />
          {scenarioPercent === null ? null : (
            <span
              aria-hidden="true"
              className="county-summary-ramp-scenario"
              style={{ left: `${scenarioPercent}%` }}
            />
          )}
        </MeterTrack>
      </MeterRoot>
      {adjusted ? (
        <ScenarioDelta published={score} scenario={adjusted} />
      ) : null}
    </div>
  );
}

export function CountyCompleteness({ value }: { value: number | null }) {
  if (value === null || !Number.isFinite(value)) {
    return null;
  }
  return (
    <MeterRoot
      aria-label="Evidence completeness"
      className="county-summary-completeness"
      data-testid="county-summary-completeness"
      max={100}
      min={0}
      value={Math.min(100, Math.max(0, value))}
    >
      <span className="county-summary-completeness-label">
        Evidence completeness
      </span>
      <span className="county-summary-completeness-value">
        {Math.round(value)}%
      </span>
      <MeterTrack>
        <MeterIndicator />
      </MeterTrack>
    </MeterRoot>
  );
}

type FingerprintEntry = {
  availability: EvidenceAvailability | null;
  Icon: LucideIcon;
  label: string;
};

/**
 * Surveillance "fingerprint": one glyph chip per surveillance claim. The
 * state is the one the shared evidence model already derives from the API
 * record. Nothing is inferred in the browser.
 */
export function CountyFingerprint({ detail }: { detail: CountyDetail }) {
  const evidence = reviewRationaleEvidence(detail);
  const entries: FingerprintEntry[] = [
    { Icon: Users, label: "Human", number: 1 },
    { Icon: Bug, label: "Tick", number: 2 },
    { Icon: Microscope, label: "Pathogen", number: 3 },
  ].map(({ Icon, label, number }) => ({
    Icon,
    availability: evidence.get(number)?.[0]?.availability ?? null,
    label,
  }));
  return (
    <ul
      aria-label="Surveillance evidence by family"
      className="county-summary-fingerprint"
      data-testid="county-summary-fingerprint"
    >
      {entries.map((entry) =>
        entry.availability === null ? null : (
          <li key={entry.label}>
            <entry.Icon aria-hidden="true" />
            <span className="county-summary-fingerprint-label">
              {entry.label}
            </span>
            <EvidenceStateGlyph availability={entry.availability} />
          </li>
        )
      )}
    </ul>
  );
}

function IconAction({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <Tooltip>
      {children}
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

/**
 * One primary action and a short icon row. Compare, follow-up, and PDF keep
 * accessible names and tooltips (audit B1/D3). Ask Atlas is a link only.
 */
export function CountySummaryActions({
  askHref,
  compareHref,
  countyName,
  evidenceHref,
  fips,
  onOpen,
  onViewCountyEvidence,
  openRef,
  releaseId,
  stateCode,
}: {
  askHref?: string;
  compareHref: string;
  countyName: string;
  /** Evidence URL the caller built, used when no open handler is given. */
  evidenceHref?: string;
  fips: string;
  onOpen: (fips: string) => void;
  onViewCountyEvidence?: (fips: string) => void;
  openRef?: Ref<HTMLAnchorElement>;
  releaseId: string;
  stateCode: string;
}) {
  return (
    <TooltipProvider delay={0}>
      <div
        className="county-summary-actions"
        data-testid="county-summary-actions"
      >
        <ViewFullCountyEvidence
          fips={fips}
          href={evidenceHref}
          onViewCountyEvidence={onViewCountyEvidence}
        />
        <div className="county-summary-icon-actions">
          <IconAction label="View County Follow-Up">
            <TooltipTrigger
              render={
                <Button
                  aria-controls={EXPLORER_MAP_FOLLOW_UP_ID}
                  aria-label="View County Follow-Up"
                  data-county={fips}
                  data-testid="review-view-county-follow-up"
                  size="icon"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    scrollToSuggestedFollowUp(
                      document.querySelector(`#${EXPLORER_MAP_FOLLOW_UP_ID}`)
                    );
                  }}
                />
              }
            >
              <ListChecks aria-hidden="true" />
            </TooltipTrigger>
          </IconAction>
          <IconAction label="Compare This County">
            <TooltipTrigger
              render={
                <Link
                  ref={openRef}
                  aria-label="Compare This County"
                  className={cn(
                    buttonVariants({ size: "icon", variant: "outline" }),
                    "ux-reset-review-open"
                  )}
                  data-testid="review-compare"
                  data-variant="outline"
                  href={compareHref}
                  onClick={() => {
                    onOpen(fips);
                  }}
                />
              }
            >
              <GitCompareArrows aria-hidden="true" />
            </TooltipTrigger>
          </IconAction>
          {askHref ? (
            <IconAction label="Ask Atlas">
              <TooltipTrigger
                render={
                  <Link
                    aria-label="Ask Atlas"
                    className={buttonVariants({
                      size: "icon",
                      variant: "outline",
                    })}
                    data-testid="review-ask-atlas"
                    href={askHref}
                  />
                }
              >
                <Sparkles aria-hidden="true" />
              </TooltipTrigger>
            </IconAction>
          ) : null}
          <DownloadCountyPdfButton
            countyName={countyName}
            fips={fips}
            icon={<FileDown aria-hidden="true" />}
            releaseId={releaseId}
            stateCode={stateCode}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

/**
 * Detailed rationale rows stay in the DOM and one click away. The default
 * summary shows the score, completeness, and surveillance fingerprint first.
 */
export function CountyEvidenceDisclosure({
  children,
  label = "Evidence behind this review",
}: {
  children: ReactNode;
  label?: string;
}) {
  return (
    <Collapsible
      className="county-summary-disclosure"
      data-testid="county-summary-disclosure"
    >
      <CollapsibleTrigger className="county-summary-disclosure-trigger">
        <span>{label}</span>
        <ChevronDown aria-hidden="true" />
      </CollapsibleTrigger>
      <CollapsibleContent keepMounted>{children}</CollapsibleContent>
    </Collapsible>
  );
}
