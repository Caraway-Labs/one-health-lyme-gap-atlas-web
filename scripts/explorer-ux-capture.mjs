/**
 * Local verification harness for the Atlas Explorer (`/explore`) UX work
 * (WEB #788). It drives a running dev server that was started with
 * `ATLAS_E2E=1` and `NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:3999`, answers
 * every API call from this file (nothing leaves the machine), and writes
 * screenshots plus a small JSON measurement report.
 *
 * Usage:
 *   node scripts/explorer-ux-capture.mjs --base http://127.0.0.1:3788 \
 *     --out docs/evidence/web-788/after
 *
 * The fixture is synthetic. County shapes are a deterministic grid, scores and
 * completeness are generated from the FIPS code, and the release is the
 * governed alpha fixture used by the repository's Playwright specs. It is not
 * live Atlas data and must not be read as one.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.join(here, "..", "tests", "fixtures");
const readJson = (name) =>
  JSON.parse(readFileSync(path.join(fixtures, name), "utf8"));

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const base = arg("base", "http://127.0.0.1:3788");
const outDir = path.resolve(arg("out", "docs/evidence/web-788/after"));
const only = arg("only", "");
mkdirSync(outDir, { recursive: true });

const identities = readJson("review-al-published-identities.json");
const baldwin = readJson("review-al-v11-01003.json");
const RELEASE = baldwin.release.release_id;
const RAMP = [
  "#a9d2db",
  "#55a8a3",
  "#87b982",
  "#efc64a",
  "#f49a32",
  "#e9602b",
];
const UNSCORED = new Set(["01007", "01033", "01049", "01075", "01133"]);

function hash(fips) {
  let value = 17;
  for (const char of fips) {
    value = (value * 31 + char.charCodeAt(0)) % 9973;
  }
  return value;
}
function scoreFor(fips) {
  return 8 + (hash(fips) % 880) / 10;
}
function colorFor(score) {
  return RAMP[Math.min(RAMP.length - 1, Math.floor((score / 100) * RAMP.length))];
}
const STATUS = ["observed", "missing", "published_count_floor"];

function scoreCounty(entry) {
  const score = scoreFor(entry.fips);
  const scored = !UNSCORED.has(entry.fips);
  return {
    burgdorferi_status: STATUS[hash(entry.fips) % 3],
    color: colorFor(score),
    county: entry.county,
    evidence_completeness: 20 + (hash(entry.fips) % 75),
    fips: entry.fips,
    human_status: STATUS[(hash(entry.fips) >> 1) % 3],
    in_contiguous_tick_scope: scored,
    priority: "Priority 3 — Review",
    score: {
      access_signal: 40,
      community: 40,
      ecological: 55,
      human_weakness: 60,
      pathogen_signal: 50,
      rural_signal: 30,
      score,
      svi_signal: 35,
      tick_signal: 70,
    },
    scoring_methodology_version: "surveillance-gap-score-v1.1",
    state: entry.state,
    state_name: entry.stateName,
    tick_status: STATUS[(hash(entry.fips) >> 2) % 3],
  };
}

const metadata = {
  ...baldwin.release,
  release_id: RELEASE,
  states: [
    { code: "AL", name: "Alabama" },
    { code: "CO", name: "Colorado" },
  ],
};
const scoresPayload = {
  counties: identities.map(scoreCounty),
  methodology_version: "1",
  release_id: RELEASE,
  scoring_methodology_version: "surveillance-gap-score-v1.1",
  settings: { ecological_share: 65, missing_human_weakness: 75, smooth_k: 50 },
};
const geometry = {
  features: identities.map((entry, index) => {
    const west = -88 + (index % 8) * 0.4;
    const south = 30 + Math.floor(index / 8) * 0.4;
    return {
      geometry: {
        coordinates: [
          [
            [west, south],
            [west + 0.38, south],
            [west + 0.38, south + 0.38],
            [west, south + 0.38],
            [west, south],
          ],
        ],
        type: "Polygon",
      },
      properties: { fips: entry.fips },
      type: "Feature",
    };
  }),
  type: "FeatureCollection",
};
const review = {
  configuration_sha256:
    "db6df73f7bce474000165fb2b0bad9767390c21aed160a1377be6a4893004d99",
  coverage: {
    abstained_counties: 0,
    assessed_counties: 67,
    eligible_counties: 0,
    evaluated_counties: 0,
    rule_coverage: {
      human_emerging: "disabled",
      human_vector_discordance: "disabled",
      pathogen_present_vector_reported: "disabled",
      vector_transition: "disabled",
    },
  },
  data_gaps: [],
  data_release_version: RELEASE,
  effective_observation_context:
    "Current cumulative county status; human snapshot 2023",
  evaluated_at: "2026-10-06T04:57:46.000Z",
  limitations: [
    "Review is not disease risk. Candidates come only from the review result.",
  ],
  methodology_id: "atlas-county-review",
  methodology_version: "1.0.0",
  requested_observation_context: null,
  requested_state: "AL",
  result_state: "unsupported",
  review_candidates: [],
};

async function install(page) {
  await page.route("http://127.0.0.1:3999/**", (route) => {
    const url = new URL(route.request().url());
    const p = url.pathname;
    const json = (body, status = 200) => route.fulfill({ json: body, status });
    if (p === "/v1/me/profile") {
      return json({ profile: { starting_view_version: 1, state_code: null } });
    }
    if (p === "/v1/atlas/metadata") {
      return json(metadata);
    }
    if (p === "/v1/atlas/scores") {
      return json(scoresPayload);
    }
    if (p === "/v1/atlas/geometry") {
      return json(geometry);
    }
    if (/^\/v1\/states\/[A-Z]{2}\/review$/.test(p)) {
      return json(review);
    }
    const county = /^\/v1\/counties\/(\d{5})$/.exec(p);
    if (county) {
      const entry = identities.find((item) => item.fips === county[1]);
      if (!entry) {
        return json({ detail: "No published record" }, 404);
      }
      const row = scoreCounty(entry);
      return json({
        ...baldwin,
        county: entry.county,
        evidence_completeness: row.evidence_completeness,
        fips: entry.fips,
        score: { ...baldwin.score, score: row.score.score },
      });
    }
    return json({ detail: "Not part of the capture fixture" }, 404);
  });
}

const VIEWPORTS = [
  { height: 900, name: "1440x900", width: 1440 },
  { height: 720, name: "1280x720", width: 1280 },
  { height: 844, name: "390x844", width: 390 },
];
const SELECTED = "01011";
const stateUrl = `/explore?scope=AL&dataset=${RELEASE}&county=${SELECTED}`;
const VIEWS = [
  { name: "national", url: `/explore?scope=ALL&dataset=${RELEASE}` },
  { name: "state", url: `/explore?scope=AL&dataset=${RELEASE}` },
  { name: "state-county", url: stateUrl },
  { name: "evidence", url: `${stateUrl}&mode=evidence` },
  { name: "follow-up", url: `${stateUrl}&mode=follow-up` },
];

const WORDS = /\S+/g;
async function measure(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main");
    const words = (node) => (node?.innerText ?? "").match(/\S+/g)?.length ?? 0;
    const listRows = [
      ...document.querySelectorAll(
        ".ux-reset-ranked-counties, [data-explorer-shortlist], [data-testid='explorer-shortlist-table']"
      ),
    ].reduce((total, node) => total + words(node), 0);
    const map = document.querySelector(".map-wrap, [data-testid*='map-region']");
    const fontSizes = new Set();
    for (const node of main?.querySelectorAll("*") ?? []) {
      if (node.children.length === 0 && node.textContent?.trim()) {
        fontSizes.add(Math.round(Number.parseFloat(getComputedStyle(node).fontSize) * 10) / 10);
      }
    }
    return {
      bodyFontSizes: [...fontSizes].toSorted((a, b) => a - b),
      buttons: main?.querySelectorAll("button").length ?? 0,
      links: main?.querySelectorAll("a").length ?? 0,
      mapTop: map ? Math.round(map.getBoundingClientRect().top) : null,
      pageHeight: main?.scrollHeight ?? 0,
      proseWords: words(main) - listRows,
      totalWords: words(main),
    };
  });
}

const report = [];
const browser = await chromium.launch();
try {
  for (const viewport of VIEWPORTS) {
    for (const view of VIEWS) {
      const label = `${view.name}-${viewport.name}`;
      if (only && !label.includes(only)) {
        continue;
      }
      const context = await browser.newContext({
        reducedMotion: "reduce",
        viewport: { height: viewport.height, width: viewport.width },
      });
      const page = await context.newPage();
      await install(page);
      await page.goto(base + view.url, { waitUntil: "domcontentloaded" });
      await page
        .locator("[data-testid='review-scope-results'], [data-testid='explorer-county-evidence']")
        .first()
        .waitFor({ timeout: 45_000 })
        .catch(() => undefined);
      await page.waitForTimeout(2500);
      await page.screenshot({ path: path.join(outDir, `${label}.png`) });
      const metrics = await measure(page);
      report.push({ label, ...metrics });
      if (viewport.name === "1440x900") {
        await page.setViewportSize({ height: 3000, width: 1440 });
        await page.waitForTimeout(800);
        await page.screenshot({
          path: path.join(outDir, `${label}-full.png`),
        });
        if (view.name === "state-county") {
          await page.setViewportSize({ height: 900, width: 1440 });
          const trigger = page
            .getByRole("button", { name: /scenario/i })
            .first();
          if (await trigger.count()) {
            await trigger.click();
            await page.waitForTimeout(800);
            await page.screenshot({
              path: path.join(outDir, `scenario-open-1440x900.png`),
            });
            await page.setViewportSize({ height: 3000, width: 1440 });
            await page.waitForTimeout(500);
            await page.screenshot({
              path: path.join(outDir, `scenario-open-1440x900-full.png`),
            });
          }
        }
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
writeFileSync(
  path.join(outDir, "measurements.json"),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report, null, 2));
void WORDS;
