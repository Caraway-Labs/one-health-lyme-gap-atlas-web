import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  HTTP_CLIENT_GROUP_ID,
  HTTP_CLIENT_LANGUAGES,
  httpClientExamples,
  httpClientPaginationExamples,
  httpClientUrl,
  type HttpClientExamples,
  type HttpClientRequest,
} from "@/features/docs/http-client-examples";
import { getPublishedApiOrigin } from "@/lib/public-origins";

const quickstart: HttpClientRequest = {
  path: "/v1/observations",
  query:
    "measure_id=case_count_floor_2023&geography_type=county&geography_id=36061&year=2023",
};

const comparison: HttpClientRequest = {
  path: "/v1/observations",
  query:
    "measure_id=case_count_floor_2023&geography_type=county&geography_id=08001&geography_id=36061&year=2023",
};

const pagination: HttpClientRequest = {
  path: "/v1/observations",
  query:
    "measure_id=nclimgrid_tavg_county_day&geography_type=county&geography_id=36061&year=2025&page_size=2",
};

const guides = ["quickstart.mdx", "workflows.mdx", "rest.mdx"] as const;

function readGuide(name: string): string {
  return fs.readFileSync(
    path.join(process.cwd(), "content/docs/develop", name),
    "utf-8"
  );
}

function queryPairs(query: string): [string, string][] {
  return [...new URLSearchParams(query).entries()];
}

function callInteriors(source: string, callee: string): string[] {
  const opener = `${callee}(`;
  const interiors: string[] = [];
  let searchFrom = 0;
  while (searchFrom < source.length) {
    const start = source.indexOf(opener, searchFrom);
    if (start === -1) {
      break;
    }
    const open = start + opener.length - 1;
    let depth = 0;
    let end = -1;
    for (let index = open; index < source.length; index += 1) {
      const character = source[index];
      if (character === "(") {
        depth += 1;
      }
      if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          end = index;
          break;
        }
      }
    }
    if (end === -1) {
      break;
    }
    interiors.push(source.slice(open + 1, end));
    searchFrom = end + 1;
  }
  return interiors;
}

function splitTopLevel(interior: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let quote: string | undefined;
  for (const character of interior) {
    if (quote) {
      current += character;
      if (character === quote) {
        quote = undefined;
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      current += character;
      continue;
    }
    if (character === "(") {
      depth += 1;
    }
    if (character === ")" && depth > 0) {
      depth -= 1;
    }
    if (character === "," && depth === 0) {
      parts.push(current.trim());
      current = "";
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
}

function argumentsOf(
  source: string,
  callee: string,
  includes: string
): string[] {
  const interior = callInteriors(source, callee).find((value) =>
    value.includes(includes)
  );
  return splitTopLevel(interior ?? "");
}

function emptyRArguments(source: string): string[] {
  const problems: string[] = [];
  for (const callee of ["list", "req_url_query"]) {
    for (const interior of callInteriors(source, callee)) {
      const empty = splitTopLevel(interior).filter(
        (argument) => argument.length === 0
      );
      if (empty.length > 0) {
        problems.push(callee);
      }
    }
  }
  return problems;
}

function missingFilters(
  examples: HttpClientExamples,
  request: HttpClientRequest
): string[] {
  const missing: string[] = [];
  for (const [name, value] of queryPairs(request.query ?? "")) {
    const quotedName = JSON.stringify(name);
    const quotedValue = JSON.stringify(value);
    if (!examples.Python.includes(quotedName)) {
      missing.push(`Python name ${name}`);
    }
    if (!examples.Python.includes(quotedValue)) {
      missing.push(`Python value ${value}`);
    }
    if (!examples.R.includes(name) || !examples.R.includes(quotedValue)) {
      missing.push(`R ${name}`);
    }
    if (
      !(
        examples.TypeScript.includes(quotedName) &&
        examples.TypeScript.includes(quotedValue)
      )
    ) {
      missing.push(`TypeScript ${name}`);
    }
  }
  return missing;
}

describe("persisted HTTP client examples", () => {
  it("uses one Fumadocs tab group for curl, Python, R, and TypeScript", () => {
    const component = fs.readFileSync(
      path.join(process.cwd(), "src/features/docs/http-client-tabs.tsx"),
      "utf-8"
    );
    const guidesMissingImport = guides.filter(
      (guide) =>
        !readGuide(guide).includes('from "@/features/docs/http-client-tabs"')
    );
    expect({
      groupId: HTTP_CLIENT_GROUP_ID,
      guidesMissingImport,
      languages: HTTP_CLIENT_LANGUAGES,
      persists:
        component.includes('from "fumadocs-ui/components/tabs"') &&
        component.includes("groupId={HTTP_CLIENT_GROUP_ID}") &&
        component.includes("persist") &&
        !component.includes("atlas-observation-slice"),
    }).toStrictEqual({
      groupId: "atlas-http-client",
      guidesMissingImport: [],
      languages: ["curl", "Python", "R", "TypeScript"],
      persists: true,
    });
  });

  it("calls the published origin with the quickstart and comparison filters", () => {
    const single = httpClientExamples([quickstart]);
    const compared = httpClientExamples([comparison]);
    const quickstartUrl = httpClientUrl(quickstart);
    expect({
      comparedExplode: compared.R.includes('.multi = "explode"'),
      comparedFips:
        compared.Python.includes('["08001", "36061"]') &&
        compared.R.includes('c("08001", "36061")') &&
        compared.TypeScript.match(/searchParams.append\("geography_id"/gu)
          ?.length === 2,
      comparedMissing: missingFilters(compared, comparison),
      comparedUrl: compared.curl.includes(httpClientUrl(comparison)),
      geography: JSON.stringify([single, compared]).match(
        /Alaska|Hawaii|\bAK\b|\bHI\b/u
      ),
      libraries:
        single.Python.includes("import httpx") &&
        single.Python.includes("raise_for_status()") &&
        single.R.includes("library(httr2)") &&
        single.R.includes("req_url_query(") &&
        !single.R.includes('.multi = "explode"') &&
        single.TypeScript.includes("await fetch(url)") &&
        single.curl.includes("curl -fsS"),
      published: quickstartUrl.startsWith(`${getPublishedApiOrigin()}/v1/`),
      quickstartMissing: missingFilters(single, quickstart),
      quickstartUrl: single.curl.includes(quickstartUrl),
    }).toStrictEqual({
      comparedExplode: true,
      comparedFips: true,
      comparedMissing: [],
      comparedUrl: true,
      geography: null,
      libraries: true,
      published: true,
      quickstartMissing: [],
      quickstartUrl: true,
    });
  });

  it("advances next_page_token without dropping the original filters", () => {
    const examples = httpClientPaginationExamples(pagination);
    const url = httpClientUrl(pagination);
    const preserved = queryPairs(pagination.query ?? "").filter(
      ([name, value]) =>
        !(
          examples.Python.includes(JSON.stringify(name)) &&
          examples.Python.includes(JSON.stringify(value)) &&
          examples.R.includes(`${name} = ${JSON.stringify(value)}`) &&
          examples.TypeScript.includes(
            `[${JSON.stringify(name)}, ${JSON.stringify(value)}]`
          )
        )
    );
    expect({
      continuation:
        examples.curl.includes(`url='${url}'`) &&
        examples.curl.includes('"$url&page_token=$token"') &&
        examples.curl.includes('["meta"]["next_page_token"]') &&
        examples.Python.includes('{**filters, "page_token": token}') &&
        examples.Python.includes('["meta"]["next_page_token"]') &&
        examples.R.includes("req_url_query(!!!filters, page_token = token)") &&
        examples.TypeScript.includes(
          'url.searchParams.append("page_token", pageToken)'
        ) &&
        !examples.curl.includes("page_token=<"),
      dropped: preserved.map(([name]) => name),
    }).toStrictEqual({
      continuation: true,
      dropped: [],
    });
  });

  it("keeps detail reads on the same published paths", () => {
    const examples = httpClientExamples([
      { path: "/v1/sources/human" },
      { path: "/v1/methodologies/human_confirmed_probable_case_floor_v1" },
    ]);
    const origin = getPublishedApiOrigin();
    expect({
      methodology: examples.curl.includes(
        `${origin}/v1/methodologies/human_confirmed_probable_case_floor_v1`
      ),
      names: [
        examples.Python.includes("human_body"),
        examples.Python.includes("human_confirmed_probable_case_floor_v1_body"),
        examples.R.includes("resp_body_json(human)"),
        examples.TypeScript.includes("humanResponse"),
        examples.TypeScript.includes(
          "human_confirmed_probable_case_floor_v1Response"
        ),
      ],
      source: examples.curl.includes(`${origin}/v1/sources/human`),
    }).toStrictEqual({
      methodology: true,
      names: [true, true, true, true, true],
      source: true,
    });
  });

  it("renders base-R filter lists without a trailing comma", () => {
    const paged = httpClientPaginationExamples(pagination);
    const repeated = httpClientPaginationExamples({
      path: "/v1/observations",
      query:
        "measure_id=case_count_floor_2023&geography_type=county&geography_id=08001&geography_id=36061&year=2023&page_size=2",
    });
    const samples = [
      paged.R,
      repeated.R,
      httpClientExamples([quickstart]).R,
      httpClientExamples([comparison]).R,
      httpClientExamples([
        { path: "/v1/sources/human" },
        { path: "/v1/methodologies/human_confirmed_probable_case_floor_v1" },
      ]).R,
      httpClientExamples([
        {
          body: "bytes",
          path: "/v1/counties/36061/report.pdf",
          query: "template=county-v1",
        },
      ]).R,
    ];
    expect({
      emptyArguments: samples.flatMap((sample) => emptyRArguments(sample)),
      followUp: argumentsOf(paged.R, "req_url_query", "page_token"),
      list: argumentsOf(paged.R, "list", "measure_id"),
      repeatedFollowUp: argumentsOf(repeated.R, "req_url_query", "page_token"),
      repeatedList: argumentsOf(repeated.R, "list", "measure_id"),
    }).toStrictEqual({
      emptyArguments: [],
      followUp: ["!!!filters", "page_token = token"],
      list: [
        'measure_id = "nclimgrid_tavg_county_day"',
        'geography_type = "county"',
        'geography_id = "36061"',
        'year = "2025"',
        'page_size = "2"',
      ],
      repeatedFollowUp: [
        "!!!filters",
        "page_token = token",
        '.multi = "explode"',
      ],
      repeatedList: [
        'measure_id = "case_count_floor_2023"',
        'geography_type = "county"',
        'geography_id = c("08001", "36061")',
        'year = "2023"',
        'page_size = "2"',
      ],
    });
  });

  it("reads a county PDF as bytes", () => {
    const examples = httpClientExamples([
      {
        body: "bytes",
        path: "/v1/counties/36061/report.pdf",
        query: "template=county-v1",
      },
    ]);
    expect({
      curl: examples.curl.includes(
        "/v1/counties/36061/report.pdf?template=county-v1"
      ),
      python: examples.Python.includes("payload = response.content"),
      pythonJson: examples.Python.includes(".json()"),
      r: examples.R.includes("resp_body_raw("),
      typescript: examples.TypeScript.includes("arrayBuffer()"),
    }).toStrictEqual({
      curl: true,
      python: true,
      pythonJson: false,
      r: true,
      typescript: true,
    });
  });
});
