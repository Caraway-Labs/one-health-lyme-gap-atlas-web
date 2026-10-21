import { readFile } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const metadata = {
  bundle_sha256: "a".repeat(64),
  generated_at: "2026-08-06T05:37:16Z",
  limitations: "Not individual risk.",
  loaded_at: "2026-08-15T00:00:00Z",
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
  scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
        features: [
          {
            geometry: {
              coordinates: [
                [
                  [-105, 39],
                  [-104, 39],
                  [-104, 40],
                  [-105, 40],
                  [-105, 39],
                ],
              ],
              type: "Polygon",
            },
            id: "08001",
            properties: { fips: "08001" },
            type: "Feature",
          },
          {
            geometry: {
              coordinates: [
                [
                  [-118.7, 33.7],
                  [-118.3, 33.7],
                  [-118.3, 34],
                  [-118.7, 34],
                  [-118.7, 33.7],
                ],
              ],
              type: "Polygon",
            },
            id: "06037",
            properties: { fips: "06037" },
            type: "Feature",
          },
        ],
        type: "FeatureCollection",
      };
    } else if (url.pathname.endsWith("/scores")) {
      body = {
        release_id: metadata.release_id,
        scoring_methodology_version: "surveillance-gap-score-v1.1" as const,
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
      const requestedFips = url.pathname.match(/\/counties\/(\d{5})/)?.[1];
      const selected =
        requestedFips === comparisonSummary.fips ? comparisonSummary : summary;
      body = {
        ...selected,
        case_count_floor_2023: null,
        incidence_floor_2023: null,
        pacificus_status: "No records",
        population: 500_000,
        release: metadata,
        rucc_2023: 2,
        scapularis_status: "Established",
        state_unallocated_records_2023: 1,
        uninsured_percent: 8,
        uninsured_percentile: 0.5,
        svi_percentile: 0.5,
      };
    } else if (url.pathname === "/v1/me/profile") {
      body = { profile: { starting_view_version: 1, state_code: null } };
    } else if (url.pathname.endsWith("/knowledge-graph/chat")) {
      body = {
        request_id: "request-1",
        conversation_id: "conversation-1",
        conversation_token: "opaque-token",
        assistant_policy_version: "policy-v1",
        configuration_version: "kg-v1.0.0",
        status: "answered",
        evidence_state: "limited",
        source_used: "literature_evidence",
        answer: "Reviewed claim.",
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

test("TC01–TC05 and TC09: public entry, explorer navigation, and trust pages", async ({
  page,
}) => {
  await page.goto("/overview");
  // Startup replaces the scope-less redirect with explicit national scope.
  // That history entry is the canonical URL; Back must not restore a bare
  // /explore that could apply a different saved starting view.
  await expect(page).toHaveURL(/\/explore\?scope=ALL$/);
  await page.goto("/docs");
  await page.goBack();
  await expect(page).toHaveURL(/\/explore\?scope=ALL$/);
  await page.goForward();
  await expect(page).toHaveURL(/\/docs$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/explore\?scope=ALL$/);
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Explore county Lyme data",
    })
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Find counties that may deserve a closer look.",
    })
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { exact: true, name: "Geographic Explorer" })
  ).toHaveCount(0);

  for (const [path, heading] of [
    ["/docs", "Start with One Health Atlas"],
    ["/privacy", "Privacy without the fine print."],
    ["/ai-ethics", "How Atlas approaches AI"],
  ] as const) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  }
  await expect(
    page.getByText(/human oversight|clinical/i).first()
  ).toBeVisible();
});

test("TC06–TC08: research and sign-in shells fail safely without authentication", async ({
  page,
}) => {
  await page.route("**/v1/knowledge-graph/chat", (route) =>
    route.fulfill({
      status: 503,
      json: { detail: "Evidence service unavailable" },
    })
  );
  await page.goto("/assistant");
  await expect(
    page.getByRole("heading", { name: "Atlas Assistant" })
  ).toBeVisible();
  await page.getByLabel("Your question").fill("What evidence is available?");
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.locator(".chat-panel").getByRole("alert")).toContainText(
    /did not complete|unavailable|503/i
  );
  await expect(
    page.getByRole("heading", { name: "Atlas Assistant" })
  ).toBeVisible();

  await expect(page.getByText(/not medical advice/)).toBeVisible();

  await page.goto("/auth/sign-in");
  await expect(
    page.getByRole("heading", { name: "Sign in or create an account" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Email me a sign-in link" })
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Privacy" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Help" })).toBeVisible();
});

test("TC22: approved favicon is shared by public and professional routes", async ({
  page,
  request,
}) => {
  const failedFavicons: string[] = [];
  page.on("response", (response) => {
    if (response.url().includes("favicon") && response.status() === 404)
      failedFavicons.push(response.url());
  });
  const version = "?v=summit-compass-north-20261010";
  const icons = [
    { name: "favicon.ico", sizes: "16x16 32x32 48x48", type: "image/x-icon" },
    { name: "favicon-16x16.png", sizes: "16x16", type: "image/png" },
    { name: "favicon-32x32.png", sizes: "32x32", type: "image/png" },
    { name: "favicon-48x48.png", sizes: "48x48", type: "image/png" },
    { name: "apple-touch-icon.png", sizes: "180x180", type: "image/png" },
  ];
  for (const colorScheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme });
    for (const path of ["/", "/explore"]) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path === "/" ? "/$" : path}`));
      for (const refresh of [false, true]) {
        if (refresh) await page.reload();
        await expect(page.locator('head link[rel="icon"]')).toHaveCount(4);
        await expect(
          page.locator('head link[rel="apple-touch-icon"]')
        ).toHaveCount(1);
        for (const asset of icons) {
          const rel =
            asset.name === "apple-touch-icon.png" ? "apple-touch-icon" : "icon";
          const link = page.locator(
            `head link[rel="${rel}"][href="/${asset.name}${version}"]`
          );
          await expect(link).toHaveAttribute("sizes", asset.sizes);
          await expect(link).toHaveAttribute("type", asset.type);
        }
        await expect(
          page.locator('head link[href*="favicon.svg"]')
        ).toHaveCount(0);
      }
    }
  }
  for (const name of [
    ...icons.map((asset) => asset.name),
    "android-chrome-192x192.png",
    "android-chrome-512x512.png",
  ]) {
    for (const suffix of ["", version]) {
      const response = await request.get(`/${name}${suffix}`, {
        maxRedirects: 0,
      });
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toMatch(
        name.endsWith(".ico")
          ? /^image\/(x-icon|vnd\.microsoft\.icon)/
          : /^image\/png/
      );
      const bytes = await response.body();
      expect(bytes.equals(await readFile(`public/${name}`))).toBe(true);
      if (name.endsWith(".png")) {
        const size =
          name === "apple-touch-icon.png"
            ? 180
            : Number(name.match(/(\d+)x\d+/)?.[1]);
        expect(bytes.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
        expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([
          size,
          size,
        ]);
      } else {
        expect(bytes.readUInt16LE(0)).toBe(0);
        expect(bytes.readUInt16LE(2)).toBe(1);
        expect(bytes.readUInt16LE(4)).toBe(3);
        expect(
          [0, 1, 2].map((index) => [
            bytes[6 + index * 16],
            bytes[7 + index * 16],
          ])
        ).toEqual([
          [16, 16],
          [32, 32],
          [48, 48],
        ]);
      }
    }
  }
  expect(failedFavicons).toEqual([]);
});

test("drawer hands the local conversation to the accessible workspace", async ({
  page,
}) => {
  await page.goto("/account");
  await page.getByRole("button", { name: "Atlas Assistant" }).click();
  const dialog = page.getByRole("dialog", { name: "Atlas Assistant" });
  await expect(dialog).toContainText("not medical advice");
  await dialog.getByLabel("Your question").fill("What evidence is reviewed?");
  await dialog.getByRole("button", { exact: true, name: "Ask" }).click();
  await expect(dialog).toContainText("Reviewed claim.");
  await expect(
    dialog.getByRole("link", { name: /Reviewed paper/ })
  ).toHaveAttribute("rel", "noopener noreferrer");
  await dialog.getByRole("link", { name: "Open full workspace" }).click();
  await expect(page).toHaveURL(/\/assistant\?conversation=conversation-1/);
  await expect(page.getByText("Reviewed claim.")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("redirects legacy research links to the single assistant workspace", async ({
  page,
}) => {
  await page.goto("/knowledge-graph?conversation=legacy-conversation");
  await expect(page).toHaveURL(/\/assistant(?:\?|$)/);
  await expect(page).not.toHaveURL(/conversation=legacy-conversation/);
  await expect(
    page.locator("[data-assistant-state='conversation_not_found']")
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Atlas Assistant" })
  ).toBeVisible();
  await expect(page.getByLabel("Your question")).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("retired public analytical bookmarks open Atlas Explorer", async ({
  page,
}) => {
  const cases: { county: string | null; mode: string | null; start: string }[] =
    [
      { county: null, mode: null, start: "/overview" },
      {
        county: "08001",
        mode: null,
        start: "/overview?county=08001&state=CO",
      },
      { county: "08001", mode: null, start: "/overview?county=08001" },
      {
        county: "08001",
        mode: null,
        start: "/overview?county=08001&dataset=alpha-2026-08-06",
      },
      { county: null, mode: null, start: "/investigate" },
      {
        county: "08001",
        mode: "evidence",
        start: "/investigate?county=08001",
      },
      {
        county: "08001",
        mode: "evidence",
        start: "/investigate?county=08001&eco=70&smooth=15&missing=80",
      },
      {
        county: "08001",
        mode: null,
        start: "/geographic_explorer?county=08001",
      },
    ];

  for (const item of cases) {
    await page.goto(item.start);
    await expect(page).toHaveURL(/\/explore/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Explore county Lyme data",
      })
    ).toBeVisible();
    const params = new URL(page.url()).searchParams;
    expect(params.get("county")).toBe(item.county);
    expect(params.get("mode")).toBe(item.mode);
    if (item.county === null) {
      expect(params.get("county")).not.toBe("06037");
    }
    expect(params.get("eco")).toBeNull();
    expect(params.get("breakpoint")).toBeNull();
    expect(params.get("missing")).toBeNull();
    await expect(
      page.getByRole("link", { exact: true, name: "Geographic Explorer" })
    ).toHaveCount(0);
    await expect(
      page.getByRole("link", { exact: true, name: "Investigation Workspace" })
    ).toHaveCount(0);
  }
});

test("publishes an accessible, clear privacy summary", async ({ page }) => {
  await page.goto("/privacy");

  await expect(page).toHaveURL(/\/privacy$/);
  await expect(
    page.getByRole("heading", { name: "Privacy without the fine print." })
  ).toBeVisible();
  await expect(
    page.getByText(
      /After you allow optional analytics in Privacy settings, Atlas sends allowlisted product events to Amplitude/
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
      /Signed-in users can start Export my data and Remove all data from Account and from professional Settings/
    )
  ).toBeVisible();
  await expect(
    page.getByText(
      /pages that use the analytical shell, including the public Atlas, Account, and sign-in/
    )
  ).toBeVisible();
  await expect(
    page.getByText(/professional workspace does not start that analytics SDK/)
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

test("does not contact Amplitude before consent or after opt-out", async ({
  page,
}) => {
  const amplitudeCalls: string[] = [];
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await expect.poll(() => amplitudeCalls, { timeout: 5_000 }).toEqual([]);
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await page
    .getByRole("dialog", { name: "Privacy settings" })
    .getByRole("button", { name: "Keep optional analytics off" })
    .click();
  await page.reload();
  await expect.poll(() => amplitudeCalls).toEqual([]);
});

test("sends Amplitude events after analytics consent", async ({ page }) => {
  const amplitudeCalls: string[] = [];
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.fulfill({ status: 200, body: "{}" });
  });
  await page.goto("/");
  await expect.poll(() => amplitudeCalls, { timeout: 5_000 }).toEqual([]);
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await page
    .getByRole("dialog", { name: "Privacy settings" })
    .getByRole("button", { name: "Allow optional analytics" })
    .click();
  await expect
    .poll(() => amplitudeCalls.length, { timeout: 10_000 })
    .toBeGreaterThan(0);
});

test("keeps Amplitude off when Do Not Track is enabled", async ({ page }) => {
  const amplitudeCalls: string[] = [];
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "doNotTrack", {
      configurable: true,
      get: () => "1",
    });
  });
  await page.route(/amplitude/i, async (route) => {
    amplitudeCalls.push(route.request().url());
    await route.abort();
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Privacy settings" }).click();
  await expect(
    page.getByRole("button", { name: "Allow optional analytics" })
  ).toBeDisabled();
  await expect.poll(() => amplitudeCalls).toEqual([]);
});
