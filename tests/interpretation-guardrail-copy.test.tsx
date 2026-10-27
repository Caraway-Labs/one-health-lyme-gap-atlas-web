import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InterpretationGuardrailCopy } from "@/features/docs/interpretation-guardrail-copy";
import { ATLAS_INTERPRETATION_GUARDRAILS } from "@/features/docs/interpretation-guardrails";

describe("interpretation guardrail callout", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("renders the copyable guardrails inside one Interpret with care warning", () => {
    render(<InterpretationGuardrailCopy />);

    expect(screen.getByText("Interpret with care")).toBeVisible();
    expect(screen.getByText(/Missing is not zero/u)).toBeVisible();
    expect(document.body.textContent).toContain(
      ATLAS_INTERPRETATION_GUARDRAILS
    );
    expect(
      screen.getByRole("button", { name: "Copy interpretation guardrails" })
    ).toBeVisible();
  });

  it("copies the guardrail text without dropping a limit", async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>(() =>
      Promise.resolve()
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(<InterpretationGuardrailCopy />);
    fireEvent.click(
      screen.getByRole("button", { name: "Copy interpretation guardrails" })
    );

    await expect(
      screen.findByRole("button", {
        name: "Copied interpretation guardrails",
      })
    ).resolves.toBeVisible();
    expect(writeText).toHaveBeenCalledWith(ATLAS_INTERPRETATION_GUARDRAILS);
    expect(ATLAS_INTERPRETATION_GUARDRAILS).toContain("Missing is not zero.");
    expect(ATLAS_INTERPRETATION_GUARDRAILS).toContain(
      "A gap or a review priority is not risk or a diagnosis."
    );
    expect(ATLAS_INTERPRETATION_GUARDRAILS).toContain(
      "Do not invent a release id when it is null."
    );
  });
});
