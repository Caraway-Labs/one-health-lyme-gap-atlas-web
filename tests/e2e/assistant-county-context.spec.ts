import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const metadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-08-15T00:00:00Z",
  methodology_version: "alpha-0.2.0",
  release_id: "alpha-2026-08-06",
  schema_version: "0.2.0",
  scope: "United States counties",
  score_defaults: {},
  sources: [],
  states: [{ code: "CO", name: "Colorado" }],
};

const summary = {
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

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    if (url.pathname.endsWith("/metadata")) {
      body = metadata;
    } else if (url.pathname.endsWith("/scores")) {
      body = {
        release_id: metadata.release_id,
        methodology_version: metadata.methodology_version,
        settings: {},
        counties: [summary],
      };
    } else if (url.pathname.includes("/counties/")) {
      body = {
        ...summary,
        case_count_floor_2023: null,
        incidence_floor_2023: null,
        state_unallocated_records_2023: 0,
      };
    }
    await route.fulfill({ json: body });
  });
  await page.route("**/v1/knowledge-graph/chat", async (route) => {
    await route.fulfill({
      json: {
        request_id: "request-1",
        conversation_id: "conversation-1",
        configuration_version: "test-v1",
        assistant_policy_version: "test-v1",
        status: "no_evidence",
        answer: "No corpus match.",
        evidence_state: "no_relevant_corpus_evidence",
        source_used: "literature_evidence",
        claims: [],
        citations: [],
      },
    });
  });
});

test("shows county context in the floating assistant after Explorer selection", async ({
  page,
}) => {
  await page.goto("/geographic_explorer?county=08001");
  await page.getByRole("button", { name: /Atlas Assistant/ }).click();
  await expect(
    page.getByLabel("County context").getByText("Adams, Colorado")
  ).toBeVisible();
  await expect(page.getByText("FIPS 08001")).toBeVisible();
});

test("carries county context into the assistant workspace route", async ({
  page,
}) => {
  await page.goto("/assistant?county=08001&dataset=alpha-2026-08-06");
  await expect(
    page.getByLabel("County context").getByText("Adams, Colorado")
  ).toBeVisible();
  const accessibilityScanResults = await new AxeBuilder({ page })
    .include('[data-assistant-county-state="identified"]')
    .analyze();
  expect(accessibilityScanResults.violations).toEqual([]);
});

test("explains unavailable county FIPS instead of switching silently", async ({
  page,
}) => {
  await page.goto("/assistant?county=99999");
  await expect(page.getByText("County unavailable in this release")).toBeVisible();
  await expect(page).toHaveURL(/county=99999/);
});
