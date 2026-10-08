import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const governedMetadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-09-18T12:00:00Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-09-19T00:00:00Z",
  methodology_version: "semantic-1.0.0",
  release_id: "governed-2026-09-18-unknown-coverage",
  schema_version: "0.2.0",
  scope: "Contiguous U.S. counties included in this release",
  score_defaults: {},
  sources: [
    {
      key: "human",
      label: "CDC Lyme surveillance",
      vintage: "2023",
      url: "https://cdc.gov",
      note: "Published floor.",
    },
  ],
  states: [{ code: "CO", name: "Colorado" }],
};

const summaryCounty = {
  burgdorferi_status: "Present",
  color: "#efc64a",
  county: "Adams",
  evidence_completeness: 6,
  fips: "08001",
  human_status: "no_county_linked_record",
  in_contiguous_tick_scope: true,
  priority: "Priority 2 — Review",
  score: {
    access_signal: 50,
    community: 50,
    ecological: 100,
    human_weakness: 75,
    pathogen_signal: 100,
    rural_signal: 12.5,
    score: 61.9,
    svi_signal: 50,
    tick_signal: 100,
  },
  state: "CO",
  state_name: "Colorado",
  tick_status: "Established",
};

async function mockGovernedApi(page: import("@playwright/test").Page) {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/metadata")) {
      return route.fulfill({ json: governedMetadata });
    }
    if (url.pathname.endsWith("/geometry")) {
      return route.fulfill({
        json: { type: "FeatureCollection", features: [] },
      });
    }
    if (url.pathname.endsWith("/scores")) {
      return route.fulfill({
        json: {
          release_id: governedMetadata.release_id,
          methodology_version: governedMetadata.methodology_version,
          settings: {},
          counties: [summaryCounty],
        },
      });
    }
    if (url.pathname.includes("/counties/")) {
      return route.fulfill({
        json: { ...summaryCounty, release: governedMetadata },
      });
    }
    return route.fulfill({ status: 404, json: { detail: "Not found" } });
  });
}

test.describe("evidence snapshot presentation", () => {
  test.beforeEach(async ({ page }) => {
    await mockGovernedApi(page);
  });

  test("overview avoids conflicting Alpha labels and exposes technical IDs on demand", async ({
    page,
  }, testInfo) => {
    await page.goto("/overview");
    await expect(
      page.getByText("Source vintages in this Alpha release")
    ).toHaveCount(0);
    await expect(page.getByText("v0.2.0")).toHaveCount(0);
    await expect(
      page
        .getByRole("region", { name: "Atlas summary" })
        .getByText("Semantic scoring methodology")
    ).toBeVisible();
    await expect(
      page.getByText("governed-2026-09-18-unknown-coverage")
    ).toBeHidden();
    await page
      .getByText("Technical release and methodology identifiers")
      .click();
    await expect(
      page.getByText("governed-2026-09-18-unknown-coverage")
    ).toBeVisible();
    await expect(page.getByText("semantic-1.0.0")).toBeVisible();
    const releaseEducation = page.locator("#release-education");
    await releaseEducation.getByText("What these release labels mean").click();
    await expect(
      releaseEducation.getByText(
        /underlying public inputs, not when Atlas generated/i
      )
    ).toBeVisible();
    await releaseEducation
      .getByText("How county scoring works in this release")
      .click();
    await expect(
      releaseEducation.getByText(
        /not a diagnosis, an individual exposure estimate/i
      )
    ).toBeVisible();
    if (testInfo.project.name === "mobile") {
      await page.evaluate(() => {
        document.documentElement.style.fontSize = "200%";
      });
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include(".atlas-evidence-snapshot")
          .analyze()
      ).violations
    ).toEqual([]);
  });

  test("geographic explorer summarizes release context and supports keyboard disclosure", async ({
    page,
  }) => {
    await page.goto("/geographic_explorer");
    await expect(
      page.getByRole("heading", { name: "Evidence snapshot" })
    ).toBeVisible();
    await expect(page.getByText(/^Release governed-/)).toHaveCount(0);
    const disclosure = page.getByText(
      "Technical release and methodology identifiers"
    );
    await disclosure.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByText("semantic-1.0.0")).toBeVisible();
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
});
