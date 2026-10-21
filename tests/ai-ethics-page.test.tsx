import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiEthicsPage } from "../src/app/ai-ethics/page";
import { aiEthicsContent } from "../src/lib/ai-ethics-content";

const RETIRED_COPY = [
  "planned",
  "pending",
  "in development",
  "experimental",
  "release pending",
] as const;

describe("AI Ethics page", () => {
  afterEach(cleanup);

  it("renders the approved heading, three AI uses, and version", () => {
    render(<AiEthicsPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: aiEthicsContent.hero.title,
      })
    ).toBeTruthy();
    for (const pillar of aiEthicsContent.pillars) {
      screen.getByRole("heading", { level: 3, name: pillar.title });
    }
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    screen.getByText(`Version ${aiEthicsContent.version}`);
    const version = screen.getByLabelText("AI Ethics document version");
    expect({
      maintenance: version.textContent,
      tag: version.tagName,
      text: version.textContent,
    }).toStrictEqual({
      maintenance: expect.not.stringMatching(
        /pull-request review|update the version/i
      ),
      tag: "DIV",
      text: `Version ${aiEthicsContent.version} · Last updated October 21, 2026`,
    });
  });

  it("states the Gap Score, clinical, and disease-risk limits and links the public docs", () => {
    render(<AiEthicsPage />);

    screen.getByText(/not a trained machine-learning model/i);
    screen.getByText(/not a clinical service/i);
    screen.getByText(/do not predict disease risk/i);
    screen.getByRole("link", { name: "Return to the Atlas" });
    expect({
      access: screen
        .getByRole("link", { name: "MCP and API access" })
        .getAttribute("href"),
      methods: screen
        .getByRole("link", { name: "data and methods" })
        .getAttribute("href"),
      privacy: screen
        .getByRole("link", { name: "privacy" })
        .getAttribute("href"),
    }).toStrictEqual({
      access: "/docs/api-mcp-and-access",
      methods: "/docs/releases-and-methodology",
      privacy: "/privacy",
    });
  });

  it("does not render maturity labels, open questions, or internal references", () => {
    render(<AiEthicsPage />);

    const text = document.body.textContent ?? "";
    expect({
      badges: document.querySelector("[data-slot='badge']"),
      details: document.querySelector("details"),
      issueReferences: text.match(/#\d+/g),
      openQuestions: screen.queryByRole("heading", {
        name: "Commitments in development",
      }),
      retiredPhrases: RETIRED_COPY.filter((phrase) =>
        text.toLowerCase().includes(phrase)
      ),
      statusHeading: screen.queryByRole("heading", {
        name: "What is true today, planned, and undecided",
      }),
    }).toStrictEqual({
      badges: null,
      details: null,
      issueReferences: null,
      openQuestions: null,
      retiredPhrases: [],
      statusHeading: null,
    });
  });

  it("renders static disclosure content without an API request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<AiEthicsPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
