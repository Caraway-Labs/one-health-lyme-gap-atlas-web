import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { UxLabPage } from "@/app/ux-lab/page";
import {
  UX_LAB_AUDIENCES,
  UX_LAB_BANNER_LABEL,
  UX_LAB_CONCEPTS,
  UX_LAB_CONCEPT_IDS,
  UX_LAB_PATH,
  UX_LAB_SAMPLE_NOTICE,
  UX_LAB_SAMPLE_TOPICS,
  uxLabMetadata,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";
import { UxLabShell } from "@/features/ux-lab/ux-lab-shell";
import {
  FOOTER_NAVIGATION_ITEMS,
  NAVIGATION_ITEMS,
  UTILITY_NAVIGATION_ITEMS,
  pageMetadataForRoute,
} from "@/lib/navigation";

describe("UX Lab harness", () => {
  afterEach(cleanup);

  it("publishes five distinct concept routes under the hidden namespace", () => {
    expect(UX_LAB_CONCEPTS.map((concept) => concept.id)).toStrictEqual([
      ...UX_LAB_CONCEPT_IDS,
    ]);
    expect(new Set(UX_LAB_CONCEPTS.map((concept) => concept.href)).size).toBe(
      UX_LAB_CONCEPTS.length
    );
    for (const concept of UX_LAB_CONCEPTS) {
      expect(concept.href.startsWith(`${UX_LAB_PATH}/`)).toBeTruthy();
      expect(["available", "planned"]).toContain(concept.status);
      expect(concept.hypothesis.length).toBeGreaterThan(0);
    }
    expect(
      UX_LAB_CONCEPTS.filter((concept) => concept.status === "available").map(
        (concept) => concept.id
      )
    ).toStrictEqual(["persona-gateway", "public-first", "geography-first"]);
  });

  it("keeps sample topics free of scores, classifications, and clinical direction", () => {
    const prohibited =
      /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;
    expect(UX_LAB_SAMPLE_TOPICS.length).toBeGreaterThan(0);
    expect(UX_LAB_SAMPLE_NOTICE.toLowerCase()).toContain("sample");
    for (const topic of UX_LAB_SAMPLE_TOPICS) {
      expect(topic.summary).not.toMatch(prohibited);
      expect(topic.title).not.toMatch(prohibited);
    }
    for (const audience of UX_LAB_AUDIENCES) {
      expect(uxLabSampleTopicsForAudience(audience).length).toBeGreaterThan(0);
    }
  });

  it("marks prototype routes noindex and leaves them out of the sitemap", () => {
    expect(uxLabMetadata().robots).toStrictEqual({
      follow: false,
      index: false,
    });
    expect(uxLabMetadata().alternates?.canonical).toBeNull();
    expect(pageMetadataForRoute(UX_LAB_PATH)).toStrictEqual({
      description: uxLabMetadata().description,
      title: "UX Lab | One Health Lyme Gap Atlas",
    });

    const rules = robots().rules;
    const rule = Array.isArray(rules) ? rules[0] : rules;
    expect(rule).toMatchObject({
      allow: "/",
      disallow: UX_LAB_PATH,
      userAgent: "*",
    });
    expect(
      sitemap().some((entry) => entry.url.includes(UX_LAB_PATH))
    ).toBeFalsy();
  });

  it("keeps the lab out of sidebar, utility, and footer navigation", () => {
    const visibleHrefs = [
      ...NAVIGATION_ITEMS,
      ...UTILITY_NAVIGATION_ITEMS,
      ...FOOTER_NAVIGATION_ITEMS,
    ].map((item) => item.href);
    expect(visibleHrefs).not.toContain(UX_LAB_PATH);
  });

  it("shows the research banner around prototype content", () => {
    render(
      <UxLabShell>
        <UxLabPage />
      </UxLabShell>
    );

    expect(
      screen.getByRole("region", { name: "Prototype status" }).textContent
    ).toContain(UX_LAB_BANNER_LABEL);
    expect(
      screen.getByRole("heading", { level: 1, name: "Atlas UX Lab" })
    ).toBeTruthy();
    expect(screen.getAllByText("Planned")).toHaveLength(
      UX_LAB_CONCEPTS.filter((concept) => concept.status === "planned").length
    );
    expect(
      screen
        .getByRole("link", { name: "Open Geography-First" })
        .getAttribute("href")
    ).toBe("/ux-lab/geography-first");
  });

  it("links the prototype shell back to the production Atlas", () => {
    render(
      <UxLabShell>
        <UxLabPage />
      </UxLabShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Production Atlas" })
        .getAttribute("href")
    ).toBe("/");
    expect(
      screen.getByRole("link", { name: "Skip to prototype content" })
    ).toBeTruthy();
  });

  it("links the available Persona Gateway concept from the index", () => {
    render(<UxLabPage />);

    expect(
      screen
        .getByRole("link", { name: "Open Persona Gateway" })
        .getAttribute("href")
    ).toBe("/ux-lab/persona-gateway");
  });

  it("links the public-first concept once that prototype exists", () => {
    render(
      <UxLabShell>
        <UxLabPage />
      </UxLabShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Open Public-First Local Snapshot" })
        .getAttribute("href")
    ).toBe("/ux-lab/public-first");
  });
});
