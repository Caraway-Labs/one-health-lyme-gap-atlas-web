import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReadonlyURLSearchParams } from "next/navigation";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  CountyCompleteness,
  CountyEvidenceDisclosure,
  CountyFingerprint,
  CountyScoreRamp,
  CountySummaryActions,
  CountySummaryHeader,
} from "@/features/ux-reset/review/county-summary-card-parts";
import type { AdjustedCountyScenario } from "@/features/ux-reset/review/explorer-scenario-score";
import { EXPLORER_MAP_FOLLOW_UP_ID } from "@/features/ux-reset/review/scroll-to-suggested-follow-up";
import { CountyV1CountiesFipsGetResponse } from "@/generated/zod/atlas";

import autauga from "./fixtures/review-al-v11-01001.json";

vi.mock(import("next/navigation"), async (original) => ({
  ...(await original()),
  usePathname: () => "/explore",
  useSearchParams: () => new URLSearchParams() as ReadonlyURLSearchParams,
}));

function adjusted(score: number): AdjustedCountyScenario {
  return {
    colorToken: "var(--map-ramp-4)",
    governedPriority: "Moderate",
    governedScore: 40,
    humanWeakness: 0.5,
    kind: "adjusted",
    priority: "High",
    rank: 3,
    score,
  } as AdjustedCountyScenario;
}

describe("county summary card parts", () => {
  afterEach(() => {
    cleanup();
  });

  describe(CountySummaryHeader, () => {
    it("names the county with its state and FIPS identity", () => {
      render(
        <CountySummaryHeader
          county="Autauga County"
          fips="01001"
          stateCode="AL"
          stateName="Alabama"
        />
      );

      expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
        "Autauga County, Alabama"
      );
      expect(screen.getByTestId("review-preview-fips").textContent).toBe(
        "FIPS 01001"
      );
      expect(screen.getByText("AL")).toBeTruthy();
    });
  });

  describe(CountyScoreRamp, () => {
    it("states that no score was published instead of drawing a ramp", () => {
      render(<CountyScoreRamp score={null} />);

      expect(
        screen.getByTestId("county-summary-score-unavailable").textContent
      ).toContain("No published Atlas gap score");
      expect(screen.queryByRole("meter")).toBeNull();
    });

    it("treats a non-finite score as unpublished", () => {
      render(<CountyScoreRamp score={Number.NaN} />);

      expect(
        screen.getByTestId("county-summary-score-unavailable")
      ).toBeTruthy();
    });

    it("shows the published score with the not-disease-risk qualifier", () => {
      render(<CountyScoreRamp score={42.5} />);

      const meter = screen.getByRole("meter", {
        name: "Published Atlas gap score out of 100",
      });
      expect(meter.getAttribute("aria-valuenow")).toBe("42.5");
      expect(
        screen.getByText("Review priority · not disease risk")
      ).toBeTruthy();
      expect(screen.queryByTestId("county-summary-delta")).toBeNull();
    });

    it("shows how a scenario moved the score, with a text direction", () => {
      const { rerender } = render(
        <CountyScoreRamp scenario={adjusted(55)} score={40} />
      );
      expect(screen.getByTestId("county-summary-delta").textContent).toContain(
        "up"
      );

      rerender(<CountyScoreRamp scenario={adjusted(25)} score={40} />);
      expect(screen.getByTestId("county-summary-delta").textContent).toContain(
        "down"
      );

      rerender(<CountyScoreRamp scenario={adjusted(40)} score={40} />);
      expect(screen.getByTestId("county-summary-delta").textContent).toContain(
        "no change"
      );
    });

    it("keeps the scenario marker inside the track and omits a delta for a limited scenario", () => {
      const { container, rerender } = render(
        <CountyScoreRamp scenario={adjusted(180)} score={40} />
      );
      const marker = container.querySelector<HTMLElement>(
        ".county-summary-ramp-scenario"
      );
      expect(marker?.style.left).toBe("100%");

      rerender(
        <CountyScoreRamp
          scenario={
            {
              governedPriority: "Moderate",
              governedScore: 40,
              kind: "limited",
            } as AdjustedCountyScenario
          }
          score={40}
        />
      );
      expect(screen.queryByTestId("county-summary-delta")).toBeNull();
    });
  });

  describe(CountyCompleteness, () => {
    it("renders nothing when completeness was not published", () => {
      const { container, rerender } = render(
        <CountyCompleteness value={null} />
      );
      expect(container.firstChild).toBeNull();

      rerender(<CountyCompleteness value={Number.NaN} />);
      expect(container.firstChild).toBeNull();
    });

    it("shows the published percentage and clamps the meter to the range", () => {
      const { rerender } = render(<CountyCompleteness value={83.4} />);
      expect(screen.getByText("83%")).toBeTruthy();
      expect(
        screen
          .getByRole("meter", { name: "Evidence completeness" })
          .getAttribute("aria-valuenow")
      ).toBe("83.4");

      rerender(<CountyCompleteness value={140} />);
      expect(
        screen
          .getByRole("meter", { name: "Evidence completeness" })
          .getAttribute("aria-valuenow")
      ).toBe("100");
    });
  });

  describe(CountyFingerprint, () => {
    it("lists a glyph chip for each surveillance family the record states", () => {
      render(
        <CountyFingerprint
          detail={CountyV1CountiesFipsGetResponse.parse(autauga)}
        />
      );

      const list = screen.getByRole("list", {
        name: "Surveillance evidence by family",
      });
      const labels = within(list)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
      expect(labels.length).toBeGreaterThan(0);
      for (const label of labels) {
        expect(label).toMatch(/Human|Tick|Pathogen/);
        expect(label).toMatch(/Available|Limited|Unavailable/);
      }
    });
  });

  describe(CountySummaryActions, () => {
    function renderActions(
      props: Partial<Parameters<typeof CountySummaryActions>[0]> = {}
    ) {
      const onOpen = vi.fn<(fips: string) => void>();
      render(
        <>
          <CountySummaryActions
            compareHref="/compare?county=01001"
            countyName="Autauga County"
            fips="01001"
            releaseId="governed-release"
            stateCode="AL"
            onOpen={onOpen}
            {...props}
          />
          <section id={EXPLORER_MAP_FOLLOW_UP_ID} tabIndex={-1}>
            Suggested follow-up
          </section>
        </>
      );
      return { onOpen };
    }

    it("offers one primary evidence action and named icon actions", () => {
      renderActions({ askHref: "/ask?county=01001" });

      expect(
        screen.getByRole("link", { name: "View Full County Evidence" })
      ).toBeTruthy();
      expect(
        screen.getByRole("button", { name: "View County Follow-Up" })
      ).toBeTruthy();
      expect(
        screen
          .getByRole("link", { name: "Compare This County" })
          .getAttribute("href")
      ).toBe("/compare?county=01001");
      expect(
        screen.getByRole("link", { name: "Ask Atlas" }).getAttribute("href")
      ).toBe("/ask?county=01001");
    });

    it("leaves Ask Atlas out when no handoff exists", () => {
      renderActions();

      expect(screen.queryByRole("link", { name: "Ask Atlas" })).toBeNull();
    });

    it("uses the caller's evidence link when it owns the handoff", () => {
      renderActions({ evidenceHref: "/explore?county=01001&mode=evidence" });

      expect(
        screen
          .getByRole("link", { name: "View Full County Evidence" })
          .getAttribute("href")
      ).toBe("/explore?county=01001&mode=evidence");
    });

    it("calls the evidence handler instead of navigating when one is given", async () => {
      const user = userEvent.setup();
      const onViewCountyEvidence = vi.fn<(fips: string) => void>();
      renderActions({ onViewCountyEvidence });

      await user.click(
        screen.getByRole("button", { name: "View Full County Evidence" })
      );

      expect(onViewCountyEvidence).toHaveBeenCalledWith("01001");
    });

    it("reports a Compare click with the county FIPS", async () => {
      const user = userEvent.setup();
      const { onOpen } = renderActions();

      await user.click(
        screen.getByRole("link", { name: "Compare This County" })
      );

      expect(onOpen).toHaveBeenCalledWith("01001");
    });

    it("moves focus to the follow-up section", async () => {
      const user = userEvent.setup();
      renderActions();
      const section = screen.getByText("Suggested follow-up");
      const scroll = vi.fn<() => void>();
      section.scrollIntoView = scroll;

      await user.click(
        screen.getByRole("button", { name: "View County Follow-Up" })
      );

      expect(document.activeElement).toBe(section);
      expect(scroll).toHaveBeenCalledOnce();
    });
  });

  describe(CountyEvidenceDisclosure, () => {
    it("keeps its children mounted while collapsed and opens on demand", async () => {
      const user = userEvent.setup();
      render(
        <CountyEvidenceDisclosure>
          <p>Rationale rows</p>
        </CountyEvidenceDisclosure>
      );
      const trigger = screen.getByRole("button", {
        name: "Evidence behind this review",
      });

      expect(trigger.getAttribute("aria-expanded")).toBe("false");
      expect(screen.getByText("Rationale rows")).toBeTruthy();

      await user.click(trigger);

      expect(trigger.getAttribute("aria-expanded")).toBe("true");
      expect(screen.getByText("Rationale rows")).toBeVisible();
    });

    it("accepts a custom label", () => {
      render(
        <CountyEvidenceDisclosure label="More evidence">
          <p>Details</p>
        </CountyEvidenceDisclosure>
      );

      expect(
        screen.getByRole("button", { name: "More evidence" })
      ).toBeTruthy();
    });
  });
});
