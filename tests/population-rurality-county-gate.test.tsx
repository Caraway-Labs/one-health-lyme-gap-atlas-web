import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { ExplorerCountyEvidence } from "@/features/ux-reset/review/explorer-county-evidence";
import type { ListObservationsParams } from "@/generated/models";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").listObservations>()
);
const workspace = vi.hoisted(() => ({
  current: null as InvestigateWorkspace | null,
}));

vi.mock(import("@/generated/atlas"), async () => {
  const actual =
    await vi.importActual<typeof import("@/generated/atlas")>(
      "@/generated/atlas"
    );
  return {
    ...actual,
    listObservations: observationsGet,
  };
});

vi.mock(
  import("@/features/ux-reset/investigate/use-investigate-workspace"),
  () => ({
    useInvestigateWorkspace: () => {
      if (!workspace.current) {
        throw new Error("Population gate workspace was not set.");
      }
      return workspace.current;
    },
  })
);

vi.mock(
  import("@/features/ux-reset/surveillance-priority/tier1-surveillance-priority"),
  () => ({
    Tier1SurveillancePriority: () => <p data-testid="tier1-stub" />,
  })
);

const SAMPLE_FIPS = "08001";

function baseWorkspace(
  overrides: Partial<InvestigateWorkspace> = {}
): InvestigateWorkspace {
  return {
    bundle: null,
    catalogError: null,
    catalogRefreshError: null,
    compare: [],
    countyRecord: null,
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
    recovery: null,
    releaseId: "alpha-2026",
    requestedDataset: null,
    requestedFips: SAMPLE_FIPS,
    retryDirectory: vi.fn<() => void>(),
    retryEvidence: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    scope: "CO",
    scopeLabel: "Colorado",
    selection: { fips: SAMPLE_FIPS, kind: "county" },
    setCounty: vi.fn<(fips: string) => void>(),
    stateLabel: "Colorado (CO)",
    countyDetail: null,
    suggestedFollowUpEvidence: null,
    ...overrides,
  };
}

function renderCard(overrides: Partial<InvestigateWorkspace>) {
  workspace.current = baseWorkspace(overrides);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ExplorerCountyEvidence
        followUp={{ status: "factual" }}
        methodologyLabel={null}
        mode="evidence"
        onBackToMap={vi.fn<() => void>()}
      />
    </QueryClientProvider>
  );
}

function vintageCalls(): ListObservationsParams[] {
  return observationsGet.mock.calls
    .map((call) => call[0])
    .filter(
      (params): params is ListObservationsParams => params?.vintage_year != null
    );
}

async function settle(): Promise<void> {
  const gate = Promise.withResolvers<boolean>();
  setTimeout(() => {
    gate.resolve(true);
  }, 40);
  await gate.promise;
}

describe("population and rurality county gate", () => {
  afterEach(() => {
    cleanup();
    observationsGet.mockReset();
    workspace.current = null;
  });

  it("does not request context while the directory is unresolved", async () => {
    const loading = renderCard({ directoryLoading: true });
    await settle();
    const loadingCalls = vintageCalls().length;
    const loadingText = loading.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    const failed = renderCard({
      directoryError: "The published county list could not be loaded.",
      recovery: "directory",
    });
    await settle();
    const failedCalls = vintageCalls().length;
    const failedText = failed.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    const rejected = renderCard({ recovery: "unsupported" });
    await settle();
    const rejectedCalls = vintageCalls().length;
    const rejectedText = rejected.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    observationsGet.mockResolvedValue({
      data: { data: [], links: { self: null }, meta: {} },
      headers: new Headers(),
      status: 200,
    });
    renderCard({
      identity: { fips: SAMPLE_FIPS, label: "Adams", stateCode: "CO" },
    });
    await waitFor(() => {
      if (vintageCalls().length < 5) {
        throw new Error("The validated county did not request context.");
      }
    });
    const requested = vintageCalls();

    expect({
      failedCalls,
      failedText: failedText.includes("did not load"),
      loadingCalls,
      loadingText: loadingText.includes(
        "Loading the published county list before population and rurality observations"
      ),
      rejectedCalls,
      rejectedText: rejectedText.includes("not in the published directory"),
      vintages: requested.map((params) => params.vintage_year).sort(),
      withoutDates: requested.every(
        (params) =>
          params.year == null &&
          params.start_date == null &&
          params.end_date == null
      ),
    }).toStrictEqual({
      failedCalls: 0,
      failedText: true,
      loadingCalls: 0,
      loadingText: true,
      rejectedCalls: 0,
      rejectedText: true,
      vintages: [2022, 2022, 2022, 2022, 2023],
      withoutDates: true,
    });
  });
});
