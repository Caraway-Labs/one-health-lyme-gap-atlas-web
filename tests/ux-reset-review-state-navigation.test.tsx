import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

type MapLibreModule = typeof import("maplibre-gl");

import {
  ReviewNationalOrientation,
  ReviewNationalOrientationView,
} from "@/features/ux-reset/review/review-national-orientation";
import { lower48ReviewPostalCodes } from "@/features/ux-reset/review/review-state-fips";
import {
  filterReviewStateNavigationEntries,
  reviewMapErrorFailure,
  reviewNavigationFocusAnnouncement,
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
import {
  countyDisplayGeometryQueryKey,
  type CountyDisplayGeometryFeatureCollection,
} from "@/lib/county-geography";

const geometryControls = vi.hoisted(() => ({
  mode: "polygons" as "empty" | "error" | "pending" | "polygons",
  releasePromises: new Map<
    string,
    Promise<CountyDisplayGeometryFeatureCollection>
  >(),
}));

const mapEngine = vi.hoisted(() => {
  type Handler = (event?: unknown) => void;
  let construct: "manual" | "throw" = "throw";

  class FakeMap {
    canvas = { style: { cursor: "" } };
    dataUpdates = 0;
    handlers = new Map<string, Handler[]>();
    jumped = false;
    layers = 0;
    removed = false;
    resized = false;
    sources = new Set<string>();
    states = 0;

    constructor() {
      if (construct === "throw") {
        throw new Error(
          "MapLibre construct is covered in the map lifecycle test."
        );
      }
      instances.push(this);
    }

    on(event: string, layerOrHandler: string | Handler, handler?: Handler) {
      const key =
        typeof layerOrHandler === "string"
          ? `${event}:${layerOrHandler}`
          : event;
      const callback =
        typeof layerOrHandler === "string" ? handler : layerOrHandler;
      if (!callback) {
        return;
      }
      this.handlers.set(key, [...(this.handlers.get(key) ?? []), callback]);
    }

    emit(event: string, payload?: unknown) {
      for (const handler of this.handlers.get(event) ?? []) {
        handler(payload);
      }
    }

    addSource(id: string) {
      this.sources.add(id);
    }

    addLayer() {
      this.layers += 1;
    }

    getSource(id: string) {
      if (!this.sources.has(id)) {
        return;
      }
      return {
        setData: () => {
          this.dataUpdates += 1;
        },
      };
    }

    getCanvas() {
      return this.canvas;
    }

    resize() {
      this.resized = true;
    }

    jumpTo() {
      this.jumped = true;
    }

    setFeatureState() {
      this.states += 1;
    }

    remove() {
      this.removed = true;
    }
  }

  const instances: FakeMap[] = [];

  return {
    FakeMap,
    instances,
    reset() {
      instances.length = 0;
      construct = "throw";
    },
    setConstruct(value: "manual" | "throw") {
      construct = value;
    },
    setWorkerUrl: vi.fn<(url: string) => void>(),
  };
});

function orientationMapLibreMock(): Pick<
  MapLibreModule,
  "Map" | "setWorkerUrl"
> {
  return {
    Map: mapEngine.FakeMap as unknown as MapLibreModule["Map"],
    setWorkerUrl: mapEngine.setWorkerUrl,
  };
}

vi.mock(import("maplibre-gl"), orientationMapLibreMock);

vi.mock(import("@/lib/county-geography"), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fetchCountyDisplayGeometry: vi.fn<
      (releaseId: string) => Promise<CountyDisplayGeometryFeatureCollection>
    >(async (releaseId) => {
      const specific = geometryControls.releasePromises.get(releaseId);
      if (specific) {
        return await specific;
      }
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
] as const;

const catalog = reviewStateNavigationEntries(releaseStates);
const viewCatalog: ReviewStateNavigationEntry[] = [
  entry("CO", "supported", "Colorado"),
  entry("NY", "supported", "New York"),
  entry("DC", "unavailable"),
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
    geometryControls.releasePromises.clear();
    mapEngine.reset();
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
    const district = catalog.find((item) => item.code === "DC");
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
        district: district ? reviewStateNavigationLabel(district) : "",
        supported: supported ? reviewStateNavigationLabel(supported) : "",
        unavailable: unavailable ? reviewStateNavigationLabel(unavailable) : "",
      },
      properties: features.features.map((feature) => feature.properties),
    }).toStrictEqual({
      catalogContract: null,
      contract: "No supported states are listed for this release.",
      coordinateRings: 2,
      hasScoreLanguage: false,
      labels: {
        district: "DC, not in this release",
        supported: "CO, Colorado",
        unavailable: "WY, not in this release",
      },
      properties: [
        { availability: "supported", code: "CO", name: "Colorado" },
        {
          availability: "unavailable",
          code: "DC",
          name: "District of Columbia",
        },
        { availability: "unavailable", code: "WY", name: "Wyoming" },
      ],
    });
  });

  it("keeps geographic names for omitted states and leaves Alaska and Hawaii out", () => {
    const entries = reviewStateNavigationEntries([
      { code: "AK", name: "Alaska" },
      { code: "CO", name: "Colorado" },
      { code: "HI", name: "Hawaii" },
    ]);
    const wyoming = entries.find((item) => item.code === "WY");
    const colorado = entries.find((item) => item.code === "CO");
    const named = entries.every(
      (item) => item.name !== null && item.name.length > 0
    );
    expect({
      alaska: filterReviewStateNavigationEntries(entries, "Alaska").map(
        (item) => item.code
      ),
      colorado,
      district: filterReviewStateNavigationEntries(
        entries,
        "District of Columbia"
      ).map((item) => item.code),
      hawaii: filterReviewStateNavigationEntries(entries, "Hawaii").map(
        (item) => item.code
      ),
      length: entries.length,
      named,
      rhodeIsland: filterReviewStateNavigationEntries(
        entries,
        "Rhode Island"
      ).map((item) => item.code),
      wyoming,
    }).toStrictEqual({
      alaska: [],
      colorado: {
        availability: "supported",
        code: "CO",
        name: "Colorado",
      },
      district: ["DC"],
      hawaii: [],
      length: 49,
      named: true,
      rhodeIsland: ["RI"],
      wyoming: {
        availability: "unavailable",
        code: "WY",
        name: "Wyoming",
      },
    });
  });

  it.each([
    ["colo", ["CO"]],
    ["new york", ["NY"]],
    ["wy", ["WY"]],
    ["wyoming", ["WY"]],
    ["dc", ["DC"]],
    ["district of columbia", ["DC"]],
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
    ["Missing layer review-states-fill", false, "load"],
    ["tile not found", true, "ignore"],
    ["style image missing", true, "ignore"],
    ["Failed to fetch dynamically imported module", false, "load"],
    ["Failed to fetch dynamically imported module", true, "ignore"],
    ["404 /maplibre/maplibre-gl-worker.mjs", false, "load"],
    ["404 /maplibre/maplibre-gl-worker.mjs", true, "ignore"],
  ] as const)("classifies map error %s as %s", (message, ready, failure) => {
    expect(reviewMapErrorFailure(message, ready)).toBe(failure);
  });

  it("announces the focused state's name and availability", () => {
    expect({
      available: reviewNavigationFocusAnnouncement(
        entry("CO", "supported", "Colorado")
      ),
      none: reviewNavigationFocusAnnouncement(null),
      unavailable: reviewNavigationFocusAnnouncement(
        entry("DC", "unavailable")
      ),
    }).toStrictEqual({
      available: "Focused state: Colorado (CO), available.",
      none: "Focused state: none.",
      unavailable: "Focused state: DC, not in this release.",
    });
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
        screen.getByRole("button", { name: "DC, not in this release" })
          .textContent,
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
        "DC, not in this release",
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
      screen.getByRole("button", { name: "DC, not in this release" })
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

  it("announces filtered state-list results from a status region", () => {
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        phase="ready"
        onActivate={vi.fn<(code: string) => void>()}
      />
    );
    const results = screen.getByRole("status");
    const live = screen.getByTestId("review-state-navigation-live");
    const before = results.textContent;
    fireEvent.change(screen.getByTestId("review-state-search"), {
      target: { value: "New York" },
    });
    const filtered = results.textContent;
    fireEvent.change(screen.getByTestId("review-state-search"), {
      target: { value: "zzzz" },
    });
    expect({
      before,
      filtered,
      live: live.textContent,
      none: results.textContent,
      role: results.getAttribute("role"),
      sameNode:
        results === screen.getByTestId("review-state-navigation-results"),
    }).toStrictEqual({
      before: "Showing 4 of 4 states.",
      filtered: "Showing 1 of 4 states.",
      live: "Map status: The map is ready. Focused state: none.",
      none: "Showing 0 of 4 states. No states match this search.",
      role: "status",
      sameNode: true,
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

  it("announces each state as map and list focus move", () => {
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        mapCodes={["CO", "NY"]}
        phase="ready"
        onActivate={vi.fn<(code: string) => void>()}
      />
    );
    const live = screen.getByTestId("review-state-navigation-live");
    const map = screen.getByTestId("review-state-navigation-map");
    const announced = () => live.textContent;
    fireEvent.keyDown(map, { key: "ArrowRight" });
    const colorado = announced();
    fireEvent.keyDown(map, { key: "ArrowRight" });
    const newYork = announced();
    const listColorado = screen.getByRole("button", { name: "CO, Colorado" });
    fireEvent.focus(listColorado);
    const listFocus = announced();
    fireEvent.keyDown(listColorado, { key: "ArrowDown" });
    const listNext = announced();
    fireEvent.mouseEnter(screen.getByRole("button", { name: "NY, New York" }));
    expect({
      atomic: live.getAttribute("aria-atomic"),
      highlighted: screen.getByTestId("review-state-navigation-status")
        .textContent,
      listFocus,
      listNext,
      live: live.getAttribute("aria-live"),
      mapColorado: colorado,
      mapNewYork: newYork,
    }).toStrictEqual({
      atomic: "true",
      highlighted:
        "Map status: The map is ready. Highlighted state: New York (NY). Focused state: New York (NY). Selected state: none. Showing 4 of 4 states.",
      listFocus:
        "Map status: The map is ready. Focused state: Colorado (CO), available.",
      listNext:
        "Map status: The map is ready. Focused state: New York (NY), available.",
      live: "polite",
      mapColorado:
        "Map status: The map is ready. Focused state: Colorado (CO), available.",
      mapNewYork:
        "Map status: The map is ready. Focused state: New York (NY), available.",
    });
  });

  it("starts reverse map navigation at the last state and clears focus on leave", () => {
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
    const search = screen.getByTestId("review-state-search");
    const focused = () =>
      screen.getByTestId("review-state-navigation-status").textContent;
    const announced = () =>
      screen.getByTestId("review-state-navigation-live").textContent;
    map.focus();
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    const reverseStart = focused();
    fireEvent.keyDown(map, { key: "ArrowUp" });
    const wrappedToFirst = focused();
    fireEvent.keyDown(map, { key: "End" });
    const end = focused();
    fireEvent.keyDown(map, { key: "Home" });
    const home = focused();
    fireEvent.keyDown(map, { key: "Escape" });
    const escaped = announced();
    fireEvent.keyDown(map, { key: "Enter" });
    fireEvent.keyDown(map, { key: "ArrowRight" });
    fireEvent.blur(map, { relatedTarget: map });
    const stayedInside = focused();
    search.focus();
    fireEvent.blur(map, { relatedTarget: search });
    const includesFocus = (text: string | null, phrase: string) =>
      text?.includes(phrase) ?? false;
    const colorado = screen.getByRole("button", { name: "CO, Colorado" });
    expect({
      activated: onActivate.mock.calls,
      end: includesFocus(end, "Focused state: New York (NY)."),
      escaped,
      home: includesFocus(home, "Focused state: Colorado (CO)."),
      listCleared: colorado.dataset.focused,
      liveAfterLeave: announced(),
      reverseStart: includesFocus(
        reverseStart,
        "Focused state: New York (NY)."
      ),
      statusAfterLeave: includesFocus(focused(), "Focused state: none."),
      stayedInside: includesFocus(
        stayedInside,
        "Focused state: Colorado (CO)."
      ),
      wrappedToFirst: includesFocus(
        wrappedToFirst,
        "Focused state: Colorado (CO)."
      ),
    }).toStrictEqual({
      activated: [],
      end: true,
      escaped: "Map status: The map is ready. Focused state: none.",
      home: true,
      listCleared: "false",
      liveAfterLeave: "Map status: The map is ready. Focused state: none.",
      reverseStart: true,
      statusAfterLeave: true,
      stayedInside: true,
      wrappedToFirst: true,
    });
    map.focus();
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    expect(
      includesFocus(focused(), "Focused state: New York (NY).")
    ).toBeTruthy();
  });

  it("treats a missing map focus like nothing is focused", () => {
    render(
      <OrientationHarness
        initialFocus="ZZ"
        initialHover={null}
        mapCodes={["CO", "NY"]}
        phase="ready"
        onActivate={vi.fn<(code: string) => void>()}
      />
    );
    const map = screen.getByTestId("review-state-navigation-map");
    const focused = () =>
      screen.getByTestId("review-state-navigation-status").textContent ?? "";
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    const previous = focused();
    fireEvent.keyDown(map, { key: "ArrowRight" });
    const wrappedToFirst = focused();
    fireEvent.keyDown(map, { key: "ArrowLeft" });
    const wrappedToLast = focused();
    fireEvent.keyDown(map, { key: "Home" });
    const home = focused();
    fireEvent.keyDown(map, { key: "End" });
    const end = focused();
    fireEvent.keyDown(map, { key: "Escape" });
    fireEvent.keyDown(map, { key: "ArrowDown" });
    const next = focused();
    expect({
      end: end.includes("Focused state: New York (NY)."),
      home: home.includes("Focused state: Colorado (CO)."),
      next: next.includes("Focused state: Colorado (CO)."),
      previous: previous.includes("Focused state: New York (NY)."),
      wrappedToFirst: wrappedToFirst.includes("Focused state: Colorado (CO)."),
      wrappedToLast: wrappedToLast.includes("Focused state: New York (NY)."),
    }).toStrictEqual({
      end: true,
      home: true,
      next: true,
      previous: true,
      wrappedToFirst: true,
      wrappedToLast: true,
    });
  });

  it("moves list and search focus to the ends and skips hidden map states", () => {
    render(
      <OrientationHarness
        initialFocus={null}
        initialHover={null}
        mapCodes={["CO", "NY"]}
        phase="ready"
        onActivate={vi.fn<(code: string) => void>()}
      />
    );
    const search = screen.getByTestId("review-state-search");
    const map = screen.getByTestId("review-state-navigation-map");
    const colorado = screen.getByRole("button", { name: "CO, Colorado" });
    fireEvent.keyDown(search, { key: "ArrowUp" });
    const searchUp = document.activeElement?.textContent;
    fireEvent.keyDown(colorado, { key: "End" });
    const listEnd = document.activeElement?.textContent;
    fireEvent.keyDown(screen.getByRole("button", { name: "NY, New York" }), {
      key: "Home",
    });
    const listHome = document.activeElement?.textContent;
    fireEvent.keyDown(colorado, { key: "Escape" });
    const releasedAnnouncement = screen.getByTestId(
      "review-state-navigation-live"
    ).textContent;
    fireEvent.change(search, { target: { value: "New York" } });
    fireEvent.keyDown(map, { key: "ArrowRight" });
    const filtered = screen.getByTestId(
      "review-state-navigation-status"
    ).textContent;
    expect({
      listEnd,
      listHome,
      mapWhileFiltered:
        filtered?.includes("Focused state: New York (NY).") ?? false,
      released: document.activeElement,
      releasedAnnouncement,
      searchUp,
    }).toStrictEqual({
      listEnd: "NY, New York",
      listHome: "CO, Colorado",
      mapWhileFiltered: true,
      released: document.body,
      releasedAnnouncement:
        "Map status: The map is ready. Focused state: none.",
      searchUp: "NY, New York",
    });
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

function installResolvedMap() {
  mapEngine.setConstruct("manual");
  const readStyle = window.getComputedStyle.bind(window);
  const computed = vi
    .spyOn(window, "getComputedStyle")
    .mockImplementation((element: Element) => {
      const style = readStyle(element);
      return new Proxy(style, {
        get(target, property, receiver) {
          if (property === "color") {
            return "rgb(12, 34, 56)";
          }
          const value = Reflect.get(target, property, receiver);
          return typeof value === "function" ? value.bind(target) : value;
        },
      });
    });
  const context = vi
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockImplementation((contextId: string) => {
      if (contextId === "webgl2") {
        return {} as WebGL2RenderingContext;
      }
      return null;
    });
  return () => {
    computed.mockRestore();
    context.mockRestore();
    mapEngine.setConstruct("throw");
  };
}

function cachedGeometryClient(releaseIds: readonly string[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  for (const releaseId of releaseIds) {
    client.setQueryData(
      countyDisplayGeometryQueryKey("ux-reset-review", releaseId),
      navigationGeometry()
    );
  }
  return client;
}

function nationalOrientation(
  client: QueryClient,
  releaseId: string,
  onOpenState: (code: string) => void
) {
  return (
    <QueryClientProvider client={client}>
      <ReviewNationalOrientation
        releaseId={releaseId}
        releaseStates={[
          { code: "CO", name: "Colorado" },
          { code: "NY", name: "New York" },
        ]}
        onOpenState={onOpenState}
      />
    </QueryClientProvider>
  );
}

function mapFrame() {
  return screen.getByTestId("review-state-navigation-map");
}

async function waitForMapCount(count: number) {
  await waitFor(() => {
    if (mapEngine.instances.length !== count) {
      throw new Error(`expected ${count} map instances`);
    }
  });
  const map = mapEngine.instances[count - 1];
  if (!map) {
    throw new Error("expected a map instance");
  }
  return map;
}

function emitMap(
  map: { emit: (event: string, payload?: unknown) => void },
  event: string,
  payload?: unknown
) {
  act(() => {
    map.emit(event, payload);
  });
}

describe("Review state navigation requests", () => {
  afterEach(() => {
    cleanup();
    geometryControls.mode = "polygons";
    geometryControls.releasePromises.clear();
    mapEngine.reset();
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

  it("finds omitted states by full name", () => {
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
          onOpenState={vi.fn<(code: string) => void>()}
        />
      </QueryClientProvider>
    );
    const search = screen.getByTestId("review-state-search");
    const results = screen.getByRole("status");
    fireEvent.change(search, { target: { value: "Wyoming" } });
    const wyoming = screen.getByRole("button", {
      name: "WY, not in this release",
    });
    fireEvent.change(search, { target: { value: "Rhode Island" } });
    expect({
      coloradoHidden:
        screen.queryByRole("button", { name: "CO, Colorado" }) === null,
      results: results.textContent,
      rhodeIslandDisabled: screen
        .getByRole("button", { name: "RI, not in this release" })
        .hasAttribute("disabled"),
      wyomingDisabled: wyoming.hasAttribute("disabled"),
    }).toStrictEqual({
      coloradoHidden: true,
      results: "Showing 1 of 49 states.",
      rhodeIslandDisabled: true,
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

  it("remounts a cached release and restores the keyboard target", async () => {
    const restore = installResolvedMap();
    try {
      const onOpenState = vi.fn<(code: string) => void>();
      const client = cachedGeometryClient(["alpha-2026", "beta-2026"]);
      const view = render(
        nationalOrientation(client, "alpha-2026", onOpenState)
      );
      const first = await waitForMapCount(1);
      emitMap(first, "load");
      const initialPhase = mapFrame().dataset.mapPhase;
      const initialTab = mapFrame().getAttribute("tabindex");
      view.rerender(nationalOrientation(client, "beta-2026", onOpenState));
      const second = await waitForMapCount(2);
      const loading = {
        phase: mapFrame().dataset.mapPhase,
        removed: first.removed,
        retry: screen.queryByRole("button", { name: "Retry map" }) !== null,
        tab: mapFrame().getAttribute("tabindex"),
      };
      emitMap(second, "load");
      fireEvent.keyDown(mapFrame(), { key: "ArrowRight" });
      const status = screen.getByTestId(
        "review-state-navigation-status"
      ).textContent;
      const restored = {
        focused: status?.includes("Focused state: Colorado (CO).") ?? false,
        phase: mapFrame().dataset.mapPhase,
        tab: mapFrame().getAttribute("tabindex"),
      };
      view.unmount();
      emitMap(second, "load");
      emitMap(second, "error", {
        error: new Error("Failed to fetch dynamically imported module"),
      });
      expect({
        initialPhase,
        initialTab,
        loading,
        removed: second.removed,
        restored,
      }).toStrictEqual({
        initialPhase: "ready",
        initialTab: "0",
        loading: {
          phase: "map-loading",
          removed: true,
          retry: false,
          tab: null,
        },
        removed: true,
        restored: {
          focused: true,
          phase: "ready",
          tab: "0",
        },
      });
    } finally {
      restore();
    }
  });

  it("loads an uncached release after boundaries arrive", async () => {
    const restore = installResolvedMap();
    try {
      const deferred =
        Promise.withResolvers<CountyDisplayGeometryFeatureCollection>();
      geometryControls.releasePromises.set("beta-2026", deferred.promise);
      const onOpenState = vi.fn<(code: string) => void>();
      const client = cachedGeometryClient(["alpha-2026"]);
      const view = render(
        nationalOrientation(client, "alpha-2026", onOpenState)
      );
      const first = await waitForMapCount(1);
      emitMap(first, "load");
      view.rerender(nationalOrientation(client, "beta-2026", onOpenState));
      await waitFor(() => {
        if (mapFrame().dataset.mapPhase !== "boundary-loading") {
          throw new Error("expected boundary loading");
        }
      });
      const loading = {
        phase: mapFrame().dataset.mapPhase,
        removed: first.removed,
        retry: screen.queryByRole("button", { name: "Retry map" }) !== null,
        tab: mapFrame().getAttribute("tabindex"),
      };
      deferred.resolve(navigationGeometry());
      const second = await waitForMapCount(2);
      const beforeLoad = mapFrame().dataset.mapPhase;
      emitMap(second, "load");
      expect({
        beforeLoad,
        loading,
        ready: mapFrame().dataset.mapPhase,
        tab: mapFrame().getAttribute("tabindex"),
      }).toStrictEqual({
        beforeLoad: "map-loading",
        loading: {
          phase: "boundary-loading",
          removed: true,
          retry: false,
          tab: null,
        },
        ready: "ready",
        tab: "0",
      });
    } finally {
      restore();
    }
  });

  it("retries an unknown startup error and ignores that error after ready", async () => {
    const restore = installResolvedMap();
    try {
      const onOpenState = vi.fn<(code: string) => void>();
      const client = cachedGeometryClient(["alpha-2026"]);
      const view = render(
        nationalOrientation(client, "alpha-2026", onOpenState)
      );
      const first = await waitForMapCount(1);
      emitMap(first, "error", {
        error: new Error("Failed to fetch dynamically imported module"),
      });
      const failed = {
        phase: mapFrame().dataset.mapPhase,
        removed: first.removed,
        retry: screen.queryByRole("button", { name: "Retry map" }) !== null,
        tab: mapFrame().getAttribute("tabindex"),
      };
      fireEvent.click(screen.getByRole("button", { name: "Retry map" }));
      const second = await waitForMapCount(2);
      emitMap(second, "load");
      emitMap(second, "error", {
        error: new Error("404 /maplibre/maplibre-gl-worker.mjs"),
      });
      const restored = {
        phase: mapFrame().dataset.mapPhase,
        retry: screen.queryByRole("button", { name: "Retry map" }) !== null,
        tab: mapFrame().getAttribute("tabindex"),
      };
      view.unmount();
      emitMap(second, "load");
      emitMap(second, "error", {
        error: new Error("Failed to fetch dynamically imported module"),
      });
      expect({
        failed,
        removed: second.removed,
        restored,
      }).toStrictEqual({
        failed: {
          phase: "map-load-failed",
          removed: true,
          retry: true,
          tab: null,
        },
        removed: true,
        restored: {
          phase: "ready",
          retry: false,
          tab: "0",
        },
      });
    } finally {
      restore();
    }
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
