"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useMemo } from "react";

import { AtlasSectionHeader } from "@/components/atlas-section-header";
import { AtlasStatusMessage } from "@/components/atlas-status-message";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { uxResetShellHandoffHref } from "@/features/ux-reset/context-handoff";
import {
  parseCompareFipsList,
  UX_RESET_COMPARE_COUNTY_LIMIT,
} from "@/features/ux-reset/context-params";
import {
  EvidenceObject,
  ReleaseEvidenceStateStrip,
  releaseEvidenceContextFromMetadata,
} from "@/features/ux-reset/evidence";
import { releaseEvidenceLoadStateValues } from "@/features/ux-reset/evidence/types";
import { evidenceAvailabilityLabel } from "@/features/ux-reset/evidence/value-state-contract";
import { ExploreMapPanel } from "@/features/ux-reset/explore/explore-map-panel";
import {
  authoritativeExploreComparePair,
  exploreRequestStatusCopy,
} from "@/features/ux-reset/explore/explore-model";
import { exploreHandoffSearchParams } from "@/features/ux-reset/explore/explore-search-params";
import { useExploreWorkspace } from "@/features/ux-reset/explore/use-explore-workspace";
import { resetRouteById } from "@/features/ux-reset/paths";
import {
  RESET_COMPARE_PATH,
  RESET_INVESTIGATE_PATH,
} from "@/features/ux-reset/routes";
import { reviewScopeLabel } from "@/lib/atlas-state-geography";
import { cn } from "@/lib/utils";

function replaceCompareMember(pair: readonly string[], fips: string): string[] {
  if (!fips || pair.includes(fips)) {
    return parseCompareFipsList(pair.join(","));
  }
  if (pair.length < UX_RESET_COMPARE_COUNTY_LIMIT) {
    return parseCompareFipsList([...pair, fips].join(","));
  }
  return parseCompareFipsList([pair[0] ?? "", fips].join(","));
}

function ResetExploreExperienceInner() {
  const route = resetRouteById("explore");
  const pathname = usePathname();
  const workspace = useExploreWorkspace();
  const {
    committed,
    directoryError,
    directoryLoading,
    geometry,
    geometryError,
    geometryLoading,
    geometryReleaseId,
    mapScope,
    measures,
    measuresErrorMessage,
    measuresLoading,
    metadata,
    metadataError,
    metadataLoading,
    observationsError,
    observationsLoading,
    releaseId,
    requestedMeasure,
    requestedMeasureId,
    timeBound,
    retryGeometry,
    setComparePair,
    setCounty,
    setMapScope,
    setMeasureId,
    stateOptions,
    urlState,
  } = workspace;

  const requestedScopeLabel = reviewScopeLabel(mapScope, stateOptions);
  const committedScopeLabel = committed
    ? reviewScopeLabel(committed.mapScope, stateOptions)
    : null;
  const matchesCommitted = Boolean(
    committed &&
    requestedMeasureId &&
    releaseId &&
    timeBound &&
    committed.measureId === requestedMeasureId &&
    committed.mapScope === mapScope &&
    committed.releaseId === releaseId &&
    committed.handoffPeriod === timeBound.handoffPeriod
  );
  const requestCopy = exploreRequestStatusCopy({
    committedMapScopeLabel: committedScopeLabel,
    committedMeasureLabel: committed?.measureLabel ?? null,
    committedPeriod: committed?.handoffPeriod ?? null,
    failed: observationsError || measuresErrorMessage !== null,
    matchesCommitted,
    requestedMapScopeLabel: requestedScopeLabel,
    requestedMeasureLabel:
      requestedMeasure?.label ?? requestedMeasureId ?? "The next measure",
    requestedPeriod: timeBound?.handoffPeriod ?? null,
  });
  const focusedFips =
    committed?.rows.some((row) => row.fips === urlState.county) &&
    urlState.county
      ? urlState.county
      : (committed?.rows[0]?.fips ?? "");
  const focusedRow =
    committed?.rows.find((row) => row.fips === focusedFips) ?? null;
  const effectiveComparePair = authoritativeExploreComparePair(
    urlState.compare,
    urlState.selected
  );
  const handoffParams = useMemo(
    () =>
      exploreHandoffSearchParams({
        compare: effectiveComparePair,
        county: focusedFips || urlState.county,
        dataset: committed?.releaseId ?? null,
        map_scope: urlState.map_scope,
        metric: committed?.measureId ?? null,
        period: committed?.handoffPeriod ?? null,
        scope: urlState.scope,
        selected: effectiveComparePair,
      }),
    [committed, effectiveComparePair, focusedFips, urlState]
  );
  const investigateHref = uxResetShellHandoffHref(
    RESET_INVESTIGATE_PATH,
    pathname,
    handoffParams
  );
  const compareHref = uxResetShellHandoffHref(
    RESET_COMPARE_PATH,
    pathname,
    handoffParams
  );
  const pairIncludesFocused = effectiveComparePair.includes(focusedFips);
  const pairIsFull =
    effectiveComparePair.length >= UX_RESET_COMPARE_COUNTY_LIMIT;
  let compareActionLabel = "Add to compare";
  if (pairIncludesFocused) {
    compareActionLabel = "Remove from compare";
  } else if (pairIsFull) {
    compareActionLabel = "Replace in compare";
  }
  const releaseLoadState = metadataError
    ? releaseEvidenceLoadStateValues.error
    : metadataLoading
      ? releaseEvidenceLoadStateValues.loading
      : releaseEvidenceLoadStateValues.ready;

  return (
    <div data-page="explore" data-testid="explore-workspace">
      <header className="ux-reset-explore-header">
        <p className="eyebrow">Spatial discovery</p>
        <h1>{route.label}</h1>
        <p className="type-body">{route.description}</p>
      </header>

      <div className="ux-reset-explore-toolbar">
        <label className="ux-reset-explore-field">
          <span className="type-small">Governed measure</span>
          <Select
            value={requestedMeasureId}
            onValueChange={(next) => {
              if (!next) {
                return;
              }
              setMeasureId(next);
            }}
          >
            <SelectTrigger
              aria-label="Governed measure"
              className="h-11 w-full"
              data-testid="explore-measure-select"
            >
              <SelectValue>
                {requestedMeasure?.label ?? "Choose a measure"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {measures.map((measure) => (
                <SelectItem key={measure.measure_id} value={measure.measure_id}>
                  {measure.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
        <label className="ux-reset-explore-field">
          <span className="type-small">Map area</span>
          <Select
            value={mapScope}
            onValueChange={(next) => {
              if (!next) {
                return;
              }
              setMapScope(next);
            }}
          >
            <SelectTrigger
              aria-label="Map area"
              className="h-11 w-full"
              data-testid="explore-map-scope-select"
            >
              <SelectValue>{requestedScopeLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">United States</SelectItem>
              {stateOptions.map((state) => (
                <SelectItem key={state.code} value={state.code}>
                  {state.name} ({state.code})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      </div>

      <ReleaseEvidenceStateStrip
        context={metadata ? releaseEvidenceContextFromMetadata(metadata) : null}
        errorMessage={metadataError}
        loadState={releaseLoadState}
      />

      {metadataLoading || measuresLoading || directoryLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading governed measures and county geography…
        </AtlasStatusMessage>
      ) : null}

      {metadataError ? (
        <AtlasStatusMessage tone="error">{metadataError}</AtlasStatusMessage>
      ) : null}

      {measuresErrorMessage ? (
        <AtlasStatusMessage tone="error">
          {measuresErrorMessage}
        </AtlasStatusMessage>
      ) : null}

      {directoryError ? (
        <AtlasStatusMessage tone="error">
          County geography is temporarily unavailable.
        </AtlasStatusMessage>
      ) : null}

      {!measuresLoading &&
      !measuresErrorMessage &&
      metadata &&
      measures.length === 0 ? (
        <AtlasStatusMessage tone="empty">
          This release does not publish county measures for Explore.
        </AtlasStatusMessage>
      ) : null}

      {requestCopy ? (
        <div data-testid="explore-request-status">
          <AtlasStatusMessage tone={requestCopy.tone}>
            {requestCopy.message}
          </AtlasStatusMessage>
        </div>
      ) : null}

      {!committed && observationsError ? (
        <AtlasStatusMessage tone="error">
          The selected measure could not be loaded.
        </AtlasStatusMessage>
      ) : null}

      {!committed && observationsLoading ? (
        <AtlasStatusMessage tone="loading">
          Loading measure values…
        </AtlasStatusMessage>
      ) : null}

      {committed ? (
        <div
          className="ux-reset-explore-results"
          data-displayed-map-scope={committed.mapScope}
          data-displayed-measure-id={committed.measureId}
          data-displayed-period={committed.observationPeriod}
          data-displayed-unit={committed.unit}
          data-request-measure-id={requestedMeasureId ?? ""}
          data-testid="explore-results"
        >
          <p
            className="type-body"
            data-availability={focusedRow?.availability ?? "unavailable"}
            data-map-scope={committed.mapScope}
            data-measure-id={committed.measureId}
            data-period={committed.observationPeriod}
            data-testid="explore-layer-identity"
            data-unit={committed.unit}
          >
            Showing <strong>{committed.measureLabel}</strong> in{" "}
            {committedScopeLabel}. Unit {committed.unit}. Observation period{" "}
            {committed.observationPeriod}.
            {focusedRow ? (
              <>
                {" "}
                Selected county availability{" "}
                {evidenceAvailabilityLabel(focusedRow.availability)}.
              </>
            ) : null}
          </p>

          <div className="ux-reset-explore-layout">
            <Card className="map-card gap-0 py-0">
              <AtlasSectionHeader
                className="card-title-row"
                eyebrow="Geographic pattern"
                headingLevel="h2"
                title={committed.measureLabel}
              />
              <ExploreMapPanel
                committed={committed}
                geometry={geometry}
                geometryError={geometryError}
                geometryLoading={geometryLoading}
                geometryReleaseId={geometryReleaseId}
                selectedFips={focusedFips}
                onRetryGeometry={retryGeometry}
                onSelectCounty={setCounty}
              />
              <div
                aria-label={`${committed.measureLabel} map legend`}
                className="legend"
                data-measure-id={committed.measureId}
                data-period={committed.observationPeriod}
                data-testid="explore-map-legend"
                data-unit={committed.unit}
                role="group"
              >
                <span>Lower value</span>
                <span aria-hidden="true" className="legend-ramp">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>Higher value</span>
                <small>
                  {committed.measureLabel}, {committed.unit},{" "}
                  {committed.observationPeriod}. Neutral color means no numeric
                  governed value.
                </small>
              </div>
            </Card>

            <Card className="ux-reset-explore-selection">
              <AtlasSectionHeader
                className="card-title-row"
                eyebrow="Selected geography"
                headingLevel="h2"
                title={
                  focusedRow
                    ? `${focusedRow.countyName}, ${focusedRow.stateName || focusedRow.state}`
                    : "Choose a county"
                }
              />
              <div data-testid="explore-selected-evidence">
                {focusedRow?.evidence ? (
                  <EvidenceObject model={focusedRow.evidence} />
                ) : (
                  <p data-testid="evidence-display-value">Unavailable</p>
                )}
              </div>
              <div className="ux-reset-explore-actions">
                <Link
                  className={cn(buttonVariants(), "ux-reset-explore-action")}
                  data-testid="explore-investigate"
                  data-variant="primary"
                  href={investigateHref}
                >
                  Investigate this county
                </Link>
                <Link
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "ux-reset-explore-action"
                  )}
                  data-testid="explore-compare"
                  data-variant="secondary"
                  href={compareHref}
                >
                  Open Compare
                </Link>
                <Button
                  disabled={!focusedFips}
                  type="button"
                  variant="outline"
                  onClick={() => {
                    if (!focusedFips) {
                      return;
                    }
                    if (pairIncludesFocused) {
                      setComparePair(
                        parseCompareFipsList(
                          effectiveComparePair
                            .filter((fips) => fips !== focusedFips)
                            .join(",")
                        )
                      );
                      return;
                    }
                    setComparePair(
                      replaceCompareMember(effectiveComparePair, focusedFips)
                    );
                  }}
                >
                  {compareActionLabel}
                </Button>
                <Button
                  disabled={effectiveComparePair.length === 0}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setComparePair([]);
                  }}
                >
                  Clear compare
                </Button>
              </div>
              <div
                data-fips={effectiveComparePair.join(",")}
                data-testid="explore-compare-selection"
              >
                <p className="type-small">Compare selection</p>
                {effectiveComparePair.length === 0 ? (
                  <p className="type-small">None yet</p>
                ) : (
                  <ul className="ux-reset-explore-compare-pair">
                    {effectiveComparePair.map((fips) => {
                      const member = committed.rows.find(
                        (row) => row.fips === fips
                      );
                      const label = member
                        ? `${member.countyName}, ${member.stateName || member.state} ${fips}`
                        : fips;
                      return (
                        <li key={fips}>
                          <span>{label}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() => {
                              setComparePair(
                                parseCompareFipsList(
                                  effectiveComparePair
                                    .filter((item) => item !== fips)
                                    .join(",")
                                )
                              );
                            }}
                          >
                            Remove {label}
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </Card>
          </div>

          <section
            aria-label="County values"
            data-testid="explore-county-table"
          >
            <AtlasSectionHeader
              eyebrow="Same measure, without the map"
              headingLevel="h2"
              title="County values in alphabetical order"
            />
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>County</TableHead>
                  <TableHead>Value</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Observation period</TableHead>
                  <TableHead>Availability</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {committed.rows.map((row) => (
                  <TableRow
                    key={row.fips}
                    data-availability={row.availability}
                    data-fips={row.fips}
                    data-measure-id={committed.measureId}
                    data-period={row.observationPeriod}
                    data-testid="explore-county-row"
                    data-unit={row.unit}
                  >
                    <TableCell>
                      <Button
                        aria-pressed={row.fips === focusedFips}
                        type="button"
                        variant={
                          row.fips === focusedFips ? "secondary" : "ghost"
                        }
                        onClick={() => setCounty(row.fips)}
                      >
                        {`${row.countyName}, ${row.stateName || row.state} ${row.fips}`}
                      </Button>
                    </TableCell>
                    <TableCell>{row.displayValue}</TableCell>
                    <TableCell>{row.unit}</TableCell>
                    <TableCell>{row.observationPeriod}</TableCell>
                    <TableCell>
                      {evidenceAvailabilityLabel(row.availability)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      ) : null}
    </div>
  );
}

export function ResetExploreExperience() {
  return (
    <Suspense
      fallback={
        <AtlasStatusMessage tone="loading">Loading explore…</AtlasStatusMessage>
      }
    >
      <ResetExploreExperienceInner />
    </Suspense>
  );
}
