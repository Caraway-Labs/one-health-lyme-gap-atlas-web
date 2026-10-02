import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { metadata as geographyFirstMetadata } from "@/app/ux-lab/geography-first/layout";
import { UxLabPage } from "@/app/ux-lab/page";
import { metadata as peopleFirstHubMetadata } from "@/app/ux-lab/people-first-hub/layout";
import { metadata as personaGatewayMetadata } from "@/app/ux-lab/persona-gateway/layout";
import { metadata as publicFirstMetadata } from "@/app/ux-lab/public-first/layout";
import { metadata as publicSiteMetadata } from "@/app/ux-lab/public-site-pro-app/layout";
import { metadata as threeLanesMetadata } from "@/app/ux-lab/three-lanes/layout";
import {
  UX_LAB_AUDIENCES,
  UX_LAB_BANNER_LABEL,
  UX_LAB_COMPARISON_CRITERIA,
  UX_LAB_CONCEPTS,
  UX_LAB_CONCEPT_IDS,
  UX_LAB_KNOWN_LIMITATIONS,
  UX_LAB_MOCKED_INTERACTIONS,
  UX_LAB_PATH,
  UX_LAB_ROBOTS,
  UX_LAB_SAMPLE_NOTICE,
  UX_LAB_SAMPLE_TOPICS,
  UX_LAB_SECOND_ROUND_LABEL,
  UX_LAB_SESSION_ROUTES,
  UX_LAB_TESTING_LABEL,
  uxLabConceptById,
  uxLabMetadata,
  uxLabSampleTopicsForAudience,
} from "@/features/ux-lab/prototype-contract";
import { UxLabShell } from "@/features/ux-lab/ux-lab-shell";
import { UxLabTestingStatement } from "@/features/ux-lab/ux-lab-testing-statement";
import {
  FOOTER_NAVIGATION_ITEMS,
  NAVIGATION_ITEMS,
  UTILITY_NAVIGATION_ITEMS,
  pageMetadataForRoute,
} from "@/lib/navigation";

describe("UX Lab harness", () => {
  afterEach(cleanup);

  it("publishes six distinct concept routes under the hidden namespace", () => {
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
    ).toStrictEqual([...UX_LAB_CONCEPT_IDS]);
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
    expect(uxLabMetadata().robots).toStrictEqual(UX_LAB_ROBOTS);
    for (const conceptMetadata of [
      geographyFirstMetadata,
      peopleFirstHubMetadata,
      personaGatewayMetadata,
      publicFirstMetadata,
      publicSiteMetadata,
      threeLanesMetadata,
    ]) {
      expect(conceptMetadata.robots).toStrictEqual(UX_LAB_ROBOTS);
    }
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
    expect(screen.queryAllByText("Planned")).toHaveLength(
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

  it("links the available Three Lanes concept from the index", () => {
    render(<UxLabPage />);

    expect(
      screen
        .getByRole("link", { name: "Open One Atlas / Three Lanes" })
        .getAttribute("href")
    ).toBe("/ux-lab/three-lanes");
  });

  it("links the people-first hub second-round concept from the index", () => {
    render(
      <UxLabShell>
        <UxLabPage />
      </UxLabShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Open People-First Atlas Hub" })
        .getAttribute("href")
    ).toBe("/ux-lab/people-first-hub");
    expect(screen.getByText(UX_LAB_SECOND_ROUND_LABEL)).toBeTruthy();
    expect(uxLabConceptById("people-first-hub").researchRound).toBe("second");
  });

  it("links the available public-site prototype from the index", () => {
    render(
      <UxLabShell>
        <UxLabPage />
      </UxLabShell>
    );

    expect(
      screen
        .getByRole("link", { name: "Open Public Site + Professional App" })
        .getAttribute("href")
    ).toBe("/ux-lab/public-site-pro-app");
  });

  it("states each hypothesis and keeps the comparison guide neutral", () => {
    render(<UxLabPage />);

    expect(screen.getAllByText(`${UX_LAB_TESTING_LABEL}.`)).toHaveLength(
      UX_LAB_CONCEPTS.length
    );
    expect(
      screen.getByRole("heading", { name: "Comparison guide" })
    ).toBeTruthy();
    for (const criterion of UX_LAB_COMPARISON_CRITERIA) {
      expect(
        screen.getByRole("heading", { name: criterion.label })
      ).toBeTruthy();
      expect(criterion.prompt).not.toMatch(
        /best|winner|recommend|selected|score/i
      );
    }
    for (const concept of UX_LAB_CONCEPTS) {
      expect(screen.getByText(concept.hypothesis)).toBeTruthy();
      expect(
        screen.getByRole("link", { name: `Open ${concept.title}` })
      ).toBeTruthy();
    }
  });

  it("lists workshop routes, limitations, and mocked interactions", () => {
    render(<UxLabPage />);

    expect(
      screen.getByRole("heading", { name: "Session routes" })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Prototype limits" })
    ).toBeTruthy();
    for (const route of UX_LAB_SESSION_ROUTES) {
      expect(
        screen.getByRole("link", { name: route.label }).getAttribute("href")
      ).toBe(route.href);
    }
    for (const limitation of UX_LAB_KNOWN_LIMITATIONS) {
      expect(screen.getByText(limitation)).toBeTruthy();
    }
    for (const interaction of UX_LAB_MOCKED_INTERACTIONS) {
      expect(screen.getByText(interaction.detail)).toBeTruthy();
      expect(
        uxLabConceptById(interaction.conceptId).title.length
      ).toBeGreaterThan(0);
    }
    expect(UX_LAB_SESSION_ROUTES.map((route) => route.href)).toStrictEqual(
      expect.arrayContaining(UX_LAB_CONCEPTS.map((concept) => concept.href))
    );
  });

  it("keeps first-round concept copy unchanged on the index", () => {
    const firstRoundIds = UX_LAB_CONCEPT_IDS.filter(
      (id) => uxLabConceptById(id).researchRound === undefined
    );
    expect(firstRoundIds).toHaveLength(5);
    render(<UxLabPage />);
    for (const id of firstRoundIds) {
      const concept = uxLabConceptById(id);
      expect(screen.getByText(concept.hypothesis)).toBeTruthy();
      expect(screen.getByText(concept.difference)).toBeTruthy();
    }
  });

  it("repeats the testing statement on a concept route", () => {
    render(<UxLabTestingStatement conceptId="geography-first" />);

    expect(
      screen.getByRole("complementary", { name: UX_LAB_TESTING_LABEL })
        .textContent
    ).toContain(uxLabConceptById("geography-first").hypothesis);
    expect(
      screen
        .getByRole("link", { name: "Comparison guide" })
        .getAttribute("href")
    ).toBe("/ux-lab#ux-lab-comparison");
  });
});
