import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import {
  COMPARE_LEFT_FIPS,
  compareScoresFixture,
} from "../fixtures/compare-api-fixtures";
import {
  tier1HighSufficientFixture,
  tier1LowInsufficientFixture,
} from "../fixtures/tier1-surveillance-priority";
import { installCompareMocks } from "./compare-page-mocks";

const SHA = "d".repeat(64);
const AUTAUGA = "01001";

function situationData(
  classId: string,
  className: string,
  probability: number
) {
  return {
    activated_at: "2026-10-15T00:00:00Z",
    batch_id: "batch",
    batch_version: "batch-v1",
    class_description: `${className} groups published evidence.`,
    class_id: classId,
    class_name: className,
    county_sha256: SHA,
    data_authorization_id: "auth",
    data_publication_authorization: {},
    dictionary_sha256: SHA,
    feature_contract: {},
    fit_git_sha: "abc",
    handoff_approval: {},
    input_bundle_sha256: SHA,
    input_release_id: "governed-2026-10-15-january-climate-prod",
    limitations: ["Not disease risk."],
    model_id: "model",
    model_provenance: {},
    model_version: "situation-v1",
    probabilities: [
      { class_id: "decoy", probability: 1 - probability },
      { class_id: classId, probability },
      { class_id: "other-a", probability: 0 },
      { class_id: "other-b", probability: 0 },
    ],
    source_provenance: {},
    staging_attempt: "1",
  };
}

function situations(fips: string, className: string) {
  const data = situationData("class-3", className, 0.25);
  return {
    bundle_sha256: SHA,
    county_fips: fips,
    four_state: {
      availability: "AVAILABLE",
      batch_id: "batch",
      batch_version: "batch-v1",
      compatibility: "EXACT_INPUT",
      data,
      input_release_id: data.input_release_id,
      model_id: "four",
      unavailable_reason: null,
    },
    release_id: compareScoresFixture.release_id,
    tick_pathogen: {
      availability: "UNAVAILABLE",
      batch_id: null,
      batch_version: null,
      compatibility: "UNAVAILABLE",
      data: null,
      input_release_id: null,
      model_id: "tick",
      unavailable_reason: "NOT_PUBLISHED",
    },
  };
}

async function installIntelligence(page: Page) {
  const template = compareScoresFixture.counties[0];
  if (!template) {
    throw new Error("Compare scores fixture is empty.");
  }
  await page.route("**/v1/atlas/scores**", async (route) => {
    await route.fulfill({
      json: {
        ...compareScoresFixture,
        counties: [
          ...compareScoresFixture.counties,
          {
            ...template,
            county: "Autauga",
            fips: AUTAUGA,
            state: "AL",
            state_name: "Alabama",
            score: { ...template.score, score: 36.6 },
          },
        ],
      },
    });
  });
  await page.route(
    "**/v1/counties/*/tier1-surveillance-priority**",
    async (route) => {
      const fips = new URL(route.request().url()).pathname.split("/").at(-2);
      const fixture =
        fips === AUTAUGA
          ? tier1LowInsufficientFixture
          : tier1HighSufficientFixture;
      await route.fulfill({
        json: {
          ...fixture,
          county_fips: fips,
          release_id: compareScoresFixture.release_id,
        },
        status: 200,
      });
    }
  );
  await page.route(
    "**/v1/counties/*/surveillance-situations**",
    async (route) => {
      const fips =
        new URL(route.request().url()).pathname.split("/").at(-2) ?? "";
      await route.fulfill({
        json: situations(
          fips,
          fips === AUTAUGA ? "Pathogen not recorded" : "Human records present"
        ),
      });
    }
  );
}

test.describe("Compare county surveillance intelligence", () => {
  test("aligns four perspectives for a deep-linked pair and keeps the first evidence group", async ({
    page,
  }) => {
    await installCompareMocks(page, []);
    await installIntelligence(page);
    await page.setViewportSize({ height: 900, width: 1728 });
    await page.goto(`/compare?compare=${AUTAUGA},${COMPARE_LEFT_FIPS}`);
    const section = page.getByTestId("compare-surveillance-intelligence");
    await expect(section).toBeVisible();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      `${AUTAUGA},${COMPARE_LEFT_FIPS}`
    );
    const rows = section.getByTestId(/^compare-surveillance-row-/);
    await expect(rows).toHaveCount(4);
    await expect(rows.nth(0)).toHaveAttribute("data-perspective", "gap-score");
    await expect(rows.nth(1)).toHaveAttribute(
      "data-perspective",
      "ml-review-priority"
    );
    await expect(rows.nth(2)).toHaveAttribute(
      "data-perspective",
      "surveillance-situation"
    );
    await expect(rows.nth(3)).toHaveAttribute(
      "data-perspective",
      "ecological-situation"
    );
    await expect(
      page.getByTestId(`compare-surveillance-cell-gap-score-${AUTAUGA}`)
    ).toContainText("36.6");
    await expect(
      page.getByTestId(
        `compare-surveillance-cell-ml-review-priority-${AUTAUGA}`
      )
    ).toContainText("LOW");
    await expect(
      page.getByTestId(
        `compare-surveillance-cell-surveillance-situation-${AUTAUGA}`
      )
    ).toContainText("Pathogen not recorded");
    await expect(
      page.getByTestId(
        `compare-surveillance-cell-surveillance-situation-${COMPARE_LEFT_FIPS}`
      )
    ).toContainText("Human records present");
    await expect(section).not.toContainText(
      /differ by|winner|loser|composite/i
    );
    await expect(page.getByTestId("compare-model-results")).toBeVisible();
    await expect(page.getByTestId("compare-group-human")).toBeVisible();

    const placement = await page.evaluate(() => {
      const model = document.querySelector(
        '[data-testid="compare-model-results"]'
      );
      const human = document.querySelector(
        '[data-testid="compare-group-human"]'
      );
      const intelligence = document.querySelector(
        '[data-testid="compare-surveillance-intelligence"]'
      );
      if (
        !(model instanceof HTMLElement) ||
        !(human instanceof HTMLElement) ||
        !(intelligence instanceof HTMLElement)
      ) {
        return null;
      }
      const modelBox = model.getBoundingClientRect();
      const humanBox = human.getBoundingClientRect();
      return {
        humanBeforeModel: humanBox.top < modelBox.top,
        modelVisible: modelBox.height > 0,
      };
    });
    expect(placement?.modelVisible).toBe(true);
    expect(placement?.humanBeforeModel).toBe(true);

    const situation = section.getByRole("button", {
      name: "Combined surveillance pattern",
    });
    await situation.focus();
    await page.keyboard.press("Enter");
    const details = page.getByTestId(
      "compare-surveillance-intelligence-details"
    );
    await expect(details).toBeVisible();
    await expect(situation).toHaveAttribute("aria-expanded", "true");
    await expect(details).toContainText("County A");
    await expect(details).toContainText("County B");
    await expect(details).toContainText("Pathogen not recorded");
    await expect(details).toContainText("Human records present");
    const tableBox = await page
      .getByTestId("compare-surveillance-intelligence-table")
      .boundingBox();
    const detailsBox = await details.boundingBox();
    expect(tableBox && detailsBox ? detailsBox.y > tableBox.y : false).toBe(
      true
    );
    const gap = section.getByRole("button", { name: "Gap review score" });
    await gap.focus();
    await page.keyboard.press(" ");
    await expect(gap).toHaveAttribute("aria-expanded", "true");
    await expect(situation).toHaveAttribute("aria-expanded", "false");
    await gap.click();
    await expect(details).toHaveCount(0);

    const viewports = [
      { height: 900, width: 768 },
      { height: 900, width: 1440 },
      { height: 900, width: 1728 },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      const cell = page.getByTestId(
        `compare-surveillance-cell-gap-score-${AUTAUGA}`
      );
      await expect(cell).toBeVisible();
      const display = await cell.evaluate(
        (element) => getComputedStyle(element).display
      );
      expect(display).not.toBe("none");
      const overflows = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1
      );
      expect(overflows).toBe(false);
    }

    await page.emulateMedia({ reducedMotion: "reduce" });
    await expect(gap).toHaveClass(/motion-reduce:transition-none/);
    const results = await new AxeBuilder({ page })
      .include('[data-testid="compare-surveillance-intelligence"]')
      .analyze();
    expect(results.violations).toEqual([]);

    await page.getByRole("button", { name: "Clear second county" }).click();
    await expect(page).toHaveURL(new RegExp(`compare=${AUTAUGA}(?!,)`));
    await expect(section).toHaveCount(0);
    await page.goBack();
    await expect(page.getByTestId("compare-pair")).toHaveAttribute(
      "data-fips",
      `${AUTAUGA},${COMPARE_LEFT_FIPS}`
    );
    await expect(
      page.getByTestId("compare-surveillance-intelligence")
    ).toBeVisible();
    await expect(page.getByTestId("compare-investigate-01001")).toHaveAttribute(
      "href",
      /compare=01001(?:%2C|,)08001/
    );
  });
});
