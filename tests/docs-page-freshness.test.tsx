import { createElement, type ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

const scenario = vi.hoisted(() => ({
  current: "dated" as "dated" | "invalid" | "missing" | "undated",
}));

vi.mock(import("next/navigation"), () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

vi.mock(
  import("fumadocs-ui/page"),
  () =>
    ({
      DocsBody: ({ children }: { children?: ReactNode }) =>
        createElement("div", null, children),
      DocsDescription: ({ children }: { children?: ReactNode }) =>
        createElement("p", null, children),
      DocsPage: ({
        children,
        editOnGithub,
        lastUpdate,
      }: {
        children?: ReactNode;
        editOnGithub: { path: string; sha: string };
        lastUpdate: Date;
      }) =>
        createElement(
          "article",
          {
            "data-edit-path": editOnGithub.path,
            "data-sha": editOnGithub.sha,
            "data-updated": lastUpdate.toISOString(),
          },
          children
        ),
      DocsTitle: ({ children }: { children?: ReactNode }) =>
        createElement("h1", null, children),
    }) as unknown as typeof import("fumadocs-ui/page")
);

vi.mock(import("@/components/docs-openapi-page"), () => ({
  OpenAPIPageProvider: ({ children }: { children?: ReactNode }) =>
    createElement("div", null, children),
}));

vi.mock(
  import("@/components/docs-page-actions"),
  () =>
    ({
      DocsPageActions: () => createElement("div"),
    }) as unknown as typeof import("@/components/docs-page-actions")
);

vi.mock(
  import("@/lib/public-openapi-server"),
  () =>
    ({
      openapi: {
        preloadOpenAPIPage: async () => null,
      },
    }) as unknown as typeof import("@/lib/public-openapi-server")
);

vi.mock(import("@/mdx-components"), () => ({
  getMDXComponents: () => ({}),
}));

vi.mock(
  import("@/lib/docs-source"),
  () =>
    ({
      docsSource: {
        generateParams: () => [{ slug: ["glossary"] }],
        getPage: (slug: string[] | undefined) => {
          if (scenario.current === "missing" || slug?.[0] === "missing") {
            return;
          }
          const data: {
            body: () => ReturnType<typeof createElement>;
            description: string;
            full: boolean;
            lastModified?: Date | string;
            title: string;
            toc: [];
          } = {
            body: () => createElement("p", null, "Body"),
            description: "Terms used by the API.",
            full: false,
            title: "Glossary",
            toc: [],
          };
          if (scenario.current === "dated") {
            data.lastModified = new Date("2026-01-01T00:00:00Z");
          }
          if (scenario.current === "invalid") data.lastModified = "2026-01-01";
          return {
            data,
            path: "glossary.mdx",
            url: "/docs/glossary",
          };
        },
      },
    }) as unknown as typeof import("@/lib/docs-source")
);

const {
  default: Page,
  generateMetadata,
  generateStaticParams,
} = await import("../src/app/docs/[[...slug]]/page");

describe("docs page freshness", () => {
  it("shows the last-updated date and the GitHub edit link", async () => {
    scenario.current = "dated";
    const page = await Page({
      params: Promise.resolve({ slug: ["glossary"] }),
    });
    const metadata = await generateMetadata({
      params: Promise.resolve({ slug: ["glossary"] }),
    });

    expect({
      edit: page.props.editOnGithub.path,
      params: generateStaticParams(),
      sha: page.props.editOnGithub.sha,
      updated: page.props.lastUpdate.toISOString(),
      url: metadata.openGraph?.url,
    }).toStrictEqual({
      edit: "content/docs/glossary.mdx",
      params: [{ slug: ["glossary"] }],
      sha: "main",
      updated: "2026-01-01T00:00:00.000Z",
      url: "https://onehealthatlas.org/docs/glossary",
    });
  });

  it("stops when the page or its last-updated date is missing", async () => {
    scenario.current = "missing";
    const missingPage = await errorMessage(() =>
      Page({ params: Promise.resolve({ slug: ["missing"] }) })
    );
    const missingMetadata = await errorMessage(() =>
      generateMetadata({ params: Promise.resolve({ slug: ["missing"] }) })
    );
    scenario.current = "undated";
    const undated = await errorMessage(() =>
      Page({ params: Promise.resolve({ slug: ["glossary"] }) })
    );
    scenario.current = "invalid";
    const invalid = await errorMessage(() =>
      Page({ params: Promise.resolve({ slug: ["glossary"] }) })
    );

    expect({ invalid, missingMetadata, missingPage, undated }).toStrictEqual({
      invalid: "Docs page /docs/glossary is missing a last-updated date.",
      missingMetadata: "NEXT_NOT_FOUND",
      missingPage: "NEXT_NOT_FOUND",
      undated: "Docs page /docs/glossary is missing a last-updated date.",
    });
  });
});

async function errorMessage(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return "";
  } catch (error) {
    return error instanceof Error ? error.message : "";
  }
}
