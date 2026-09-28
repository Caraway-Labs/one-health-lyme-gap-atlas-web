import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { UxLabPage } from "@/app/ux-lab/page";
import { UX_LAB_CONCEPTS } from "@/features/ux-lab/prototype-contract";
import { ClinicalResourcePage } from "@/features/ux-lab/three-lanes/clinical-lane";
import {
  CLINICAL_RESOURCES,
  INTELLIGENCE_ENTRIES,
  LEARN_TOPICS,
  THREE_LANES,
  THREE_LANES_LEARN_NOTICE,
  THREE_LANES_PATH,
  threeLaneById,
  threeLaneItem,
  threeLaneItemPath,
  threeLanePath,
  type ThreeLaneItem,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrontDoor } from "@/features/ux-lab/three-lanes/front-door";
import { IntelligenceTopicPage } from "@/features/ux-lab/three-lanes/intelligence-lane";
import {
  LearnArticle,
  LearnLanePage,
} from "@/features/ux-lab/three-lanes/learn-lane";

const PUBLIC_JARGON =
  /surveillance|incidence|epidemiolog|underreport|case rate|priority score|action center/i;

const PROHIBITED_CLAIMS =
  /incidence|high risk|priority \d|treatment|diagnos|recommend|percent|\d+%/i;

describe("One Atlas / Three Lanes prototype", () => {
  afterEach(cleanup);

  it("puts three peer lanes in the front door without an audience gate", () => {
    render(<ThreeLanesFrontDoor />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "One Atlas, three peer lanes",
      })
    ).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/choose an audience/i);
    expect(
      screen.getByRole("navigation", { name: "Atlas lanes" })
    ).toBeTruthy();

    for (const lane of Object.values(THREE_LANES)) {
      expect(
        screen
          .getByRole("link", { name: exactName(lane.navLabel) })
          .getAttribute("href")
      ).toBe(threeLanePath(lane.id));
      expect(
        screen.getByRole("heading", { level: 2, name: lane.navLabel })
      ).toBeTruthy();
    }
  });

  it("shows the shared tick-awareness topic in all three lanes", () => {
    render(<ThreeLanesFrontDoor />);

    expect(
      screen
        .getByRole("link", { name: "Learn: Tick awareness" })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("learn", "tick-awareness"));
    expect(
      screen
        .getByRole("link", {
          name: "Clinical Resources: Tick awareness handout",
        })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("clinical", "tick-awareness-handout"));
    expect(
      screen
        .getByRole("link", {
          name: "Public Health & Intelligence: Shared outreach",
        })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("intelligence", "shared-outreach"));
  });

  it("keeps Learn in plain language and links the shared handout", () => {
    render(<LearnLanePage />);
    expect(document.body.textContent).not.toMatch(PUBLIC_JARGON);
    expect(document.body.textContent).toContain(THREE_LANES_LEARN_NOTICE);

    const topic = learnTopic("tick-awareness");
    cleanup();
    render(<LearnArticle topic={topic} />);

    expect(document.body.textContent).not.toMatch(PUBLIC_JARGON);
    expect(
      screen
        .getByRole("link", {
          name: "Clinical Resources: Tick awareness handout",
        })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("clinical", "tick-awareness-handout"));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("shows source and freshness on clinical resource discovery", () => {
    const resource = clinicalResource("tick-awareness-handout");
    render(<ClinicalResourcePage resource={resource} />);

    expect(screen.getByText(resource.source)).toBeTruthy();
    expect(screen.getByText(resource.freshness)).toBeTruthy();
    expect(document.body.textContent).toMatch(/specific patient/i);
    expect(
      screen
        .getByRole("link", { name: "Learn: Tick awareness" })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("learn", "tick-awareness"));
    expect(screen.queryByRole("table")).toBeNull();
  });

  it("keeps a professional evidence desk with the live workspace link", () => {
    const entry = intelligenceEntry("action-center");
    render(<IntelligenceTopicPage entry={entry} />);

    expect(screen.getByRole("table")).toBeTruthy();
    expect(document.body.textContent).toContain("Action Center");
    expect(
      screen
        .getByRole("link", { name: "Live investigation workspace" })
        .getAttribute("href")
    ).toBe("/investigate");
    expect(
      screen
        .getByRole("link", {
          name: "Clinical Resources: Reporting resource links",
        })
        .getAttribute("href")
    ).toBe(threeLaneItemPath("clinical", "reporting-links"));
  });

  it("resolves lanes and items and rejects unknown ids", () => {
    expect(threeLaneById("learn")?.navLabel).toBe("Learn");
    expect(threeLaneById("audience")).toBeUndefined();
    expect(threeLaneItem("learn", "tick-awareness")?.title).toBe(
      "Tick awareness"
    );
    expect(threeLaneItem("learn", "action-center")).toBeUndefined();
    expect(threeLaneItem("missing", "tick-awareness")).toBeUndefined();
  });

  it("links the concept from the UX Lab index and avoids unsupported claims", () => {
    render(<UxLabPage />);
    expect(
      screen
        .getByRole("link", { name: "Open One Atlas / Three Lanes" })
        .getAttribute("href")
    ).toBe(THREE_LANES_PATH);
    expect(THREE_LANES_PATH).toBe("/ux-lab/three-lanes");
    expect(
      UX_LAB_CONCEPTS.find((concept) => concept.id === "three-lanes")?.status
    ).toBe("available");

    const copy = [
      ...Object.values(THREE_LANES).flatMap((lane) => [
        lane.kicker,
        lane.navLabel,
        lane.summary,
      ]),
      ...LEARN_TOPICS.flatMap((topic) => [
        topic.lede,
        topic.title,
        ...topic.sections.flatMap((section) => [section.heading, section.body]),
      ]),
      ...CLINICAL_RESOURCES.flatMap((resource) => [
        resource.boundary,
        resource.freshness,
        resource.source,
        resource.summary,
        resource.title,
      ]),
      ...INTELLIGENCE_ENTRIES.flatMap((entry) => [
        entry.summary,
        entry.title,
        ...entry.rows.flatMap((row) => [row.label, row.note]),
      ]),
    ];
    for (const text of copy) {
      expect(text).not.toMatch(PROHIBITED_CLAIMS);
    }
  });
});

function exactName(name: string): RegExp {
  return new RegExp(`^${name.replaceAll(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);
}

function learnTopic(id: string): Extract<ThreeLaneItem, { kind: "learn" }> {
  const topic = threeLaneItem("learn", id);
  if (topic?.kind !== "learn") {
    throw new Error(`Expected learn topic ${id}`);
  }
  return topic;
}

function clinicalResource(
  id: string
): Extract<ThreeLaneItem, { kind: "clinical" }> {
  const resource = threeLaneItem("clinical", id);
  if (resource?.kind !== "clinical") {
    throw new Error(`Expected clinical resource ${id}`);
  }
  return resource;
}

function intelligenceEntry(
  id: string
): Extract<ThreeLaneItem, { kind: "intelligence" }> {
  const entry = threeLaneItem("intelligence", id);
  if (entry?.kind !== "intelligence") {
    throw new Error(`Expected intelligence entry ${id}`);
  }
  return entry;
}
