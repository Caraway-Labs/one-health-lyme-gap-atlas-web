import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

import {
  EXPLORER_MAP_LOADING_DELAY_MS,
  EXPLORER_MAP_LOADING_ERROR_BODY,
  EXPLORER_MAP_LOADING_ERROR_TITLE,
  EXPLORER_MAP_LOADING_HEADLINE,
  EXPLORER_MAP_LOADING_SUPPORT,
} from "@/features/ux-reset/review/explorer-map-loading";
import { ExplorerMapLoadingOverlay } from "@/features/ux-reset/review/explorer-map-loading-overlay";
import { useExplorerMapLoadingPresentation } from "@/features/ux-reset/review/use-explorer-map-loading";

function Harness({
  mode,
  requestKey,
}: {
  mode: "error" | "idle" | "pending";
  requestKey: string;
}) {
  const view = useExplorerMapLoadingPresentation({ mode, requestKey });
  return (
    <div aria-busy={view.busy} data-block={view.blockMap}>
      <button type="button">Layer</button>
      <ExplorerMapLoadingOverlay view={view.overlay} onRetry={() => {}} />
    </div>
  );
}

describe("explorer map loading overlay", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("announces the approved copy once and hides the decorative icon", () => {
    render(<ExplorerMapLoadingOverlay view="loading" onRetry={() => {}} />);
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent(EXPLORER_MAP_LOADING_HEADLINE);
    expect(status).toHaveTextContent(EXPLORER_MAP_LOADING_SUPPORT);
    expect(
      status.querySelector(".explorer-map-loading-icon-slot")
    ).toHaveAttribute("aria-hidden", "true");
    expect(status.querySelector(".explorer-map-loading-dots")).toHaveAttribute(
      "aria-hidden",
      "true"
    );
    expect(screen.getAllByRole("status")).toHaveLength(1);
  });

  it("stops decorative motion for the reduced-motion preview", () => {
    render(
      <ExplorerMapLoadingOverlay
        motion="reduced"
        view="loading"
        onRetry={() => {}}
      />
    );
    expect(screen.getByTestId("explorer-map-loading")).toHaveAttribute(
      "data-motion",
      "reduced"
    );
  });

  it("offers retry for the current failure", () => {
    const onRetry = vi.fn<() => void>();
    render(<ExplorerMapLoadingOverlay view="error" onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      EXPLORER_MAP_LOADING_ERROR_TITLE
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      EXPLORER_MAP_LOADING_ERROR_BODY
    );
    screen.getByRole("button", { name: "Retry" }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("waits 450 ms before showing and drops a stale selection's timer", () => {
    vi.useFakeTimers();
    const view = render(<Harness mode="pending" requestKey="A" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(view.container.firstElementChild).toHaveAttribute(
      "aria-busy",
      "true"
    );
    act(() => {
      vi.advanceTimersByTime(EXPLORER_MAP_LOADING_DELAY_MS - 1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    view.rerender(<Harness mode="pending" requestKey="C" />);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(EXPLORER_MAP_LOADING_DELAY_MS);
    });
    expect(screen.getByRole("status")).toHaveTextContent(
      EXPLORER_MAP_LOADING_HEADLINE
    );
  });

  it("clears the busy state as soon as the current load is ready", () => {
    vi.useFakeTimers();
    const view = render(<Harness mode="pending" requestKey="C" />);
    act(() => {
      vi.advanceTimersByTime(EXPLORER_MAP_LOADING_DELAY_MS);
    });
    view.rerender(<Harness mode="idle" requestKey="C" />);
    expect(screen.queryByRole("status")).toBeNull();
    expect(view.container.firstElementChild).toHaveAttribute(
      "aria-busy",
      "false"
    );
  });
});
