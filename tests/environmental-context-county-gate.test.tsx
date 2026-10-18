import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { InvestigateWorkspace } from "@/features/ux-reset/investigate/use-investigate-workspace";
import { ExplorerCountyEvidence } from "@/features/ux-reset/review/explorer-county-evidence";

const observationsGet = vi.hoisted(() =>
  vi.fn<typeof import("@/generated/atlas").observationsV1ObservationsGet>()
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
    observationsV1ObservationsGet: observationsGet,
  };
});

vi.mock(
  import("@/features/ux-reset/investigate/use-investigate-workspace"),
  () => ({
    useInvestigateWorkspace: () => {
      if (!workspace.current) {
        throw new Error("Environmental gate workspace was not set.");
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

const SAMPLE_FIPS = "48277";

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
    releaseId: "governed-2026-10-15-january-climate-prod",
    requestedDataset: null,
    requestedFips: SAMPLE_FIPS,
    retryDirectory: vi.fn<() => void>(),
    retryEvidence: vi.fn<() => Promise<void>>(() => Promise.resolve()),
    scope: "TX",
    scopeLabel: "Texas",
    selection: { fips: SAMPLE_FIPS, kind: "county" },
    setCounty: vi.fn<(fips: string) => void>(),
    stateLabel: "Texas (TX)",
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

async function requestCount(): Promise<number> {
  const gate = Promise.withResolvers<boolean>();
  setTimeout(() => {
    gate.resolve(true);
  }, 40);
  await gate.promise;
  return observationsGet.mock.calls.length;
}

describe("environmental context county gate", () => {
  afterEach(() => {
    cleanup();
    observationsGet.mockReset();
    workspace.current = null;
  });

  it("does not request observations while the directory is unresolved", async () => {
    const loading = renderCard({ directoryLoading: true });
    const loadingCalls = await requestCount();
    const loadingText = loading.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    const failed = renderCard({
      directoryError: "The published county list could not be loaded.",
      recovery: "directory",
    });
    const failedCalls = await requestCount();
    const failedText = failed.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    const rejected = renderCard({ recovery: "unsupported" });
    const rejectedCalls = await requestCount();
    const rejectedText = rejected.container.textContent ?? "";
    cleanup();
    observationsGet.mockClear();

    observationsGet.mockResolvedValue({
      data: { data: [], links: { self: null }, meta: {} },
      headers: new Headers(),
      status: 200,
    });
    renderCard({
      identity: { fips: SAMPLE_FIPS, label: "Gonzales", stateCode: "TX" },
    });
    await waitFor(() => {
      if (observationsGet.mock.calls.length === 0) {
        throw new Error("The validated county did not request observations.");
      }
    });

    expect({
      failedCalls,
      failedText: failedText.includes("did not load"),
      loadingCalls,
      loadingText: loadingText.includes("Loading the published county list"),
      rejectedCalls,
      rejectedText: rejectedText.includes("not in the published directory"),
      validatedCalls: observationsGet.mock.calls.length > 0,
    }).toStrictEqual({
      failedCalls: 0,
      failedText: true,
      loadingCalls: 0,
      loadingText: true,
      rejectedCalls: 0,
      rejectedText: true,
      validatedCalls: true,
    });
  });
});
