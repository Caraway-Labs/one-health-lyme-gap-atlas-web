import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AssistantDemoComposer } from "@/features/assistant/assistant-demo-composer";

const runtime = vi.hoisted(() => ({ loading: true }));
vi.mock(
  import("@assistant-ui/react"),
  () =>
    ({
      useAuiState: (
        selector: (state: { thread: { isLoading: boolean } }) => boolean
      ) => selector({ thread: { isLoading: runtime.loading } }),
      ComposerPrimitive: {
        Root: ({ children }: { children: ReactNode }) => (
          <form>{children}</form>
        ),
        Input: ({ id }: { id: string }) => <textarea id={id} />,
        Send: ({ render }: { render: ReactNode }) => render,
        Cancel: ({ render }: { render: ReactNode }) => render,
      },
    }) as unknown as typeof import("@assistant-ui/react")
);

describe("assistant demo thread readiness", () => {
  afterEach(() => {
    cleanup();
    runtime.loading = true;
  });

  it("does not expose editable input against a placeholder thread and opens it once ready", () => {
    const view = render(<AssistantDemoComposer />);
    expect(screen.getByRole("status").textContent).toContain("Preparing");
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Send demo question" })
    ).toBeNull();
    runtime.loading = false;
    view.rerender(<AssistantDemoComposer />);
    expect(
      screen.getByRole("textbox", { name: "Ask the Atlas demo" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Send demo question" })
    ).toBeTruthy();
  });
});
