import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const metadata = {
  release_id: "alpha-2026-08-06",
  schema_version: "0.2.0",
  generated_at: "2026-08-06T05:37:16Z",
  loaded_at: "2026-08-15T00:00:00Z",
  scope: "United States counties",
  bundle_sha256: "a".repeat(64),
  score_defaults: {},
  methodology_version: "alpha-0.2.0",
  limitations: "Not individual risk.",
  sources: [{ key: "human", label: "CDC Lyme surveillance", vintage: "2023", url: "https://cdc.gov", note: "Published floor." }],
  states: [{ code: "CO", name: "Colorado" }],
};

const summary = {
  fips: "08001", county: "Adams", state: "CO", state_name: "Colorado",
  in_contiguous_tick_scope: true, human_status: "no_county_linked_record",
  tick_status: "Established", burgdorferi_status: "Present", evidence_completeness: 6,
  score: { score: 61.9, human_weakness: 75, ecological: 100, community: 50, tick_signal: 100, pathogen_signal: 100, svi_signal: 50, access_signal: 50, rural_signal: 12.5 },
  priority: "Priority 2 — Review", color: "#efc64a",
};

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let contentType = "application/json";
    if (url.pathname.endsWith("/metadata")) body = metadata;
    else if (url.pathname.endsWith("/geometry")) body = { type: "FeatureCollection", features: [{ type: "Feature", id: "08001", properties: { fips: "08001" }, geometry: { type: "Polygon", coordinates: [[[-105, 39], [-104, 39], [-104, 40], [-105, 40], [-105, 39]]] } }] };
    else if (url.pathname.endsWith("/scores")) body = { release_id: metadata.release_id, methodology_version: metadata.methodology_version, settings: {}, counties: [summary] };
    else if (url.pathname.includes("/counties/")) body = { ...summary, population: 500000, case_count_floor_2023: null, incidence_floor_2023: null, state_unallocated_records_2023: 1, scapularis_status: "Established", pacificus_status: "No records", svi_percentile: 0.5, uninsured_percentile: 0.5, uninsured_percent: 8, rucc_2023: 2, release: metadata };
    else if (url.pathname.endsWith("/knowledge-graph/chat")) body = {
      request_id: "request-1", conversation_id: "conversation-1", conversation_token: "opaque-token",
      configuration_version: "kg-v1.0.0", status: "answered", answer: "Reviewed evidence answer.",
      claims: [{ claim_id: "claim-1", text: "Reviewed claim.", citation_ids: ["pmid:12345678"] }],
      citations: [{ citation_id: "pmid:12345678", pmid: "12345678", title: "Reviewed paper", pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345678/", claim_ids: ["claim-1"], passage_ids: ["passage-1"], source_label: "PubMed / PMC Open Access" }],
    };
    else if (url.pathname.endsWith("ranking.csv")) { body = "rank,fips,county\n1,08001,Adams"; contentType = "text/csv"; }
    await route.fulfill({ status: 200, contentType, body: typeof body === "string" ? body : JSON.stringify(body) });
  });
});

test("drawer hands the local conversation to the accessible workspace", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask the evidence" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask the evidence" });
  await expect(dialog).toContainText("not medical advice");
  await dialog.getByLabel("Your question").fill("What evidence is reviewed?");
  await dialog.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(dialog).toContainText("Reviewed evidence answer.");
  await expect(dialog.getByRole("link", { name: /Reviewed paper/ })).toHaveAttribute("rel", "noopener noreferrer");
  await dialog.getByRole("link", { name: "Open full workspace" }).click();
  await expect(page).toHaveURL(/\/knowledge-graph\?conversation=conversation-1/);
  await expect(page.getByText("Reviewed evidence answer.")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("renders the atlas and full non-map results", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  await expect(navigation).toBeVisible();
  await expect(navigation).toHaveCSS("position", "fixed");
  await expect(page.getByRole("link", { name: "One Health Lyme Gap Atlas home" })).toHaveCSS("color", "rgb(255, 255, 255)");
  await expect(page.getByRole("heading", { name: /Find the places/ })).toBeVisible();
  await expect(page.getByText("Adams, CO").first()).toBeVisible();
  await page.getByRole("button", { name: "View full results table" }).click();
  await expect(page.getByRole("table")).toContainText("08001");
  const results = await new AxeBuilder({ page }).exclude(".maplibre-atlas").analyze();
  expect(results.violations).toEqual([]);
});

test("renders every interview variant with selected county evidence in the first experience", async ({ page }) => {
  const variants = [
    ["/variant_1?county=08001", "A clear starting point for county review"],
    ["/variant_2?county=08001", "Explore a county, one step at a time"],
    ["/variant_3?county=08001", "Explore county evidence in one place"],
    ["/variant_4?county=08001", "Understand what the score means"],
    ["/variant_5?county=08001", "Compare county evidence before deciding"],
  ] as const;

  for (const [path, heading] of variants) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Adams, Colorado").first()).toBeVisible();
    await expect(page.getByText("For surveillance follow-up—not personal risk.")).toBeVisible();
    await expect(page.getByText("Current governed snapshot")).toBeVisible();
    await expect(page.getByText(/Variant \d/)).toHaveCount(0);
  }
});

test("keeps definitions close to the evidence in the explain-the-score variant", async ({ page }) => {
  await page.goto("/variant_4?county=08001");
  await expect(page.getByText("Published human surveillance signal").first()).toBeVisible();
  await expect(page.getByText("Tick and pathogen evidence").first()).toBeVisible();
  await expect(page.getByText("Missing published records are not zero cases.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "How this follow-up priority score is calculated" })).toBeVisible();
  await expect(page.getByLabel("Tick and pathogen share")).toBeVisible();
  await page.getByText("See this county’s score components and source values").click();
  await expect(page.getByText("Rurality (RUCC)")).toBeVisible();
  const results = await new AxeBuilder({ page }).exclude(".maplibre-atlas").analyze();
  expect(results.violations).toEqual([]);
});
