import { readFileSync } from "node:fs";
import path from "node:path";

import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { FrameworkProvider } from "fumadocs-core/framework";
import { findPath, type Folder, type Root } from "fumadocs-core/page-tree";
import { TreeContextProvider } from "fumadocs-ui/contexts/tree";
import { getLayoutTabs } from "fumadocs-ui/layouts/shared";
import { createElement, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  developersLinkCurrent,
  DocsHeader,
  DocsHomeQuickstart,
  DocsSidebarTabs,
} from "@/components/docs-section-nav";
import {
  DOCS_HOME_PATH,
  isDocsTabCurrent,
  PRODUCT_GUIDE_TAB,
  withDocsSidebarTabs,
} from "@/lib/docs-sidebar-tabs";
import { getMDXComponents } from "@/mdx-components";

const layoutSlots = vi.hoisted(() => ({
  current: {
    isNavTransparent: false,
    slots: {} as {
      navTitle?: (props: { className?: string }) => ReactNode;
      searchTrigger?: {
        sm?: (props: { className?: string }) => ReactNode;
      };
      sidebar?: {
        trigger?: (props: {
          children?: ReactNode;
          className?: string;
        }) => ReactNode;
      };
    },
  },
}));

vi.mock(import("fumadocs-ui/layouts/docs"), () => ({
  useDocsLayout: () => layoutSlots.current as never,
}));

let pathname = DOCS_HOME_PATH;

function renderTabs(tree: Root, children: ReactNode) {
  return render(
    <FrameworkProvider
      useParams={() => ({})}
      usePathname={() => pathname}
      useRouter={() => ({
        push: () => {},
        refresh: () => {},
      })}
    >
      <TreeContextProvider tree={tree}>{children}</TreeContextProvider>
    </FrameworkProvider>
  );
}

const docsRoot = path.join(process.cwd(), "content", "docs");

function page(name: string, url: string, file: string) {
  return {
    $id: file,
    $ref: file,
    name,
    type: "page" as const,
    url,
  };
}

function folder(
  name: string,
  folderPath: string,
  children: Folder["children"],
  root = false
): Folder {
  return {
    $id: folderPath,
    $ref: { folder: folderPath },
    children,
    name,
    root,
    type: "folder",
  };
}

function fixtureTree(): Root {
  return {
    $id: "root",
    children: [
      page("Start with One Health Atlas", DOCS_HOME_PATH, "index.mdx"),
      page(
        "FAQ and troubleshooting",
        "/docs/faq-and-troubleshooting",
        "faq.mdx"
      ),
      folder(
        "Developers",
        "develop",
        [
          page("Developer overview", "/docs/develop", "develop/index.mdx"),
          page(
            "Quickstart",
            "/docs/develop/quickstart",
            "develop/quickstart.mdx"
          ),
          page(
            "MCP clients",
            "/docs/develop/mcp-clients",
            "develop/mcp-clients.mdx"
          ),
        ],
        true
      ),
      folder(
        "API reference",
        "api-reference",
        [
          page(
            "API reference",
            "/docs/api-reference",
            "api-reference/index.mdx"
          ),
          page(
            "Observations",
            "/docs/api-reference/observations",
            "api-reference/observations/index.mdx"
          ),
        ],
        true
      ),
    ],
    name: "Docs",
  };
}

function tabRoots(tree: Root): Folder[] {
  return tree.children.filter(
    (node): node is Folder => node.type === "folder" && node.root === true
  );
}

describe("documentation sidebar tabs", () => {
  afterEach(() => {
    cleanup();
    pathname = DOCS_HOME_PATH;
  });

  it("resolves Product guide, Developers, and API reference", () => {
    const tree = withDocsSidebarTabs(fixtureTree());
    const roots = tabRoots(tree);
    const tabs = getLayoutTabs(tree);

    const product = roots[0];
    expect({
      current: {
        apiObservation: isDocsTabCurrent(
          roots[2],
          "/docs/api-reference/observations"
        ),
        home: isDocsTabCurrent(product, DOCS_HOME_PATH),
        productOnQuickstart: isDocsTabCurrent(
          product,
          "/docs/develop/quickstart"
        ),
        quickstart: isDocsTabCurrent(roots[1], "/docs/develop/quickstart"),
      },
      names: roots.map((root) => root.name),
      productHoldsDevelopers: product?.children.some(
        (node) => node.type === "folder" && node.name === "Developers"
      ),
      productHoldsFaq: product?.children.some(
        (node) =>
          node.type === "page" && node.name === "FAQ and troubleshooting"
      ),
      resolved: roots.map((root) => {
        const url =
          root.index?.url ??
          root.children.find((node) => node.type === "page")?.url;
        return Boolean(
          url &&
          findPath(
            root.children,
            (node) => node.type === "page" && node.url === url
          )
        );
      }),
      tabs: tabs.map((tab) => ({ title: tab.title, url: tab.url })),
    }).toStrictEqual({
      current: {
        apiObservation: true,
        home: true,
        productOnQuickstart: false,
        quickstart: true,
      },
      names: [PRODUCT_GUIDE_TAB, "Developers", "API reference"],
      productHoldsDevelopers: false,
      productHoldsFaq: true,
      resolved: [true, true, true],
      tabs: [
        { title: PRODUCT_GUIDE_TAB, url: DOCS_HOME_PATH },
        { title: "Developers", url: "/docs/develop" },
        { title: "API reference", url: "/docs/api-reference" },
      ],
    });
  });

  it("keeps the authored tab roots and the docs home Quickstart link", () => {
    const navigation = JSON.parse(
      readFileSync(path.join(docsRoot, "meta.json"), "utf-8")
    ) as { pages?: string[] };
    const develop = JSON.parse(
      readFileSync(path.join(docsRoot, "develop", "meta.json"), "utf-8")
    ) as { root?: boolean; title?: string };
    const reference = JSON.parse(
      readFileSync(path.join(docsRoot, "api-reference", "meta.json"), "utf-8")
    ) as { root?: boolean; title?: string };

    expect(navigation.pages?.[0]).toBe("index");
    expect(navigation.pages).toStrictEqual(
      expect.arrayContaining([
        "develop",
        "api-reference",
        "faq-and-troubleshooting",
      ])
    );
    expect(develop).toMatchObject({ root: true, title: "Developers" });
    expect(reference).toMatchObject({ root: true, title: "API reference" });
  });

  it("links Quickstart from the Product guide tab only", () => {
    const tree = withDocsSidebarTabs(fixtureTree());
    pathname = "/docs/develop/quickstart";
    const { rerender } = renderTabs(tree, <DocsHomeQuickstart />);
    expect(screen.queryByRole("link", { name: "Quickstart" })).toBeNull();

    pathname = DOCS_HOME_PATH;
    rerender(
      <FrameworkProvider
        useParams={() => ({})}
        usePathname={() => pathname}
        useRouter={() => ({
          push: () => {},
          refresh: () => {},
        })}
      >
        <TreeContextProvider tree={tree}>
          <DocsHomeQuickstart />
        </TreeContextProvider>
      </FrameworkProvider>
    );
    expect(screen.getByRole("link", { name: "Quickstart" })).toHaveAttribute(
      "href",
      "/docs/develop/quickstart"
    );
  });

  it("exposes one current tab and moves focus with the arrow keys", () => {
    pathname = "/docs/develop/quickstart";
    renderTabs(withDocsSidebarTabs(fixtureTree()), <DocsSidebarTabs />);

    const tablist = screen.getByRole("tablist", {
      name: "Documentation sections",
    });
    const product = screen.getByRole("tab", { name: PRODUCT_GUIDE_TAB });
    const developers = screen.getByRole("tab", { name: "Developers" });
    const reference = screen.getByRole("tab", { name: "API reference" });
    expect({
      current: developers.getAttribute("aria-current"),
      href: developers.getAttribute("href"),
      productCurrent: product.getAttribute("aria-current"),
      productSelected: product.getAttribute("aria-selected"),
      referenceTabIndex: reference.getAttribute("tabindex"),
      selected: developers.getAttribute("aria-selected"),
    }).toStrictEqual({
      current: "page",
      href: "/docs/develop",
      productCurrent: null,
      productSelected: "false",
      referenceTabIndex: "-1",
      selected: "true",
    });

    developers.focus();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    const afterRight = document.activeElement?.textContent;
    fireEvent.keyDown(tablist, { key: "Home" });
    const afterHome = document.activeElement?.textContent;
    fireEvent.keyDown(tablist, { key: "ArrowLeft" });
    expect({
      afterHome,
      afterLeft: document.activeElement?.textContent,
      afterRight,
    }).toStrictEqual({
      afterHome: PRODUCT_GUIDE_TAB,
      afterLeft: "API reference",
      afterRight: "API reference",
    });
  });

  it("matches real pages with a trailing slash and ignores links without a file", () => {
    const linked = folder(
      "Developers",
      "develop",
      [
        { name: "Group", type: "separator" },
        {
          name: "Quickstart",
          type: "page",
          url: "/docs/develop/quickstart",
        },
        page("Developer overview", "/docs/develop", "develop/index.mdx"),
      ],
      true
    );
    expect({
      linkedQuickstart: isDocsTabCurrent(linked, "/docs/develop/quickstart"),
      missingFolder: isDocsTabCurrent(undefined, "/docs"),
      overview: isDocsTabCurrent(linked, "/docs/develop/"),
      productElsewhere: developersLinkCurrent("/docs"),
      similarPrefix: developersLinkCurrent("/docs/developer"),
    }).toStrictEqual({
      linkedQuickstart: false,
      missingFolder: false,
      overview: true,
      productElsewhere: undefined,
      similarPrefix: undefined,
    });
  });

  it("gives the first tab the tab stop when the page is outside every section", () => {
    pathname = "/docs/not-a-page";
    renderTabs(withDocsSidebarTabs(fixtureTree()), <DocsSidebarTabs />);
    expect(
      screen
        .getByRole("tab", { name: PRODUCT_GUIDE_TAB })
        .getAttribute("tabindex")
    ).toBe("0");
  });

  it("omits the tablist when a section has no page URL", () => {
    const empty = withDocsSidebarTabs({
      $id: "root",
      children: [{ name: "Note", type: "separator" }],
      name: "docs",
    });
    renderTabs(empty, <DocsSidebarTabs />);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("labels a non-text tab and activates it from the keyboard", () => {
    const tree = withDocsSidebarTabs(fixtureTree());
    const product = tree.children[0];
    if (product?.type === "folder") product.name = <em>ignored</em>;
    pathname = DOCS_HOME_PATH;
    renderTabs(tree, <DocsSidebarTabs />);
    const tablist = screen.getByRole("tablist", {
      name: "Documentation sections",
    });
    const section = screen.getByRole("tab", { name: "Section" });
    section.focus();
    fireEvent.keyDown(tablist, { key: "End" });
    const afterEnd = document.activeElement?.textContent;
    fireEvent.keyDown(tablist, { key: "ArrowUp" });
    const afterUp = document.activeElement?.textContent;
    fireEvent.keyDown(tablist, { key: "ArrowDown" });
    fireEvent.keyDown(tablist, { key: "a" });
    const clicks = vi.fn<() => void>();
    const originalClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = clicks;
    fireEvent.keyDown(tablist, { key: " " });
    HTMLAnchorElement.prototype.click = originalClick;
    (document.activeElement as HTMLElement | null)?.blur();
    fireEvent.keyDown(tablist, { key: "ArrowRight" });
    expect({
      afterEnd,
      afterUp,
      clicks: clicks.mock.calls.length,
      stayed: document.activeElement === document.body,
    }).toStrictEqual({
      afterEnd: "API reference",
      afterUp: "Developers",
      clicks: 1,
      stayed: true,
    });
  });

  it("shows the Developers header link and the sidebar controls", () => {
    layoutSlots.current.slots = {
      navTitle: ({ className }) => (
        <a className={className} href="https://example.com/docs">
          One Health Atlas documentation
        </a>
      ),
      searchTrigger: {
        sm: ({ className }) => (
          <button className={className} type="button">
            Search
          </button>
        ),
      },
      sidebar: {
        trigger: ({ children, className }) => (
          <button className={className} type="button">
            {children}
            Open Sidebar
          </button>
        ),
      },
    };
    pathname = "/docs/develop/";
    renderTabs(withDocsSidebarTabs(fixtureTree()), <DocsHeader />);
    expect({
      brand: screen
        .getByRole("link", { name: "One Health Atlas documentation" })
        .getAttribute("href"),
      current: screen
        .getByRole("link", { name: "Developers" })
        .getAttribute("aria-current"),
      search: screen.getByRole("button", { name: "Search" }).tagName,
      sidebar: screen.getByRole("button", { name: "Open Sidebar" }).tagName,
    }).toStrictEqual({
      brand: "https://example.com/docs",
      current: "page",
      search: "BUTTON",
      sidebar: "BUTTON",
    });
  });

  it("keeps the Developers link when header slots are absent", () => {
    layoutSlots.current.slots = { searchTrigger: {} };
    pathname = "/docs";
    renderTabs(withDocsSidebarTabs(fixtureTree()), <DocsHeader />);
    expect({
      current: screen
        .getByRole("link", { name: "Developers" })
        .getAttribute("aria-current"),
      sidebar: screen.queryByRole("button"),
    }).toStrictEqual({
      current: null,
      sidebar: null,
    });
  });

  it("renders plain docs headings, links, and tables", () => {
    const components = getMDXComponents();
    render(
      createElement(
        "div",
        null,
        createElement(components.h2 as "h2", null, "Query a county"),
        createElement(
          components.a as "a",
          { href: "https://api.onehealthatlas.org/openapi.json" },
          "OpenAPI schema"
        ),
        createElement(
          components.table as "table",
          null,
          createElement(
            "tbody",
            null,
            createElement("tr", null, createElement("td", null, "rows"))
          )
        )
      )
    );
    const link = screen.getByRole("link", { name: "OpenAPI schema" });
    expect({
      heading: screen.getByRole("heading", { name: "Query a county" }).tagName,
      href: link.getAttribute("href"),
      table: screen.getByRole("table").tagName,
      target: link.getAttribute("target"),
    }).toStrictEqual({
      heading: "H2",
      href: "https://api.onehealthatlas.org/openapi.json",
      table: "TABLE",
      target: null,
    });
  });

  it("registers the shared MDX components used by docs pages", () => {
    const components = getMDXComponents();
    const names = [
      "Accordion",
      "Accordions",
      "Callout",
      "Card",
      "Cards",
      "OpenAPIPage",
      "Step",
      "Steps",
      "Tab",
      "Tabs",
      "TypeTable",
    ];

    expect(
      names.filter((name) => components[name] === undefined)
    ).toStrictEqual([]);
  });
});
