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

const comparisonSummary = {
  ...summary,
  county: "Los Angeles",
  fips: "06037",
  score: { ...summary.score, score: 54.2 },
  state: "CA",
  state_name: "California",
};

test.beforeEach(async ({ page }) => {
  await page.route("http://localhost:8000/**", async (route) => {
    const url = new URL(route.request().url());
    let body: unknown = {};
    let contentType = "application/json";
    let headers: Record<string, string> | undefined;
    if (url.pathname.endsWith("/metadata")) {
      body = metadata;
    } else if (url.pathname.endsWith("/geometry")) {
      body = {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            id: "08001",
            properties: { fips: "08001" },
            geometry: {
              type: "Polygon",
              coordinates: [
                [
                  [-105, 39],
                  [-104, 39],
                  [-104, 40],
                  [-105, 40],
                  [-105, 39],
                ],
              ],
            },
          },
        ],
      };
    } else if (url.pathname.endsWith("/scores")) {
      body = {
        release_id: metadata.release_id,
        methodology_version: metadata.methodology_version,
        settings: {},
        counties: [summary, comparisonSummary],
      };
    } else if (url.pathname.endsWith("/report.pdf")) {
      body = "%PDF-1.7 mock Atlas report";
      contentType = "application/pdf";
      headers = {
        "Access-Control-Expose-Headers": "Content-Disposition",
        "Content-Disposition": `attachment; filename="${url.pathname.includes("/counties/") ? "adams-county.pdf" : "colorado-state.pdf"}"`,
      };
    } else if (url.pathname.includes("/counties/")) {
      body = {
        ...summary,
        population: 500_000,
        case_count_floor_2023: null,
        incidence_floor_2023: null,
        state_unallocated_records_2023: 1,
        scapularis_status: "Established",
        pacificus_status: "No records",
        svi_percentile: 0.5,
        uninsured_percentile: 0.5,
        uninsured_percent: 8,
        rucc_2023: 2,
        release: metadata,
      };
    } else if (url.pathname.endsWith("/knowledge-graph/chat")) {
      body = {
        request_id: "request-1",
        conversation_id: "conversation-1",
        conversation_token: "opaque-token",
        configuration_version: "kg-v1.0.0",
        status: "answered",
        answer: "Reviewed evidence answer.",
        claims: [
          {
            claim_id: "claim-1",
            text: "Reviewed claim.",
            citation_ids: ["pmid:12345678"],
          },
        ],
        citations: [
          {
            citation_id: "pmid:12345678",
            pmid: "12345678",
            title: "Reviewed paper",
            pubmed_url: "https://pubmed.ncbi.nlm.nih.gov/12345678/",
            claim_ids: ["claim-1"],
            passage_ids: ["passage-1"],
            source_label: "PubMed / PMC Open Access",
          },
        ],
      };
    } else if (url.pathname.endsWith("ranking.csv")) {
      body = "rank,fips,county\n1,08001,Adams";
      contentType = "text/csv";
    }
    await route.fulfill({
      body: typeof body === "string" ? body : JSON.stringify(body),
      contentType,
      headers,
      status: 200,
    });
  });
});

test("drawer hands the local conversation to the accessible workspace", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask the evidence" }).click();
  const dialog = page.getByRole("dialog", { name: "Ask the evidence" });
  await expect(dialog).toContainText("not medical advice");
  await dialog.getByLabel("Your question").fill("What evidence is reviewed?");
  await dialog.getByRole("button", { exact: true, name: "Ask" }).click();
  await expect(dialog).toContainText("Reviewed evidence answer.");
  await expect(
    dialog.getByRole("link", { name: /Reviewed paper/ })
  ).toHaveAttribute("rel", "noopener noreferrer");
  await dialog.getByRole("link", { name: "Open full workspace" }).click();
  await expect(page).toHaveURL(
    /\/knowledge-graph\?conversation=conversation-1/
  );
  await expect(page.getByText("Reviewed evidence answer.")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("runs the feature-gated assistant demo without a live model", async ({
  page,
}) => {
  await page.goto("/assistant");
  await expect(
    page.getByRole("heading", { name: "Talk with the Atlas" })
  ).toBeVisible();
  await page.getByLabel("Ask the Atlas demo").fill("What should I review?");
  await page.getByRole("button", { name: "Send demo question" }).click();
  await expect(page.getByText(/Demo response: Atlas questions/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open CDC Lyme surveillance" })
  ).toHaveAttribute("rel", "noopener noreferrer");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("renders the atlas and full non-map results", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeVisible();
  const sidebar = navigation.locator("..");
  await expect(sidebar).toHaveCSS(
    "position",
    testInfo.project.name.includes("mobile") ? "fixed" : "sticky"
  );
  await expect(
    page.getByRole("link", { name: "One Health Lyme Gap Atlas home" })
  ).toHaveCSS("color", "rgb(8, 42, 77)");
  await expect(
    page.getByRole("heading", {
      name: "Find counties that may deserve a closer look.",
    })
  ).toBeVisible();
  await expect(page.getByText("Adams, CO").first()).toBeVisible();
  const tableButton = page.getByRole("button", {
    name: "View full county list",
  });
  await tableButton.scrollIntoViewIfNeeded();
  await tableButton.click();
  await expect(page.getByRole("table")).toContainText("08001");
  const results = await new AxeBuilder({ page })
    .exclude(".maplibre-atlas")
    .analyze();
  expect(results.violations).toEqual([]);
});

// CI runs this unchanged scenario for both projects. The pre-MVP mobile result is
// reported separately as an accepted defect in #126; desktop remains blocking.
test("publishes an accessible, clear privacy summary without analytics claims", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Privacy" }).click();

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Privacy without the fine print." })
  ).toBeVisible();
  await expect(
    page.getByText(
      "Atlas does not currently use a third-party product-analytics service or browser tracking SDK."
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /We do not sell, rent, or share personal data for advertising/
    )
  ).toBeVisible();
  await expect(
    page.getByText(/chat prompts or answers, feedback text, raw search text/)
  ).toBeVisible();
  await expect(page.getByText("Export my data")).toBeVisible();
  await expect(page.getByText("Remove all data")).toBeVisible();
  await expect(
    page.getByText(
      /When optional accounts are available, account settings will include/
    )
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("atlas.analytics-preference.v1"))
    )
    .toBeNull();

  await page.getByRole("button", { name: "Privacy settings" }).click();
  const privacySettings = page.getByRole("dialog", {
    name: "Privacy settings",
  });
  await expect(privacySettings).toContainText(
    "Optional analytics are off until you make a choice."
  );
  await expect(privacySettings).toContainText("six months");
  await expect(
    privacySettings.getByRole("button", { name: "Keep optional analytics off" })
  ).toBeVisible();
  await privacySettings
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("atlas.analytics-preference.v1"))
    )
    .toContain('"decision":"denied"');

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("downloads county and state PDF reports with server filenames", async ({
  page,
}) => {
  await page.goto("/?county=08001&state=CO");
  await expect(page.getByText("Adams, Colorado")).toBeVisible();

  const countyDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).last().click();
  expect((await countyDownload).suggestedFilename()).toBe("adams-county.pdf");

  const stateDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export PDF" }).first().click();
  expect((await stateDownload).suggestedFilename()).toBe("colorado-state.pdf");
});

test("keeps filters and score settings in the shareable URL", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: "State" }).click();
  await page.getByRole("option", { name: "Colorado" }).click();
  await page.getByLabel("County name or FIPS code").fill("Adams");
  await page
    .getByRole("combobox", { name: "Filter counties by available data" })
    .click();
  await page
    .getByRole("option", { name: "Tick or pathogen evidence available" })
    .click();
  await page
    .getByLabel("Weight given to tick and pathogen evidence")
    .fill("70");

  await expect(page).toHaveURL(/state=CO/);
  await expect(page).toHaveURL(/q=Adams/);
  await expect(page).toHaveURL(/evidence=ecological/);
  await expect(page).toHaveURL(/eco=70/);
});

test("persists an explicit comparison county in the compare variant URL", async ({
  page,
}) => {
  await page.goto("/variant_5?county=08001");
  const comparison = page.getByLabel("Compare with");
  await comparison.selectOption("06037");
  await expect(page).toHaveURL(/compare=06037/);
  await expect(comparison).toHaveValue("06037");

  await page.reload();
  await expect(page.getByLabel("Compare with")).toHaveValue("06037");
});

test("shows a recoverable status when the governed API release is unavailable", async ({
  page,
}) => {
  await page.unroute("http://localhost:8000/**");
  await page.route("http://localhost:8000/**", async (route) => {
    if (new URL(route.request().url()).pathname.endsWith("/metadata")) {
      await route.fulfill({
        body: JSON.stringify({ detail: "Temporarily unavailable" }),
        contentType: "application/json",
        status: 503,
      });
      return;
    }
    await route.abort();
  });

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "The Atlas is temporarily unavailable" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("renders every interview variant with selected county evidence in the first experience", async ({
  page,
}) => {
  const variants = [
    ["/variant_1?county=08001", "A clear starting point for county review"],
    ["/variant_2?county=08001", "Explore a county, one step at a time"],
    ["/variant_3?county=08001", "Explore county evidence in one place"],
    ["/variant_4?county=08001", "Understand what the score means"],
    ["/variant_5?county=08001", "Compare county evidence before deciding"],
    ["/variant_6?county=08001", "Explore county evidence in one place"],
  ] as const;

  for (const [path, heading] of variants) {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByText("Adams, Colorado").first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Export PDF" })).toHaveCount(
      1
    );
    await expect(
      page.getByText("For surveillance follow-up—not personal risk.")
    ).toBeVisible();
    await expect(page.getByText("Current governed snapshot")).toBeVisible();
    await expect(page.getByText(/Variant \d/)).toHaveCount(0);
  }
});

test("offers route-aware sidebar navigation and a shared data dictionary", async ({
  page,
}, testInfo) => {
  await page.goto("/variant_6?county=08001");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }
  const navigation = page.getByRole("navigation", {
    name: "Primary navigation",
  });
  await expect(navigation).toBeVisible();
  await expect(
    navigation.getByRole("link", { name: "Wide workspace" })
  ).toHaveAttribute("aria-current", "page");
  await expect(
    navigation.getByRole("link", { name: "Geographic Explorer" })
  ).toHaveAttribute("href", "/geographic_explorer");
  if (testInfo.project.name.includes("mobile")) {
    await page
      .getByRole("dialog", { name: "Primary navigation" })
      .getByRole("button", { name: "Close navigation" })
      .click();
  }
  await page.getByRole("button", { name: "Data dictionary" }).click();
  const dialog = page.getByRole("dialog", { name: "Data dictionary" });
  await expect(dialog).toContainText("County Review Priority");
  await dialog.getByRole("button", { name: "Close data dictionary" }).click();
});

test("keeps mobile drawer focus contained and restores it after Escape", async ({
  page,
}, testInfo) => {
  test.skip(!testInfo.project.name.includes("mobile"));

  await page.goto("/");
  const trigger = page.getByRole("button", { name: "Open navigation" });
  await trigger.focus();
  await trigger.click();

  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(
    drawer.getByRole("button", { name: "Close navigation" })
  ).toBeFocused();
  await expect(page.locator(".app-inset")).toHaveAttribute("inert", "");

  await page.keyboard.press("Escape");

  await expect(drawer).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("focus mode compacts the shared shell without changing the analytical route", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name.includes("mobile"));

  await page.goto("/variant_6?county=08001");
  await page.getByRole("button", { name: "Focus workspace" }).click();

  await expect(page.locator(".app-shell")).toHaveClass(/app-shell-focus/);
  await expect(page.locator(".app-sidebar")).toHaveCSS("width", "68px");
  await expect(page).toHaveURL(/variant_6\?county=08001/);
  await expect(
    page.getByRole("link", { name: "Wide workspace" })
  ).toBeVisible();

  await page.getByRole("button", { name: "Exit focus", exact: true }).click();

  await expect(page.locator(".app-shell")).not.toHaveClass(/app-shell-focus/);
  await expect(page).toHaveURL(/variant_6\?county=08001/);
});

test("keeps the shared shell responsive and preserves deep links during keyboard navigation", async ({
  page,
}, testInfo) => {
  const routes = [
    "/",
    "/variant_1?county=08001",
    "/variant_2?county=08001",
    "/variant_3?county=08001",
    "/variant_4?county=08001",
    "/variant_5?county=08001",
    "/variant_6?county=08001",
  ];

  for (const route of routes) {
    await page.goto(route);
    await expect(
      page.getByRole("navigation", { name: "Primary navigation" })
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
  }

  await page.goto("/variant_6?county=08001");
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Open navigation" }).click();
  }

  const geographicExplorer = page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link", { name: "Geographic Explorer" });
  await geographicExplorer.focus();
  await expect(geographicExplorer).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/geographic_explorer\?/);
  expect(new URL(page.url()).pathname).toBe("/geographic_explorer");

  await page.goBack();
  await expect(page).toHaveURL(/\/variant_6\?.*county=08001/);
});

test("reduces shell motion when the user requests it", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/variant_6?county=08001");

  await expect(page.locator(".app-sidebar")).toHaveCSS(
    "transition-duration",
    "1e-05s"
  );
});

test("keeps the wide workspace score calculation above the county panels and collapsed until requested", async ({
  page,
}) => {
  await page.goto("/variant_6?county=08001");
  const scoreAccordion = page.locator("#scoring");
  await expect(scoreAccordion).not.toHaveAttribute("open", "");
  await expect(
    page.getByRole("heading", {
      name: "How this follow-up priority score is calculated",
    })
  ).not.toBeVisible();
  await scoreAccordion
    .getByText("Scoring calculation", { exact: true })
    .click();
  await expect(scoreAccordion).toHaveAttribute("open", "");
  await page.getByLabel("Tick and pathogen share").fill("70");
  await expect(page).toHaveURL(/eco=70/);
  await expect(page.getByText("Selected county", { exact: true })).toHaveCount(
    1
  );
});

test("keeps definitions close to the evidence in the explain-the-score variant", async ({
  page,
}) => {
  await page.goto("/variant_4?county=08001");
  await expect(
    page.getByText("Published human surveillance signal").first()
  ).toBeVisible();
  await expect(
    page
      .locator(".explain-grid .definition-cards")
      .getByText("Tick and pathogen evidence", { exact: true })
  ).toBeVisible();
  await expect(
    page.getByText("Missing published records are not zero cases.")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "How this follow-up priority score is calculated",
    })
  ).toBeVisible();
  await expect(page.getByLabel("Tick and pathogen share")).toBeVisible();
  await page
    .getByText("See this county’s score components and source values")
    .click();
  await expect(page.getByText("Rurality (RUCC)")).toBeVisible();
  const results = await new AxeBuilder({ page })
    .exclude(".maplibre-atlas")
    .analyze();
  expect(results.violations).toEqual([]);
});
