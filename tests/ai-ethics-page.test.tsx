import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock(import("../src/components/site-footer"), () => ({
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
    screen.getByRole("heading", {
      name: "What is true today, planned, and undecided",
    });
    screen.getByText("What Atlas does today");
    screen.getByText("Approved direction; release pending");
    screen.getByText("Commitment in development");
    screen.getByRole("heading", { name: "Commitments in development" });
    expect(screen.getAllByRole("term")).toHaveLength(
      aiEthicsContent.openCommitments.length
    );
  });

  it("exposes public-health boundaries and versioned document metadata", () => {
    render(<AiEthicsPage />);

    screen.getByRole("heading", { name: "What Atlas AI is not for" });
    screen.getByRole("link", { name: "Return to the Atlas" });
    screen.getByText(/does not provide diagnosis or treatment advice/i);
    screen.getByText(`Version ${aiEthicsContent.version}`);
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
