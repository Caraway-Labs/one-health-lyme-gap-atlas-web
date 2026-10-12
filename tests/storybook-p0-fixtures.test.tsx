import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SidebarProvider, useSidebar } from "@/components/ui/sidebar";
import { EvidenceObject } from "@/features/ux-reset/evidence/evidence-object";
import { EvidenceProvenanceInspect } from "@/features/ux-reset/evidence/evidence-provenance-inspect";
import { ReleaseEvidenceStateStrip } from "@/features/ux-reset/evidence/evidence-state-strip";
import { investigateEvidenceConflicts } from "@/features/ux-reset/investigate/county-evidence";
import { ReviewCountyPreviewPanel } from "@/features/ux-reset/review/review-county-preview-panel";
import {
  TIER1_FAILED_MESSAGE,
  TIER1_RELEASE_MISMATCH_MESSAGE,
  TIER1_RELEASE_UNKNOWN_MESSAGE,
  TIER1_STALE_MESSAGE,
  TIER1_UNAVAILABLE_MESSAGE,
} from "@/features/ux-reset/surveillance-priority/present-tier1-surveillance-priority";

import {
  evidenceObjectPreset,
  provenancePreset,
  releaseEvidencePreset,
} from "../stories/fixtures/evidence-presets";
import { hierarchyPreset } from "../stories/fixtures/investigate-hierarchy-presets";
import {
  reviewPreviewPreset,
  syntheticReviewSourceUrl,
} from "../stories/fixtures/review-preview-presets";
import {
  isLower48OrDcFips,
  syntheticCounty,
  syntheticReleaseId,
} from "../stories/fixtures/synthetic-county";
import { tier1StoryView } from "../stories/fixtures/tier1-views";
import {
  Tier1StoryQueryProvider,
  useTier1SurveillancePriority,
} from "../stories/support/tier1-hook-substitute";
import { tier1HighSufficientFixture } from "./fixtures/tier1-surveillance-priority";

vi.mock(
  import("@/features/ux-reset/surveillance-priority/use-tier1-surveillance-priority"),
  async (importOriginal) => {
    const actual = await importOriginal();
    return {
      ...actual,
      useTier1SurveillancePriority: () =>
        ({
          data: undefined,
          error: null,
          isError: false,
          isPending: true,
          isSuccess: false,
        }) as ReturnType<typeof actual.useTier1SurveillancePriority>,
    };
  }
);

const reviewPresetIds = [
  "rationale",
  "limited-qualification",
  "missing-metadata",
  "dropped-context",
  "long-references",
] as const;

function SidebarState({ name }: { name: string }) {
  const { open } = useSidebar();
  return <p>{`${name} ${open ? "expanded" : "collapsed"}`}</p>;
}

function clickLink(link: HTMLElement): void {
  link.addEventListener(
    "click",
    (event) => {
      event.preventDefault();
    },
    { capture: true }
  );
  fireEvent.click(link);
}

describe("Storybook P0 evidence fixtures", () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  it("keeps a published zero available and distinct from absence", () => {
    const zero = evidenceObjectPreset("published-zero");
    const missing = evidenceObjectPreset("missing");
    expect(zero).toMatchObject({
      availability: "available",
      displayValue: "0 mm",
      reasonCode: "ZERO",
    });
    expect(zero.provenance).toMatchObject({
      datasetVintage: null,
      materialCaveat: null,
    });
    expect(missing).toMatchObject({
      availability: "unavailable",
      displayValue: "Unavailable",
      reasonCode: "MISSING",
    });
    expect(missing.displayValue).not.toBe(zero.displayValue);
  });

  it("keeps a small observed value and suppression distinct from the numeric payload", () => {
    const observed = evidenceObjectPreset("observed-nonzero");
    const suppressed = evidenceObjectPreset("suppressed");
    const precise = evidenceObjectPreset("precise-caveat");
    expect(observed).toMatchObject({
      availability: "available",
      displayValue: expect.stringContaining("0.0001"),
    });
    expect(observed.displayValue).not.toBe("0 mm");
    expect(observed.provenance.datasetVintage).toBe("v1.0.0-scaled-202501");
    expect(suppressed).toMatchObject({
      availability: "limited",
      displayValue: "Suppressed",
      reasonCode: "SUPPRESSED",
    });
    expect(precise).toMatchObject({
      availability: "available",
      displayValue: "0.123456789012345678901234567890 mm",
      valueNote: expect.stringContaining("Full published precision"),
    });
  });

  it("does not render a suppressed payload or invent a vintage for published zero", () => {
    const suppressed = evidenceObjectPreset("suppressed");
    expect(suppressed.displayValue).not.toContain("42");
    expect(suppressed.provenance.materialCaveat).toBeTruthy();
    expect(
      evidenceObjectPreset("published-zero").provenance.datasetVintage
    ).toBeNull();
  });

  it("renders release loading without an evidence badge or the error copy", () => {
    render(<ReleaseEvidenceStateStrip {...releaseEvidencePreset("loading")} />);
    expect(screen.getByRole("status").textContent).toContain(
      "Loading governed release context"
    );
    expect(screen.queryByText("Available")).toBeNull();
    expect(screen.queryByText("Synthetic release request failed.")).toBeNull();
    expect(screen.queryByText("Limited")).toBeNull();
    expect(screen.queryByText("Unavailable")).toBeNull();
  });

  it("renders a release request error without an evidence-availability badge", () => {
    render(
      <ReleaseEvidenceStateStrip {...releaseEvidencePreset("error-default")} />
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "Unable to load governed release context for this page."
    );
    expect(screen.queryByText("Available")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("uses either a reason code or a state label", () => {
    const full = provenancePreset("full-reason");
    expect(full.reasonCode).toBeTruthy();
    expect(full.stateLabel).toBeUndefined();
    expect(full.provenance.referenceLines?.length).toBeGreaterThan(1);
    expect(full.provenance.limitations.length).toBeGreaterThan(1);
    expect(full.provenance.sourceUrl).toBe(
      "https://example.com/synthetic-precipitation-source"
    );
  });

  it("labels missing provenance unavailable without a reason code", () => {
    expect(provenancePreset("state-label-missing").stateLabel).toBe(
      "Unavailable"
    );
  });

  it("keeps missing provenance free of invented vintage and technical identity", () => {
    const missing = provenancePreset("state-label-missing");
    expect(missing.provenance.technical).toBeNull();
    expect(missing.provenance.datasetVintage).toBeNull();
    expect(missing.reasonCode).toBeUndefined();
  });

  it("renders unreadable technical identifiers as unavailable", () => {
    const unreadable = provenancePreset("technical-unreadable");
    expect(unreadable.provenance.technical?.configurationSha256).toBe(
      "not-a-digest"
    );
    if (unreadable.stateLabel !== undefined) {
      throw new Error("Unreadable preset must use the reason branch.");
    }
    render(
      <EvidenceProvenanceInspect
        availability={unreadable.availability}
        provenance={unreadable.provenance}
        reasonCode={unreadable.reasonCode}
      />
    );
    fireEvent.click(screen.getByText("Inspect provenance"));
    fireEvent.click(screen.getByText("Technical reproducibility identifiers"));
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
  });

  it("withholds model priority views instead of returning a tier", () => {
    const kinds = [
      tier1StoryView("unavailable").kind,
      tier1StoryView("failed").kind,
      tier1StoryView("stale").kind,
      tier1StoryView("release-unknown").kind,
      tier1StoryView("release-mismatch").kind,
    ];
    expect(kinds).toStrictEqual([
      "unavailable",
      "failed",
      "stale",
      "release-unaligned",
      "release-unaligned",
    ]);
    expect(tier1StoryView("unavailable").kind).not.toBe("result");
    expect(tier1StoryView("failed").kind).not.toBe("result");
    expect(tier1StoryView("stale").kind).not.toBe("result");
    expect(tier1StoryView("release-mismatch").kind).not.toBe("result");
  });

  it("keeps a returned low insufficient tier distinct from withholding", () => {
    expect(tier1StoryView("low-insufficient")).toMatchObject({
      kind: "result",
      sufficiency: "INSUFFICIENT",
      tier: "LOW",
    });
    expect(tier1StoryView("not-estimable").kind).toBe("not-estimable");
    expect(tier1StoryView("release-unknown")).toMatchObject({
      kind: "release-unaligned",
      reason: "unknown",
    });
    expect(tier1StoryView("release-mismatch")).toMatchObject({
      kind: "release-unaligned",
      reason: "mismatch",
    });
  });

  it("states that withheld priority is not low priority", () => {
    const messages = [
      TIER1_UNAVAILABLE_MESSAGE,
      TIER1_FAILED_MESSAGE,
      TIER1_STALE_MESSAGE,
      TIER1_RELEASE_UNKNOWN_MESSAGE,
      TIER1_RELEASE_MISMATCH_MESSAGE,
    ];
    expect(
      messages.every((message) => message.includes("not low priority"))
    ).toBeTruthy();
  });

  it("renders a published zero with its reason", () => {
    render(
      <EvidenceObject
        model={evidenceObjectPreset("published-zero")}
        showReason
      />
    );
    expect(screen.getByText("0 mm")).toBeTruthy();
    expect(screen.getByText("Published zero")).toBeTruthy();
  });

  it("keeps a same-period conflict and a partial failure with retained observations", () => {
    const conflict = hierarchyPreset("same-period-conflict");
    const failure = hierarchyPreset("partial-failure");
    expect(
      investigateEvidenceConflicts(conflict.bundle).length
    ).toBeGreaterThan(0);
    expect(failure.bundle.measureFailures.length).toBeGreaterThan(0);
    expect(
      failure.bundle.families.some((family) => family.observations.length > 0)
    ).toBeTruthy();
    expect(failure.showRetry).toBeTruthy();
  });

  it("keeps a catalog failure empty while a pending county retains observations", () => {
    const catalog = hierarchyPreset("catalog-failure");
    const pending = hierarchyPreset("county-pending");
    expect(catalog.catalogFailed).toBeTruthy();
    expect(
      catalog.bundle.families.every(
        (family) => family.observations.length === 0
      )
    ).toBeTruthy();
    expect(pending.countyRecordLoading).toBeTruthy();
    expect(
      pending.bundle.families.some((family) => family.observations.length > 0)
    ).toBeTruthy();
  });

  it("keeps a refresh failure beside an already loaded county record", () => {
    const refresh = hierarchyPreset("refresh-failure");
    expect(refresh.countyRecord).not.toBeNull();
    expect(refresh.countyRecordRefreshError).toContain("Loaded evidence stays");
  });

  it("keeps every review preview inside the lower 48 plus DC", () => {
    const geographies = reviewPresetIds.map((preset) => {
      const model = reviewPreviewPreset(preset);
      return {
        compareHref: model.compareHref.includes(syntheticCounty.fips),
        fips: model.preview.fips,
        href: model.href.includes(syntheticCounty.fips),
        lower48: isLower48OrDcFips(model.preview.fips),
      };
    });
    expect(isLower48OrDcFips(syntheticCounty.fips)).toBeTruthy();
    expect(geographies.every((row) => row.lower48)).toBeTruthy();
    expect(
      geographies.every((row) => row.href && row.compareHref)
    ).toBeTruthy();
    expect(geographies.some((row) => row.fips.startsWith("02"))).toBeFalsy();
    expect(geographies.some((row) => row.fips.startsWith("15"))).toBeFalsy();
  });

  it("keeps review qualification and dropped context truthful", () => {
    const rationale = reviewPreviewPreset("rationale");
    const limited = reviewPreviewPreset("limited-qualification");
    const missing = reviewPreviewPreset("missing-metadata");
    expect(rationale.preview.qualification).toBeNull();
    expect(rationale.droppedNotes).toStrictEqual([]);
    expect(limited.preview.qualification?.availability).toBe("limited");
    expect(missing.preview.availability).toBe("unavailable");
    expect(missing.preview.qualification?.provenance.sourceFamily).toBe(
      "Unavailable"
    );
  });

  it("keeps long references and dropped review context on one release", () => {
    const longForm = reviewPreviewPreset("long-references");
    const dropped = reviewPreviewPreset("dropped-context");
    const high = tier1StoryView("high-sufficient");
    if (
      dropped.query.status !== "success" ||
      dropped.release.status !== "ready" ||
      high.kind !== "result"
    ) {
      throw new Error("Aligned stories must return the synthetic model.");
    }
    expect(
      longForm.preview.qualification?.provenance.referenceLines?.length
    ).toBe(2);
    expect(longForm.preview.qualification?.provenance.sourceUrl).toBe(
      syntheticReviewSourceUrl
    );
    expect(dropped.query.data.release_id).toBe(dropped.release.releaseId);
    expect(dropped.release.releaseId).toBe(syntheticReleaseId);
    expect(high.details.releaseId).toBe(syntheticReleaseId);
  });

  it("puts the synthetic release on handoff dataset parameters", () => {
    const rationale = reviewPreviewPreset("rationale");
    if (
      rationale.query.status !== "success" ||
      rationale.release.status !== "ready"
    ) {
      throw new Error("Rationale must return a model.");
    }
    expect(rationale.query.data.release_id).toBe(rationale.release.releaseId);
    expect(rationale.href).toContain(`dataset=${syntheticReleaseId}`);
    expect(rationale.compareHref).toContain(`dataset=${syntheticReleaseId}`);
    expect(tier1StoryView("release-mismatch")).toMatchObject({
      kind: "release-unaligned",
      reason: "mismatch",
    });
    expect(tier1HighSufficientFixture.release_id).not.toBe(syntheticReleaseId);
  });

  it("matches the nested model release to the investigate bundle", () => {
    const model = hierarchyPreset("with-model");
    const view = tier1StoryView("high-sufficient");
    if (view.kind !== "result") {
      throw new Error("High sufficient view must return a tier.");
    }
    expect(model.bundle.releaseId).toBe(syntheticReleaseId);
    expect(model.countyRecord?.releaseId).toBe(syntheticReleaseId);
    expect(view.details.releaseId).toBe(model.bundle.releaseId);
    expect(
      provenancePreset("full-reason").provenance.technical?.releaseId
    ).toBe(syntheticReleaseId);
    expect(
      evidenceObjectPreset("published-zero").provenance.technical?.releaseId
    ).toBe(syntheticReleaseId);
  });

  it("resolves the nested surveillance substitute without fetching", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    function Probe() {
      const query = useTier1SurveillancePriority(syntheticCounty.fips, {
        releaseId: "alpha-2026",
        status: "ready",
      });
      return <p>{query.isPending ? "pending" : "settled"}</p>;
    }
    render(
      <Tier1StoryQueryProvider value={reviewPreviewPreset("rationale").query}>
        <Probe />
      </Tier1StoryQueryProvider>
    );
    expect(screen.getByText("settled")).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it("calls onOpen once per county action with the preview fips", () => {
    const onOpen = vi.fn<(fips: string) => void>();
    const model = reviewPreviewPreset("rationale");
    render(
      <ReviewCountyPreviewPanel
        compareHref={model.compareHref}
        droppedNotes={model.droppedNotes}
        href={model.href}
        onOpen={onOpen}
        preview={model.preview}
        release={model.release}
      />
    );
    clickLink(screen.getByRole("link", { name: "County evidence" }));
    expect(onOpen).toHaveBeenCalledExactlyOnceWith(syntheticCounty.fips);
    clickLink(screen.getByRole("link", { name: "Compare" }));
    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(onOpen.mock.calls[1]).toStrictEqual([syntheticCounty.fips]);
  });

  it("does not treat a provenance source reference as a county open", () => {
    const onOpen = vi.fn<(fips: string) => void>();
    const model = reviewPreviewPreset("long-references");
    render(
      <ReviewCountyPreviewPanel
        compareHref={model.compareHref}
        droppedNotes={model.droppedNotes}
        href={model.href}
        onOpen={onOpen}
        preview={model.preview}
        release={model.release}
      />
    );
    clickLink(
      screen.getByRole("link", {
        hidden: true,
        name: /Open source reference/,
      })
    );
    expect(onOpen).not.toHaveBeenCalled();
    expect(
      screen.getByTestId("review-investigate").getAttribute("href")
    ).toContain(`dataset=${syntheticReleaseId}`);
    expect(screen.getByTestId("review-compare").getAttribute("href")).toContain(
      `county=${syntheticCounty.fips}`
    );
  });

  it("keeps sidebar providers on their own storage keys", async () => {
    window.localStorage.setItem("ux-reset-pro-sidebar", "false");
    window.localStorage.setItem("ux-reset-pro-sidebar:review", "true");
    window.localStorage.setItem("ux-reset-pro-sidebar:collapsed", "false");
    render(
      <>
        <SidebarProvider defaultOpen storageKey="ux-reset-pro-sidebar:review">
          <SidebarState name="review" />
        </SidebarProvider>
        <SidebarProvider
          defaultOpen={false}
          storageKey="ux-reset-pro-sidebar:collapsed"
        >
          <SidebarState name="collapsed" />
        </SidebarProvider>
      </>
    );
    await waitFor(() => {
      expect(window.localStorage.getItem("ux-reset-pro-sidebar:review")).toBe(
        "true"
      );
    });
    expect(screen.getByText("review expanded")).toBeTruthy();
    expect(screen.getByText("collapsed collapsed")).toBeTruthy();
    expect(window.localStorage.getItem("ux-reset-pro-sidebar")).toBe("false");
  });
});
