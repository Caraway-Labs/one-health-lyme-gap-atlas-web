import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const { trackMethodologyOpened } = vi.hoisted(() => ({
  trackMethodologyOpened: vi.fn<(pathname: string, surface: string) => void>(),
}));

vi.mock(import("../src/lib/atlas-analytics"), async (importOriginal) => ({
  ...(await importOriginal()),
  trackMethodologyOpened,
}));

import { DataDictionaryDialog } from "../src/components/data-dictionary-dialog";
import { MethodsSection } from "../src/components/methods-section";
import {
  trackAskAnswered,
  trackAskSubmitted,
} from "../src/lib/atlas-analytics";

describe("methodology analytics wiring", () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("tracks the data dictionary only when it opens", async () => {
    const user = userEvent.setup();
    render(<DataDictionaryDialog />);
    expect(trackMethodologyOpened).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Data dictionary" }));
    expect(trackMethodologyOpened).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      "data_dictionary"
    );
  });

  it("tracks methods education link clicks", async () => {
    const user = userEvent.setup();
    render(
      <MethodsSection
        metadata={
          {
            generated_at: "2026-01-01T00:00:00Z",
            limitations: "None",
            loaded_at: "2026-01-02T00:00:00Z",
            sources: [],
          } as never
        }
      />
    );
    await user.click(
      screen.getByRole("link", {
        name: /What release labels and methodology versions mean/,
      })
    );
    expect(trackMethodologyOpened).toHaveBeenCalledExactlyOnceWith(
      expect.any(String),
      "methods_navigation"
    );
  });

  it("ignores Ask events with values outside the closed lists", () => {
    expect(() => {
      trackAskSubmitted("bogus" as never);
      trackAskAnswered("bogus" as never, "answered");
      trackAskAnswered("ask_atlas", "bogus" as never);
    }).not.toThrow();
  });
});
