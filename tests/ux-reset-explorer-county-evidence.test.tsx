import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render as renderView,
  screen,
} from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

function render(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const view = renderView(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>
  );
  return {
    ...view,
    rerender(next: ReactElement) {
      view.rerender(
        <QueryClientProvider client={client}>{next}</QueryClientProvider>
      );
    },
  };
}

import { investigateBundleWithoutObservations } from "@/features/ux-reset/investigate/county-evidence";
import {
  CATALOG_REFRESH_FAILURE,
  DIRECTORY_REFRESH_FAILURE,
  INDICATOR_REFRESH_FAILURE,
  METADATA_REFRESH_FAILURE,
} from "@/features/ux-reset/investigate/investigate-request-state";
import type { InvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { ExplorerCountyEvidence } from "@/features/ux-reset/review/explorer-county-evidence";
import type { ExplorerFollowUpState } from "@/features/ux-reset/review/explorer-follow-up";
import type { SuggestedFollowUpEvidence } from "@/features/ux-reset/review/suggested-follow-up-content";
import type { CountyDetail } from "@/generated/models";

const workspace = vi.hoisted(() => ({
  current: null as InvestigateWorkspace | null,
}));

vi.mock(
  import("@/features/ux-reset/investigate/use-investigate-workspace"),
  () => ({
    useInvestigateWorkspace: () => {
      if (!workspace.current) {
        throw new Error("Explorer test workspace was not set.");
      }
      return workspace.current;
    },
  })
);

vi.mock(
  import("@/features/ux-reset/surveillance-priority/tier1-surveillance-priority"),
  () => ({
    Tier1SurveillancePriority: () => (
      <p data-testid="tier1-stub">Secondary score</p>
    ),
  })
);

vi.mock(
  import("@/features/ux-reset/investigate/investigate-hierarchy"),
  () => ({
    InvestigateEvidenceHierarchy: () => (
      <div data-testid="investigate-evidence">Observed evidence</div>
    ),
  })
);

vi.mock(
  import("@/features/ux-reset/investigate/investigate-pdf-export"),
  () => ({
    InvestigatePdfExport: () => <p data-testid="investigate-pdf">PDF</p>,
  })
);

vi.mock(
  import("@/features/ux-reset/review/environmental-context-section"),
  () => ({
    EnvironmentalContextSection: () => (
      <section
        data-testid="explorer-environmental-context"
        id="explorer-environmental-context"
      >
        Environmental context
      </section>
    ),
  })
);

vi.mock(
  import("@/features/ux-reset/review/population-rurality-context-section"),
  () => ({
    PopulationRuralityContextSection: () => (
      <section
        data-testid="explorer-population-rurality"
        id="explorer-population-rurality"
      >
        Population and rurality context
      </section>
    ),
  })
);

function baseWorkspace(
  overrides: Partial<InvestigateWorkspace> = {}
): InvestigateWorkspace {
  return {
    bundle: null,
    catalogError: null,
    catalogRefreshError: null,
    compare: [],
    countyRecord: null,
    countyDetail: null,
    countyRecordAbsent: false,
    countyRecordError: null,
    countyRecordLoading: false,
    countyRecordRefreshError: null,
    directory: [],
    directoryError: null,
    directoryLoading: false,
    directoryRefreshError: null,
    evidenceError: null,
    evidenceFetching: false,
    evidenceLoading: false,
    identity: null,
    indicatorError: null,
    indicatorRefreshError: null,
    measures: [],
    metadata: null,
    metadataError: null,
    metadataLoading: false,
    metadataRefreshError: null,
    observationOutcome: "settled-absent",
    period: null,
    recovery: "missing",
    releaseId: null,
    requestedDataset: null,
    requestedFips: null,
    retryDirectory: vi.fn<() => void>(),
    retryEvidence: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    scope: "CO",
    scopeLabel: "Colorado",
    selection: { kind: "missing" },
    setCounty: vi.fn<(fips: string) => void>(),
    stateLabel: null,
    suggestedFollowUpEvidence: null,
    ...overrides,
  };
}

function countyDetailFor(
  evidence: SuggestedFollowUpEvidence,
  fips: string
): CountyDetail {
  return {
    burgdorferi_status: evidence.burgdorferiStatus,
    case_count_floor_2023: evidence.caseCountFloor2023,
    color: evidence.color,
    county: "County",
    evidence_completeness: 0,
    fips,
    human_status: evidence.humanStatus,
    in_contiguous_tick_scope: true,
    incidence_floor_2023: evidence.incidenceFloor2023,
    pacificus_status: evidence.pacificusStatus,
    population: null,
    priority: evidence.priority,
    release: {
      bundle_sha256: "a".repeat(64),
      generated_at: "2026-01-01",
      limitations: "test",
      loaded_at: "2026-01-01",
      methodology_version: "test",
      release_id: "alpha-2026",
      schema_version: "test",
      scope: "test",
      score_defaults: {} as never,
      sources: [],
      states: [],
    },
    rucc_2023: evidence.rucc2023,
    scapularis_status: evidence.scapularisStatus,
    score: {
      access_signal: 0,
      community: 0,
      ecological: 0,
      human_weakness: 0,
      pathogen_signal: 0,
      rural_signal: 0,
      score: 0,
      svi_signal: 0,
      tick_signal: 0,
    },
    state: "CO",
    state_name: "Colorado",
    state_unallocated_records_2023: null,
    svi_percentile: evidence.sviPercentile,
    tick_status: evidence.tickStatus,
    uninsured_percent: evidence.uninsuredPercent,
    uninsured_percentile: evidence.uninsuredPercentile,
  };
}

function publishedFollowUp(
  overrides: Partial<SuggestedFollowUpEvidence> = {}
): SuggestedFollowUpEvidence {
  return {
    burgdorferiStatus: "Present",
    caseCountFloor2023: 4,
    color: "#e9602b",
    comparableReportingPeriods: null,
    humanStatus: "published_count_floor",
    incidenceFloor2023: 20,
    lowIncidenceBreakpoint: 10,
    pacificusStatus: "No records",
    priority: "Priority 1 — Investigate",
    rucc2023: null,
    scapularisStatus: "Established",
    sviPercentile: null,
    tickStatus: "Established",
    uninsuredPercent: null,
    uninsuredPercentile: null,
    ...overrides,
  };
}

function candidateFollowUp(
  limitation = "Collection dates are unavailable for this status."
): ExplorerFollowUpState {
  return {
    category: "PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW",
    firstStep: "Review the cited source records.",
    limitations: [limitation],
    rationale: "Denver is included because the review method returned it.",
    status: "candidate",
  };
}

describe("Explorer county evidence", () => {
  afterEach(() => {
    cleanup();
    workspace.current = null;
  });

  it("shows a missing-county prompt and withholds compare, ask, and export", () => {
    workspace.current = baseWorkspace();
    const onBackToMap = vi.fn<() => void>();
    render(
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={onBackToMap}
      />
    );
    expect(screen.getByTestId("explorer-recovery")).toHaveAttribute(
      "data-recovery",
      "missing"
    );
    expect(screen.getByTestId("explorer-county-heading")).toHaveTextContent(
      "Choose a county"
    );
    expect(screen.getByTestId("explorer-county-heading")).toHaveFocus();
    expect(screen.queryByTestId("explorer-compare")).toBeNull();
    expect(screen.queryByTestId("explorer-ask-atlas")).toBeNull();
  });

  it("keeps export withheld and returns to the map without showing zero", () => {
    workspace.current = baseWorkspace();
    const onBackToMap = vi.fn<() => void>();
    render(
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={onBackToMap}
      />
    );
    expect(screen.getByTestId("explorer-export-unavailable")).toBeVisible();
    expect(
      screen.getByRole("heading", { name: "Context and gaps" })
    ).toBeVisible();
    fireEvent.click(screen.getByTestId("explorer-back-to-map"));
    expect(onBackToMap).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId("explorer-county-evidence").textContent
    ).not.toMatch(/\b0 cases\b/);
  });

  it("focuses suggested follow-up and keeps the published response free of deadlines", () => {
    workspace.current = baseWorkspace({
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08001",
      stateLabel: "Colorado (CO)",
      suggestedFollowUpEvidence: publishedFollowUp(),
      countyDetail: countyDetailFor(publishedFollowUp(), "08001"),
    });
    render(
      <ExplorerCountyEvidence
        followUp={candidateFollowUp()}
        methodologyLabel="Method atlas-county-review 1.0.0. Release alpha-2026."
        mode="follow-up"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(
      screen.getByRole("heading", { name: "Suggested follow-up" })
    ).toHaveFocus();
    expect(screen.getByTestId("explorer-follow-up-response")).toHaveTextContent(
      "Prioritize targeted follow-up"
    );
    expect(screen.getByTestId("explorer-review-priority")).toHaveTextContent(
      "Highest review priority"
    );
    const followUpText =
      screen.getByTestId("explorer-follow-up").textContent ?? "";
    expect(screen.getByTestId("explorer-summary-reason")).toHaveTextContent(
      "Denver is included because the review method returned it."
    );
    expect(followUpText).not.toMatch(
      /Denver is included because the review method returned it\.|2 weeks|within 60|Conduct targeted follow-up|Coordinate a local assessment/i
    );
  });

  it("updates the follow-up response when the selected county changes", () => {
    workspace.current = baseWorkspace({
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08001",
      stateLabel: "Colorado (CO)",
      suggestedFollowUpEvidence: publishedFollowUp({
        color: "#a9d2db",
        priority: "Lower Atlas priority — Not a safety finding",
      }),
      countyDetail: countyDetailFor(
        publishedFollowUp({
          color: "#a9d2db",
          priority: "Lower Atlas priority — Not a safety finding",
        }),
        "08001"
      ),
    });
    const view = render(
      <ExplorerCountyEvidence
        followUp={candidateFollowUp()}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(screen.getByTestId("explorer-follow-up-response")).toHaveTextContent(
      "Continue routine review"
    );
    workspace.current = baseWorkspace({
      identity: { fips: "08013", label: "Boulder", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08013",
      stateLabel: "Colorado (CO)",
      suggestedFollowUpEvidence: publishedFollowUp({
        color: "#87b982",
        humanStatus: "no_county_linked_record",
        incidenceFloor2023: null,
        priority: "Watch — Monitor signals",
      }),
      countyDetail: countyDetailFor(
        publishedFollowUp({
          color: "#87b982",
          humanStatus: "no_county_linked_record",
          incidenceFloor2023: null,
          priority: "Watch — Monitor signals",
        }),
        "08013"
      ),
    });
    view.rerender(
      <ExplorerCountyEvidence
        followUp={candidateFollowUp("Boulder limitation stays on Boulder.")}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect({
      conflict: screen.getByTestId("explorer-review-priority").dataset
        .categoryConflict,
      county: screen.getByTestId("explorer-follow-up").dataset.county,
      priority: screen.getByTestId("explorer-review-priority").textContent,
      response: screen.getByTestId("explorer-follow-up-response").textContent,
    }).toStrictEqual({
      conflict: "true",
      county: "08013",
      priority: "Review priority: Monitor for changes",
      response: "Verify with local information",
    });
    expect(screen.queryByTestId("explorer-summary-limitation")).toBeNull();
    expect(
      screen.queryByText("Boulder limitation stays on Boulder.")
    ).toBeNull();
  });

  it("carries the county into Compare and Ask Atlas without copying mode to Ask Atlas", () => {
    workspace.current = baseWorkspace({
      identity: { fips: "08013", label: "Boulder", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08013",
      stateLabel: "Colorado (CO)",
    });
    render(
      <ExplorerCountyEvidence
        followUp={candidateFollowUp("Boulder limitation stays on Boulder.")}
        methodologyLabel={null}
        mode="follow-up"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    const compareHref =
      screen.getByTestId("explorer-compare").getAttribute("href") ?? "";
    expect(compareHref).toContain("mode=follow-up");
    expect(compareHref).toContain("return=review");
    expect(compareHref).toContain("county=08013");
    const askHref =
      screen.getByTestId("explorer-ask-atlas").getAttribute("href") ?? "";
    expect(askHref).toContain("/askatlas");
    expect(askHref).not.toContain("mode=");
  });

  it("withholds Compare until the requested county matches a published identity", () => {
    workspace.current = baseWorkspace({
      recovery: "unsupported",
      requestedFips: "08014",
      stateLabel: "Colorado (CO)",
    });
    const view = render(
      <ExplorerCountyEvidence
        followUp={{ status: "not-in-scope" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(screen.queryByTestId("explorer-compare")).toBeNull();
    expect(screen.getByTestId("explorer-recovery")).toHaveAttribute(
      "data-recovery",
      "unsupported"
    );
    workspace.current = baseWorkspace({
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08001",
      stateLabel: "Colorado (CO)",
    });
    view.rerender(
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    const href =
      screen.getByTestId("explorer-compare").getAttribute("href") ?? "";
    expect(href).toContain("county=08001");
    expect(href).not.toContain("08014");
  });

  it("shows refresh failures beside the cached evidence hierarchy", () => {
    const identity = { fips: "08001", label: "Denver", stateCode: "CO" };
    workspace.current = baseWorkspace({
      bundle: investigateBundleWithoutObservations({
        county: identity,
        releaseId: "alpha-2026",
      }),
      catalogRefreshError: CATALOG_REFRESH_FAILURE,
      directoryRefreshError: DIRECTORY_REFRESH_FAILURE,
      identity,
      indicatorRefreshError: INDICATOR_REFRESH_FAILURE,
      metadataRefreshError: METADATA_REFRESH_FAILURE,
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08001",
    });
    render(
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    const page =
      screen.getByTestId("explorer-county-evidence").textContent ?? "";
    expect(screen.getByTestId("investigate-evidence")).toBeVisible();
    expect(page).toContain(METADATA_REFRESH_FAILURE);
    expect(page).toContain(DIRECTORY_REFRESH_FAILURE);
    expect(page).toContain(CATALOG_REFRESH_FAILURE);
    expect(page).toContain(INDICATOR_REFRESH_FAILURE);
  });

  it("keeps an evidence error distinct from an empty county", () => {
    workspace.current = baseWorkspace({
      evidenceError: "County evidence is temporarily unavailable.",
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      requestedFips: "08001",
    });
    render(
      <ExplorerCountyEvidence
        followUp={{ status: "request-failed" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(
      screen.getByText("County evidence is temporarily unavailable.")
    ).toBeVisible();
    expect(screen.getByTestId("explorer-review-category")).toHaveTextContent(
      "Review category is not shown because the review result did not load."
    );
    expect(
      screen.getByRole("heading", { name: "Why review this county?" })
    ).toBeVisible();
    expect(screen.queryByTestId("explorer-summary-reason")).toBeNull();
    expect(screen.queryByTestId("investigate-evidence")).toBeNull();
  });

  it("shows loading without a settled evidence hierarchy", () => {
    workspace.current = baseWorkspace({
      evidenceLoading: true,
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      requestedFips: "08001",
    });
    render(
      <ExplorerCountyEvidence
        followUp={{ status: "loading" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(screen.getByText("Loading county evidence…")).toBeVisible();
    expect(screen.getByTestId("explorer-review-category")).toHaveTextContent(
      "Review category is loading with the review result."
    );
    expect(screen.queryByTestId("investigate-evidence")).toBeNull();
  });

  it("keeps every governed limitation through mode and county changes", () => {
    const denverLimitations = [
      "Cumulative status only",
      "Collection date unavailable",
      "Pathogen/vector species attribution unavailable",
    ];
    workspace.current = baseWorkspace({
      identity: { fips: "08001", label: "Denver", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08001",
      stateLabel: "Colorado (CO)",
      suggestedFollowUpEvidence: publishedFollowUp(),
    });
    const denverFollowUp = {
      ...candidateFollowUp(denverLimitations[0]),
      limitations: denverLimitations,
    };
    const view = render(
      <ExplorerCountyEvidence
        followUp={denverFollowUp}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect({
      category: screen.getByTestId("explorer-review-category").textContent,
      firstLimitation: screen.queryByText(denverLimitations[0] ?? ""),
      heading: screen.queryByText("Review limitations"),
      list: screen.queryByTestId("explorer-review-limitations"),
      reason: screen.getByTestId("explorer-summary-reason").textContent,
    }).toStrictEqual({
      category: "Review category PATHOGEN_PRESENT_VECTOR_REPORTED_REVIEW.",
      firstLimitation: null,
      heading: null,
      list: null,
      reason: "Denver is included because the review method returned it.",
    });
    view.rerender(
      <ExplorerCountyEvidence
        followUp={denverFollowUp}
        methodologyLabel={null}
        mode="follow-up"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect(screen.queryByTestId("explorer-review-limitations")).toBeNull();
    workspace.current = baseWorkspace({
      identity: { fips: "08013", label: "Boulder", stateCode: "CO" },
      recovery: null,
      releaseId: "alpha-2026",
      requestedFips: "08013",
      stateLabel: "Colorado (CO)",
      suggestedFollowUpEvidence: publishedFollowUp({
        color: "#87b982",
        priority: "Watch — Monitor signals",
      }),
    });
    view.rerender(
      <ExplorerCountyEvidence
        followUp={candidateFollowUp("Boulder limitation stays on Boulder.")}
        methodologyLabel={null}
        mode="follow-up"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    expect({
      boulderLimitation: screen
        .getByTestId("explorer-follow-up")
        .textContent?.includes("Boulder limitation stays on Boulder."),
      summaryReason: screen.getByTestId("explorer-summary-reason").textContent,
    }).toStrictEqual({
      boulderLimitation: false,
      summaryReason:
        "Denver is included because the review method returned it.",
    });
  });

  it("keeps an unstarted county read distinct from a missing record", () => {
    const viewFor = (overrides: Partial<InvestigateWorkspace>) => {
      workspace.current = baseWorkspace({
        identity: { fips: "08001", label: "Denver", stateCode: "CO" },
        recovery: null,
        releaseId: "alpha-2026",
        requestedFips: "08001",
        stateLabel: "Colorado (CO)",
        ...overrides,
      });
    };
    const mark = (text: string) => {
      if (text.includes("Loading suggested follow-up")) {
        return "loading";
      }
      if (text.includes("required request failed")) {
        return "error";
      }
      if (text.includes("No published county record")) {
        return "absent";
      }
      if (text.includes("Choose a county")) {
        return "waiting";
      }
      return "other";
    };
    viewFor({ metadataLoading: true });
    const view = render(
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="follow-up"
        onBackToMap={vi.fn<() => void>()}
      />
    );
    const states = [
      mark(screen.getByTestId("explorer-follow-up").textContent ?? ""),
    ];
    for (const overrides of [
      { directoryLoading: true },
      { metadataError: "Release metadata could not be loaded." },
      {
        directoryError: "The published county list could not be loaded.",
        recovery: "directory" as const,
      },
      { countyRecordAbsent: true },
    ]) {
      viewFor(overrides);
      view.rerender(
        <ExplorerCountyEvidence
          followUp={{ status: "factual" }}
          methodologyLabel={null}
          mode="follow-up"
          onBackToMap={vi.fn<() => void>()}
        />
      );
      states.push(
        mark(screen.getByTestId("explorer-follow-up").textContent ?? "")
      );
    }
    expect(states).toStrictEqual([
      "loading",
      "loading",
      "error",
      "error",
      "absent",
    ]);
  });
});
