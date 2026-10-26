import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { GET } from "../src/app/docs/changelog.xml/route";
import {
  changelogPageProblems,
  changelogPinProblems,
  listContractOperations,
  loadApiChangelog,
  parseApiChangelog,
  renderAtomFeed,
  type ContractOperation,
} from "../src/lib/api-changelog";
import { getSiteOrigin } from "../src/lib/public-origins";

const ATOM = "http://www.w3.org/2005/Atom";
const directories: string[] = [];

const sampleOperation: ContractOperation = {
  href: "/docs/api-reference/observations/listObservations",
  method: "GET",
  operationId: "listObservations",
  path: "/v1/observations",
};

describe("API changelog", () => {
  afterEach(() => {
    for (const directory of directories.splice(0)) {
      rmSync(directory, { force: true, recursive: true });
    }
  });

  it("fails the docs pin check on a deliberately wrong commit", () => {
    const contractCommit = "a".repeat(40);
    const changelogCommit = "c".repeat(40);
    const root = writePinFixture({ changelogCommit, contractCommit });
    const direct = changelogPinProblems(root);
    const docsCheck = runApiChangelogPinCheck(root);

    expect({
      direct,
      mentionsScript: readFileSync("scripts/check-docs.mjs", "utf-8").includes(
        "scripts/check-api-changelog.ts"
      ),
      outputMentionsCommit:
        docsCheck.output.includes("does not match") &&
        docsCheck.output.includes(changelogCommit),
      status: docsCheck.status,
    }).toStrictEqual({
      direct: [
        `contracts/api-changelog.manifest.json sourceCommit ${changelogCommit} does not match contracts/public-openapi.manifest.json sourceCommit ${contractCommit}.`,
      ],
      mentionsScript: true,
      outputMentionsCommit: true,
      status: 1,
    });
  });

  it("fails when the changelog source file is missing", () => {
    const commit = "b".repeat(40);
    const root = writePinFixture({
      changelogCommit: commit,
      contractCommit: commit,
      includeChangelog: false,
    });
    expect(changelogPinProblems(root)).toStrictEqual([
      "contracts/api-changelog.md is missing.",
    ]);
  });

  it("keeps source labels and links named operations without schema bodies", () => {
    const releases = parseApiChangelog(
      [
        "## 2026-04-01",
        "",
        "### Breaking",
        "- **Route**: Removed `GET /v1/observations`.",
        "",
        "### Deprecation",
        "- **Clients**: Old clients should move.",
        "",
        "### Fixed",
        "- **Retries**: Honor `Retry-After`.",
        "",
        "### Changed",
        "- **Paging**: Send `page_token` unchanged.",
      ].join("\n"),
      [sampleOperation]
    );
    const release = releases[0];
    expect(release?.entries.map((entry) => entry.label)).toStrictEqual([
      "Breaking",
      "Deprecated",
      "Fixed",
      "Changed",
    ]);
    expect(release?.entries[0]?.operations).toStrictEqual([sampleOperation]);
    expect(JSON.stringify(release)).not.toContain("components/schemas");
  });

  it("renders the pinned changelog with Added entries and operation links", () => {
    const changelog = loadApiChangelog();
    const operations = listContractOperations(process.cwd());
    const dated = changelog.releases.find(
      (release) => release.date === "2026-10-25"
    );
    const examples = dated?.entries.find((entry) => entry.area === "Examples");
    const landing = dated?.entries.find(
      (entry) => entry.area === "Landing page"
    );
    const schemas = dated?.entries.find((entry) => entry.area === "Schemas");
    const missingOperations = operations
      .filter(
        (operation) =>
          !existsSync(
            path.join(
              process.cwd(),
              "content/docs",
              `${operation.href.slice("/docs/".length)}.mdx`
            )
          )
      )
      .map((operation) => operation.href);

    expect({
      commit: changelog.sourceCommit,
      examples: examples?.operations,
      labels: dated?.entries.map((entry) => entry.label),
      landing: landing?.body.includes(
        "results are not a diagnosis and not an estimate of an individual's risk."
      ),
      missingOperations,
      page: changelogPageProblems(process.cwd()),
      schemaBody: schemas?.body.includes("NO_COUNTY_LINKED_RECORD"),
      schemas: schemas?.related,
      unreleased: changelog.releases[0]?.id,
    }).toStrictEqual({
      commit: "4bc001bb6c03d16aef80762174691fdf9b898707",
      examples: operations,
      labels: dated?.entries.map(() => "Added"),
      landing: true,
      missingOperations: [],
      page: [],
      schemaBody: false,
      schemas: [{ href: "/docs/api-reference/schemas", label: "Schemas" }],
      unreleased: "unreleased",
    });
  });

  it("publishes a valid Atom feed for dated releases", async () => {
    const origin = getSiteOrigin();
    const changelog = loadApiChangelog();
    const xml = renderAtomFeed(changelog, origin);
    const response = GET();
    const document = new DOMParser().parseFromString(xml, "text/xml");
    const feedElement = atomElements(document, "feed")[0];
    if (!feedElement) throw new Error("Atom feed element is missing.");
    const self = [...feedElement.getElementsByTagNameNS(ATOM, "link")].find(
      (link) => link.getAttribute("rel") === "self"
    );
    const entries = atomElements(feedElement, "entry").map((entry) => {
      const content = text(entry, "content");
      return {
        author: text(entry, "author") || text(feedElement, "author"),
        content,
        id: text(entry, "id"),
        title: text(entry, "title"),
        updated: text(entry, "updated"),
      };
    });
    const content = entries[0]?.content ?? "";
    expect({
      bodyMatches: (await response.text()) === xml,
      contentType: response.headers.get("content-type"),
      diagnosis: content.includes("not a diagnosis"),
      entry: {
        author: entries[0]?.author,
        id: entries[0]?.id,
        title: entries[0]?.title,
        updated: entries[0]?.updated,
      },
      feed: {
        id: text(feedElement, "id"),
        operation: content.includes(
          `${origin}/docs/api-reference/observations/listObservations`
        ),
        parserErrors: document.querySelectorAll("parsererror").length,
        schemaDump:
          content.includes("NO_COUNTY_LINKED_RECORD") ||
          content.includes("components/schemas"),
        selfHref: self?.getAttribute("href"),
        selfType: self?.getAttribute("type"),
        subtitle: text(feedElement, "subtitle").includes(
          changelog.sourceCommit
        ),
        title: text(feedElement, "title"),
        updated: text(feedElement, "updated"),
      },
    }).toStrictEqual({
      bodyMatches: true,
      contentType: "application/atom+xml; charset=utf-8",
      diagnosis: true,
      entry: {
        author: "One Health Atlas",
        id: `${origin}/docs/develop/changelog#2026-10-25`,
        title: "2026-10-25",
        updated: "2026-10-25T00:00:00Z",
      },
      feed: {
        id: `${origin}/docs/changelog.xml`,
        operation: true,
        parserErrors: 0,
        schemaDump: false,
        selfHref: `${origin}/docs/changelog.xml`,
        selfType: "application/atom+xml",
        subtitle: true,
        title: "One Health Atlas API changelog",
        updated: "2026-10-25T00:00:00Z",
      },
    });
  });
});

function atomElements(parent: Document | Element, name: string): Element[] {
  return [...parent.getElementsByTagNameNS(ATOM, name)];
}

function text(parent: Element, name: string): string {
  return atomElements(parent, name)[0]?.textContent ?? "";
}

function runApiChangelogPinCheck(contentRoot: string): {
  output: string;
  status: number;
} {
  const result = spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--disable-warning=ExperimentalWarning",
      "--import",
      path.join(process.cwd(), "scripts/register-ts-extension.mjs"),
      path.join(process.cwd(), "scripts/check-api-changelog.ts"),
    ],
    {
      cwd: contentRoot,
      encoding: "utf-8",
      env: process.env,
    }
  );
  return {
    output: `${result.stdout ?? ""}\n${result.stderr ?? ""}`.trim(),
    status: result.status ?? 1,
  };
}

function writePinFixture(options: {
  changelogCommit: string;
  contractCommit: string;
  includeChangelog?: boolean;
}): string {
  const root = mkdtempSync(path.join(tmpdir(), "atlas-changelog-"));
  directories.push(root);
  const contracts = path.join(root, "contracts");
  mkdirSync(contracts);
  const changelog = "# API changelog\n\n## 2026-10-25\n\nNo changes yet.\n";
  if (options.includeChangelog !== false) {
    writeFileSync(path.join(contracts, "api-changelog.md"), changelog);
  }
  const sha256 = createHash("sha256").update(changelog).digest("hex");
  writeFileSync(
    path.join(contracts, "public-openapi.manifest.json"),
    JSON.stringify({
      sourceCommit: options.contractCommit,
      sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
    })
  );
  writeFileSync(
    path.join(contracts, "api-changelog.manifest.json"),
    JSON.stringify({
      sha256,
      sourceCommit: options.changelogCommit,
      sourcePath: "CHANGELOG.md",
      sourceRepository: "Caraway-Labs/one-health-lyme-gap-atlas-api",
    })
  );
  return root;
}
