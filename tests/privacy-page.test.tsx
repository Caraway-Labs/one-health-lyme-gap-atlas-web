import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import PrivacyPage from "@/app/privacy/page";
import { ATLAS_ROUTES, getRouteShell } from "@/lib/navigation";

const ANALYTICAL_SHELL_HREFS = [
  "/overview",
  "/geographic_explorer",
  "/investigate",
  "/assistant",
  "/knowledge-graph",
  "/account",
  "/auth/sign-in",
] as const;

const POLICY_HEADINGS = [
  "Privacy without the fine print.",
  "Use less data. Explain it clearly.",
  "Public exploration stays public",
  "No ads or data sales",
  "Purpose before collection",
  "What we collect and why",
  "Questions you ask Atlas",
  "Your analytics choices",
  "What never goes into analytics",
  "Service providers we use",
  "How long we keep information",
  "Your rights and controls",
  "How we protect information",
  "Children",
  "Visitors outside the United States",
  "Changes to this policy",
  "Questions and requests",
] as const;

const RETIRED_COPY = [
  "data-use summary",
  "allowlisted",
  "analytical shell",
  "reviewed-literature chat is enabled",
  "This page does not state",
] as const;

describe("public privacy page", () => {
  afterEach(cleanup);

  it("keeps public exploration and the privacy page outside the professional workspace", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByRole("heading", { name: "Privacy without the fine print." })
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Sign-in is required only for the professional workspace, and this policy is always public/
      )
    ).toBeTruthy();
    expect(
      screen
        .getByRole("link", { name: "Return to the Atlas" })
        .getAttribute("href")
    ).toBe("/overview#atlas");
    expect(getRouteShell("/privacy")).toBe("public");
  });

  it("renders the approved policy headings", () => {
    render(<PrivacyPage />);

    expect(
      POLICY_HEADINGS.map(
        (name) => screen.getByRole("heading", { name }).tagName
      )
    ).toStrictEqual([
      "H1",
      "H2",
      "H3",
      "H3",
      "H3",
      "H2",
      "H2",
      "H2",
      "H3",
      "H2",
      "H2",
      "H2",
      "H2",
      "H2",
      "H2",
      "H2",
      "H2",
    ]);
  });

  it("states the 30-day conversation retention and the analytics boundaries", () => {
    render(<PrivacyPage />);

    expect(
      screen.getByText(
        /The Atlas service stores questions and answers for 30 days after a conversation's most recent message/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Analytics run on public Atlas pages, Account, and sign-in. They never run in the signed-in professional workspace/
      )
    ).toBeTruthy();
    expect(
      screen.getByText(
        /If your browser sends a Do Not Track signal, Atlas keeps optional analytics off/
      )
    ).toBeTruthy();
    expect(
      screen.getAllByText(/from Account or professional Settings/).length
    ).toBeGreaterThan(0);
  });

  it("keeps analytics off the professional workspace route set", () => {
    render(<PrivacyPage />);

    expect(
      ATLAS_ROUTES.filter((route) => route.shell === "analytical")
        .map((route) => route.href)
        .sort()
    ).toStrictEqual([...ANALYTICAL_SHELL_HREFS].sort());
    expect(getRouteShell("/account")).toBe("analytical");
    expect(getRouteShell("/auth/sign-in")).toBe("analytical");
    expect(getRouteShell("/app")).toBe("none");
    expect(screen.queryByText(/analytical shell/)).toBeNull();
  });

  it("links the policy questions to Feedback, AI Ethics, and Caraway Labs", () => {
    render(<PrivacyPage />);

    expect(
      screen
        .getByRole("link", { name: "AI and machine learning" })
        .getAttribute("href")
    ).toBe("/ai-ethics");
    expect(
      screen
        .getByRole("link", { name: "about Caraway Labs" })
        .getAttribute("href")
    ).toBe("/about/caraway-labs");
    expect(
      [...document.querySelectorAll("main strong")].map(
        (element) => element.textContent
      )
    ).toStrictEqual([
      "Privacy settings",
      "Export my data",
      "Remove all data",
      "Feedback",
      "Feedback",
      "Feedback",
      "Version 1.0.0",
    ]);
    expect(
      document
        .querySelector("[aria-label='Privacy policy version']")
        ?.textContent?.replaceAll(/\s+/g, " ")
        .trim()
    ).toBe("Version 1.0.0 · Last updated October 21, 2026");
  });

  it("does not publish the retired privacy summary", () => {
    render(<PrivacyPage />);

    const text = document.querySelector("main")?.textContent ?? "";
    expect(
      RETIRED_COPY.filter((phrase) => text.includes(phrase))
    ).toStrictEqual([]);
    expect(screen.queryByText(/Saved workspaces are not launched/)).toBeNull();
    expect(text.match(/\bSDK\b/)).toBeNull();
  });
});
