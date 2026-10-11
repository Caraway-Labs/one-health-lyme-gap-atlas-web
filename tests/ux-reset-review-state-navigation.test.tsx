import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  ReviewNationalOrientation,
  ReviewNationalOrientationView,
} from "@/features/ux-reset/review/review-national-orientation";
import { lower48ReviewPostalCodes } from "@/features/ux-reset/review/review-state-fips";
import {
  filterReviewStateNavigationEntries,
  reviewMapErrorFailure,
  reviewNavigationMapPhase,
  reviewNavigationMapRetryable,
  reviewNavigationMapStatus,
  reviewNavigationStatusText,
  reviewStateContractSummary,
  reviewStateNavigationCopy,
  reviewStateNavigationEntries,
  reviewStateNavigationFeatures,
  reviewStateNavigationLabel,
  type ReviewNavigationMapPhase,
  type ReviewStateNavigationEntry,
} from "@/features/ux-reset/review/review-state-navigation";
import type { CountyDisplayGeometryFeatureCollection } from "@/lib/county-geography";

const geometryControls = vi.hoisted(() => ({
  mode: "polygons" as "empty" | "error" | "pending" | "polygons",
}));

vi.mock(import("maplibre-gl"), () => ({
  Map: vi.fn<() => never>(() => {
    throw new Error("MapLibre construct is covered in the map lifecycle test.");
  }),
  setWorkerUrl: vi.fn<(url: string) => void>(),
}));

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<
      () => Promise<CountyDisplayGeometryFeatureCollection>
    >(async () => {
      switch (geometryControls.mode) {
        case "pending": {
          return Promise.withResolvers<CountyDisplayGeometryFeatureCollection>()
            .promise;
        }
        case "error": {
          throw new Error("boundary failed");
        }
        case "empty": {
          return pointCollection();
        }
        case "polygons": {
          return navigationGeometry();
        }
        default: {
          const exhaustive: never = geometryControls.mode;
          return exhaustive;
        }
      }
    }),
  };
});

const EMPTY_MAP_CODES: readonly string[] = [];

const releaseStates = [
  { code: "CO", name: "Colorado" },
  { code: "NY", name: "New York" },
  { code: "PR", name: "Puerto Rico" },
] as const;

const catalog = reviewStateNavigationEntries(releaseStates);
const viewCatalog: ReviewStateNavigationEntry[] = [
  entry("CO", "supported", "Colorado"),
  entry("NY", "supported", "New York"),
  entry("PR", "unsupported", "Puerto Rico"),
  entry("WY", "unavailable"),
];

function pointCollection(): CountyDisplayGeometryFeatureCollection {
  return {
    features: [
      {
        geometry: { coordinates: [-105, 39], type: "Point" },
        properties: { fips: "08001" },
        type: "Feature",
      },
    ],
    type: "FeatureCollection",
  };
}

function navigationGeometry(): CountyDisplayGeometryFeatureCollection {
  return {
    features: [
      box("08001", -105.5, 39.5, -104.5, 40.2),
      box("08013", -105.6, 39.9, -105.1, 40.3),
      box("11001", -77.1, 38.8, -76.9, 39),
      box("56001", -111, 41, -104, 45),
      {
        geometry: { coordinates: [-105, 39], type: "Point" },
        properties: { fips: "08031" },
        type: "Feature",
      },
      box("99999", -100, 30, -99, 31),
    ],
    type: "FeatureCollection",
  };
}

function box(
  fips: string,
  west: number,
  south: number,
  east: number,
  north: number
): CountyDisplayGeometryFeatureCollection["features"][number] {
  return {
    geometry: {
      coordinates: [
        [
          [west, south],
          [east, south],
          [east, north],
          [west, north],
          [west, south],
        ],
      ],
      type: "Polygon",
    },
    properties: { fips },
    type: "Feature",
  };
}

function entry(
  code: string,
  availability: ReviewStateNavigationEntry["availability"],
  name: string | null = null
): ReviewStateNavigationEntry {
  return { availability, code, name };
}

function statusFor(input: {
  focus?: ReviewStateNavigationEntry | null;
  hover?: ReviewStateNavigationEntry | null;
  phase: ReviewNavigationMapPhase;
  selected?: ReviewStateNavigationEntry | null;
  summary?: string | null;
  total?: number;
  visible?: number;
}): string {
  const total = input.total ?? viewCatalog.length;
  const visible = input.visible ?? total;
  return reviewNavigationStatusText({
    contractSummary: input.summary === undefined ? null : input.summary,
    focus: input.focus ?? null,
    hover: input.hover ?? null,
    phase: input.phase,
    selected: input.selected ?? null,
    totalCount: total,
    visibleCount: visible,
  });
}

describe("Review state navigation model", () => {
  afterEach(() => {
    cleanup();
    geometryControls.mode = "polygons";
  });

  it("lists lower-48 and DC from the scope contract", () => {
    const codes = lower48ReviewPostalCodes();
    expect(codes).toHaveLength(49);
    expect(codes).toContain("CO");
    expect(codes).toContain("DC");
    expect(
      reviewStateNavigationEntries([
        { code: "CO", name: "Colorado" },
        { code: "DC", name: "District of Columbia" },
      ]).filter((item) => item.availability === "supported")
    ).toStrictEqual([
      {
        availability: "supported",
        code: "CO",
        name: "Colorado",
      },
      {
        availability: "supported",
        code: "DC",
        name: "District of Columbia",
      },
    ]);
  });

  it("classifies release rows and keeps navigation properties free of scores", () => {
    const supported = catalog.find((item) => item.code === "CO");
    const unavailable = catalog.find((item) => item.code === "WY");
    const unsupported = catalog.find((item) => item.code === "PR");
    const features = reviewStateNavigationFeatures(
      navigationGeometry(),
      catalog
    );
    expect({
      catalogContract: reviewStateContractSummary(catalog),
      contract: reviewStateContractSummary([]),
      coordinateRings: features.features[0]?.geometry.coordinates.length ?? 0,
      hasScoreLanguage: features.features.some((feature) =>
        Object.keys(feature.properties).some(
          (key) =>
            key === "score" ||
            key === "priority" ||
            key === "color" ||
            key === "risk"
        )
      ),
      labels: {
        supported: supported ? reviewStateNavigationLabel(supported) : "",
        unavailable: unavailable ? reviewStateNavigationLabel(unavailable) : "",
        unsupported: unsupported ? reviewStateNavigationLabel(unsupported) : "",
      },
      properties: features.features.map((feature) => feature.properties),
    }).toStrictEqual({
      catalogContract: null,
      contract: "No supported states are listed for this release.",
      coordinateRings: 2,
      hasScoreLanguage: false,
      labels: {
        supported: "CO, Colorado",
        unavailable: "WY, not in this release",
        unsupported: "PR, not supported — lower 48 only",
      },
      properties: [
        { availability: "supported", code: "CO", name: "Colorado" },
        { availability: "unavailable", code: "DC", name: "" },
        { availability: "unavailable", code: "WY", name: "" },
      ],
    });
  });

  it.each([
    ["colo", ["CO"]],
    ["new york", ["NY"]],
    ["wy", ["WY"]],
    ["puerto", ["PR"]],
    ["zzzz", []],
  ] as const)("filters %s to %j", (query, codes) => {
    expect(
      filterReviewStateNavigationEntries(catalog, query).map(
        (item) => item.code
      )
    ).toStrictEqual([...codes]);
  });

  it.each([
    [
      "boundary-loading",
      {
        featureCount: 0,
        geometry: "loading",
        mapFailure: null,
        mapReady: false,
      },
      "Loading state boundaries…",
      false,
    ],
    [
      "boundary-failed",
      { featureCount: 0, geometry: "error", mapFailure: null, mapReady: false },
      "State boundaries are unavailable. Choose a state from the list.",
      true,
    ],
    [
      "boundary-empty",
      { featureCount: 0, geometry: "ready", mapFailure: null, mapReady: false },
      "No state boundaries are available for this release. Choose a state from the list.",
      true,
    ],
    [
      "map-loading",
      { featureCount: 2, geometry: "ready", mapFailure: null, mapReady: false },
      "Loading map…",
      false,
    ],
    [
      "webgl-unavailable",
      {
        featureCount: 2,
        geometry: "ready",
        mapFailure: "webgl",
        mapReady: false,
      },
      "The map could not start. Choose a state from the list.",
      true,
    ],
    [
      "map-load-failed",
      {
        featureCount: 2,
        geometry: "ready",
        mapFailure: "load",
        mapReady: true,
      },
      "The map could not load. Choose a state from the list.",
      true,
    ],
    [
      "ready",
      { featureCount: 2, geometry: "ready", mapFailure: null, mapReady: true },
      "The map is ready.",
      false,
    ],
  ] as const)(
    "maps %s to exact status copy",
    (phase, input, sentence, retryable) => {
      expect(reviewNavigationMapPhase(input)).toBe(phase);
      expect(reviewNavigationMapStatus(phase)).toBe(sentence);
      expect(reviewNavigationMapRetryable(phase)).toBe(retryable);
    }
  );

  it.each([
    ["Failed to load style", false, "load"],
    ["WebGL context lost", true, "webgl"],
    ["Source review-states not found", false, "load"],
    ["tile not found", true, "ignore"],
    ["style image missing", true, "ignore"],
  ] as const)("classifies map error %s as %s", (message, ready, failure) => {
    expect(reviewMapErrorFailure(message, ready)).toBe(failure);
  });

  it("renders exact interaction text for highlight, focus, and selection", () => {
    expect(
      reviewNavigationStatusText({
        contractSummary: null,
        focus: entry("NY", "supported", "New York"),
        hover: entry("CO", "supported", "Colorado"),
        phase: "ready",
        selected: entry("CO", "supported", "Colorado"),
        totalCount: 49,
        visibleCount: 49,
      })
    ).toBe(
      "Map status: The map is ready. Highlighted state: Colorado (CO). Focused state: New York (NY). Selected state: Colorado (CO). Showing 49 of 49 states."
    );
    expect(
      reviewNavigationStatusText({
        contractSummary: "No supported states are listed for this release.",
        focus: null,
        hover: entry("WY", "unavailable"),
        phase: "boundary-empty",
        selected: null,
        totalCount: 49,
        visibleCount: 0,
      })
    ).toBe(
      "Map status: No state boundaries are available for this release. Choose a state from the list. Highlighted state: WY, not in this release. Focused state: none. Selected state: none. Showing 0 of 49 states. No states match this search. No supported states are listed for this release."
    );
  });
});

describe("Review state navigation view", () => {
  afterEach(() => {
    cleanup();
  });

  const phases: ReviewNavigationMapPhase[] = [
    "boundary-loading",
    "boundary-failed",
    "boundary-empty",
    "map-loading",
    "webgl-unavailable",
    "map-load-failed",
    "ready",
  ];

  it.each(phases)("renders exact text for %s", (phase) => {
    const onActivate = vi.fn<(code: string) => void>();
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        phase={phase}
        onActivate={onActivate}
      />
    );
    expect({
      description: screen.getByText(reviewStateNavigationCopy.description)
        .textContent,
      grid: document.querySelector(".ux-reset-review-state-grid"),
      heading: screen.getByRole("heading", { name: "State orientation" })
        .textContent,
      labels: [
        screen.getByRole("button", { name: "CO, Colorado" }).textContent,
        screen.getByRole("button", { name: "WY, not in this release" })
          .textContent,
        screen.getByRole("button", {
          name: "PR, not supported — lower 48 only",
        }).textContent,
      ],
      retry: screen.queryByRole("button", { name: "Retry map" }) !== null,
      status: screen.getByTestId("review-state-navigation-status").textContent,
    }).toStrictEqual({
      description: reviewStateNavigationCopy.description,
      grid: null,
      heading: reviewStateNavigationCopy.heading,
      labels: [
        "CO, Colorado",
        "WY, not in this release",
        "PR, not supported — lower 48 only",
      ],
      retry: reviewNavigationMapRetryable(phase),
      status: statusFor({ phase }),
    });
  });

  it("filters, highlights, and activates only supported states", () => {
    const onActivate = vi.fn<(code: string) => void>();
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        phase="boundary-empty"
        onActivate={onActivate}
      />
    );
    fireEvent.click(
      screen.getByRole("button", { name: "WY, not in this release" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "PR, not supported — lower 48 only" })
    );
    const ignoredCalls = onActivate.mock.calls.length;
    fireEvent.change(screen.getByTestId("review-state-search"), {
      target: { value: "Colorado" },
    });
    const filteredStatus = screen.getByTestId(
      "review-state-navigation-status"
    ).textContent;
    const newYorkHidden =
      screen.queryByRole("button", { name: "NY, New York" }) === null;
    fireEvent.mouseEnter(screen.getByRole("button", { name: "CO, Colorado" }));
    const hoveredStatus = screen.getByTestId(
      "review-state-navigation-status"
    ).textContent;
    fireEvent.click(screen.getByRole("button", { name: "CO, Colorado" }));
    expect({
      activated: onActivate.mock.calls,
      filteredStatus,
      hoveredStatus,
      ignoredCalls,
      newYorkHidden,
      selectedStatus: screen.getByTestId("review-state-navigation-status")
        .textContent,
    }).toStrictEqual({
      activated: [["CO"]],
      filteredStatus: statusFor({ phase: "boundary-empty", visible: 1 }),
      hoveredStatus: statusFor({
        hover: entry("CO", "supported", "Colorado"),
        phase: "boundary-empty",
        visible: 1,
      }),
      ignoredCalls: 0,
      newYorkHidden: true,
      selectedStatus: statusFor({
        hover: entry("CO", "supported", "Colorado"),
        phase: "boundary-empty",
        selected: entry("CO", "supported", "Colorado"),
        visible: 1,
      }),
    });
  });

  it("activates the only search match from the keyboard and moves list focus", () => {
    const onActivate = vi.fn<(code: string) => void>();
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        phase="ready"
        onActivate={onActivate}
      />
    );
    const search = screen.getByTestId("review-state-search");
    fireEvent.change(search, { target: { value: "New York" } });
    fireEvent.keyDown(search, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledExactlyOnceWith("NY");
    fireEvent.change(search, { target: { value: "" } });
    const colorado = screen.getByRole("button", { name: "CO, Colorado" });
    colorado.focus();
    fireEvent.keyDown(colorado, { key: "ArrowDown" });
    expect(document.activeElement?.textContent).toBe("NY, New York");
    expect(
      screen.getByTestId("review-state-navigation-status").textContent
    ).toContain("Focused state: New York (NY).");
  });

  it("moves map focus with arrow keys and activates it with Enter", () => {
    const onActivate = vi.fn<(code: string) => void>();
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        mapCodes={["CO", "NY"]}
        phase="ready"
        onActivate={onActivate}
      />
    );
    const map = screen.getByTestId("review-state-navigation-map");
    fireEvent.keyDown(map, { key: "ArrowRight" });
    expect(
      screen.getByTestId("review-state-navigation-status").textContent
    ).toContain("Focused state: Colorado (CO).");
    fireEvent.keyDown(map, { key: "Enter" });
    expect(onActivate).toHaveBeenCalledExactlyOnceWith("CO");
  });
});

describe("Review state navigation requests", () => {
  afterEach(() => {
    cleanup();
    geometryControls.mode = "polygons";
  });

  it.each([
    [
      "pending",
      "Map status: Loading state boundaries… Highlighted state: none. Focused state: none. Selected state: none. Showing 49 of 49 states.",
    ],
    [
      "error",
      "Map status: State boundaries are unavailable. Choose a state from the list. Highlighted state: none. Focused state: none. Selected state: none. Showing 49 of 49 states.",
    ],
    [
      "empty",
      "Map status: No state boundaries are available for this release. Choose a state from the list. Highlighted state: none. Focused state: none. Selected state: none. Showing 49 of 49 states.",
    ],
    [
      "polygons",
      "Map status: The map could not load. Choose a state from the list. Highlighted state: none. Focused state: none. Selected state: none. Showing 49 of 49 states.",
    ],
  ] as const)("renders %s boundary state as exact text", async (mode, text) => {
    geometryControls.mode = mode;
    const onOpenState = vi.fn<(code: string) => void>();
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewNationalOrientation
          releaseId="alpha-2026"
          releaseStates={[
            { code: "CO", name: "Colorado" },
            { code: "NY", name: "New York" },
          ]}
          onOpenState={onOpenState}
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("review-state-navigation-status").textContent
      ).toBe(text);
    });
    const wyoming = screen.getByRole("button", {
      name: "WY, not in this release",
    });
    fireEvent.click(screen.getByRole("button", { name: "CO, Colorado" }));
    expect({
      activated: onOpenState.mock.calls,
      wyomingDisabled: wyoming.hasAttribute("disabled"),
    }).toStrictEqual({
      activated: [["CO"]],
      wyomingDisabled: true,
    });
  });

  it("renders an empty release without supported states", async () => {
    geometryControls.mode = "empty";
    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={client}>
        <ReviewNationalOrientation
          releaseId="alpha-2026"
          releaseStates={[]}
          onOpenState={vi.fn<(code: string) => void>()}
        />
      </QueryClientProvider>
    );
    await waitFor(() => {
      expect(
        screen.getByTestId("review-state-navigation-status").textContent
      ).toBe(
        "Map status: No state boundaries are available for this release. Choose a state from the list. Highlighted state: none. Focused state: none. Selected state: none. Showing 49 of 49 states. No supported states are listed for this release."
      );
    });
    const colorado = screen.getByRole("button", {
      name: "CO, not in this release",
    });
    expect({
      coloradoDisabled: colorado.hasAttribute("disabled"),
      supportedColorado: screen.queryByRole("button", { name: "CO, Colorado" }),
    }).toStrictEqual({
      coloradoDisabled: true,
      supportedColorado: null,
    });
  });
});

function OrientationHarness({
  initialFocus,
  initialHover,
  mapCodes = EMPTY_MAP_CODES,
  onActivate,
  phase,
}: {
  initialFocus: string | null;
  initialHover: string | null;
  mapCodes?: readonly string[];
  onActivate: (code: string) => void;
  phase: ReviewNavigationMapPhase;
}) {
  const [query, setQuery] = useState("");
  const [hoverCode, setHoverCode] = useState<string | null>(initialHover);
  const [focusCode, setFocusCode] = useState<string | null>(initialFocus);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const visible = filterReviewStateNavigationEntries(viewCatalog, query);
  return (
    <ReviewNationalOrientationView
      catalog={viewCatalog}
      contractSummary={reviewStateContractSummary(viewCatalog)}
      entries={visible}
      features={{ features: [], type: "FeatureCollection" }}
      focusCode={focusCode}
      hoverCode={hoverCode}
      mapAttempt={0}
      mapCodes={mapCodes}
      phase={phase}
      query={query}
      selectedCode={selectedCode}
      totalCount={viewCatalog.length}
      onActivate={(code) => {
        setSelectedCode(code);
        onActivate(code);
      }}
      onFocusCode={setFocusCode}
      onHoverCode={setHoverCode}
      onLoadFailed={() => {}}
      onQueryChange={setQuery}
      onReady={() => {}}
      onRetry={() => {}}
      onWebglUnavailable={() => {}}
    />
  );
}
