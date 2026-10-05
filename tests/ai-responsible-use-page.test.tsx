import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AiResponsibleUsePage } from "../src/features/ux-reset/ai-responsible-use/ai-responsible-use-page";
import {
  capabilityClaims,
  documentationLinks,
  maturityDefinitions,
  maturityLabel,
} from "../src/features/ux-reset/ai-responsible-use/content";

describe("AI / Responsible Use page", () => {
  afterEach(cleanup);

  it("shows a maturity label on every capability claim", () => {
    render(<AiResponsibleUsePage />);

    expect(
      screen.getByRole("heading", { level: 1, name: "AI / Responsible Use" })
    ).toBeTruthy();

    for (const definition of maturityDefinitions) {
      expect(
        screen.getAllByText(maturityLabel(definition.maturity)).length
      ).toBeGreaterThan(0);
    }

    for (const claim of capabilityClaims) {
      expect(
        screen.getByRole("heading", { level: 3, name: claim.title })
      ).toBeTruthy();
    }
  });

  it("states the no-diagnosis boundary without an evidence-status label", () => {
    render(<AiResponsibleUsePage />);
    const maturities = [
      ...document.querySelectorAll<HTMLElement>("[data-maturity]"),
    ].map((element) => element.dataset.maturity);
    expect(maturities).toContain("current");
    expect(screen.getByText(/does not diagnose Lyme disease/i)).toBeTruthy();
    expect(screen.queryByText("Available now")).toBeNull();
  });

  it("exposes keyboard-focusable documentation links", () => {
    render(<AiResponsibleUsePage />);

    const nav = screen.getByRole("navigation", {
      name: "Deeper documentation",
    });
    const docs = within(nav);
    expect(
      documentationLinks.map((link) => {
        const anchor = docs.getByRole("link", {
          name: link.opensNewTab
            ? `${link.label} (opens in a new tab)`
            : link.label,
        });
        return {
          href: anchor.getAttribute("href"),
          inNav: nav.contains(anchor),
          rel: anchor.getAttribute("rel"),
          target: anchor.getAttribute("target"),
        };
      })
    ).toStrictEqual(
      documentationLinks.map((link) => ({
        href: link.href,
        inNav: true,
        rel: link.opensNewTab ? "noopener noreferrer" : null,
        target: link.opensNewTab ? "_blank" : null,
      }))
    );
  });

  it("renders static disclosure content without an API request", () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    render(<AiResponsibleUsePage />);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
