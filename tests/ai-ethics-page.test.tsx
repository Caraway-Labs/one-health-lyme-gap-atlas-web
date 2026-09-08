import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/components/site-footer", () => ({
  SiteFooter: () => <footer />,
}));

import { AiEthicsPage } from "../src/app/ai-ethics/page";
import { aiEthicsContent } from "../src/lib/ai-ethics-content";

describe("AI Ethics page", () => {
  afterEach(cleanup);

  it("renders the public content with distinct status and open-question sections", () => {
    render(<AiEthicsPage />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: aiEthicsContent.introduction.title,
      })
    ).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: "What is true today, planned, and undecided",
      })
    ).toBeTruthy();
    expect(screen.getByText("What Atlas does today")).toBeTruthy();
    expect(
      screen.getByText("Approved direction; release pending")
    ).toBeTruthy();
    expect(screen.getByText("Commitment in development")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Commitments in development" })
    ).toBeTruthy();
    expect(screen.getAllByRole("term")).toHaveLength(
      aiEthicsContent.openCommitments.length
    );
  });

  it("exposes public-health boundaries and versioned document metadata", () => {
    render(<AiEthicsPage />);

    expect(
      screen.getByRole("heading", { name: "What Atlas AI is not for" })
    ).toBeTruthy();
    expect(
      screen.getByText(/does not provide diagnosis or treatment advice/i)
    ).toBeTruthy();
    expect(screen.getByText(`Version ${aiEthicsContent.version}`)).toBeTruthy();
    expect(
      screen.getByLabelText("AI Ethics document version").textContent
    ).toContain("Last updated September 7, 2026");
  });

  it("renders static disclosure content without an API request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    render(<AiEthicsPage />);

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
