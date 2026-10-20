import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StartingViewContinuation } from "@/features/ux-reset/onboarding/starting-view-continuation";
import { StartingViewGate } from "@/features/ux-reset/onboarding/starting-view-gate";
import {
  WORKSPACE_CONNECTING_COPY,
  WORKSPACE_CONNECTING_DELAY_MS,
  WORKSPACE_CONNECTING_DOT,
  WORKSPACE_CONNECTING_HEADLINE_COLOR,
  WORKSPACE_CONNECTING_SUPPORT_COLOR,
  WorkspaceConnectingScreen,
  WorkspaceReadinessRecovery,
} from "@/features/ux-reset/workspace-connecting-screen";
import { MAP_VIEWPORT_LOADING_BOUNDARY } from "@/features/ux-reset/workspace-loading-boundary";

const { profile, replace } = vi.hoisted(() => ({
  profile: {
    current: {
      data: undefined as { startingViewVersion: 1 | null } | undefined,
      identity: { kind: "user", userId: "user-a" } as {
        kind: string;
        userId?: string;
      } | null,
      isError: false,
      refetch: vi.fn<() => Promise<unknown>>(),
      sessionRejected: false,
    },
  },
  replace: vi.fn<(path: string) => void>(),
}));

vi.mock(
  import("next/font/local"),
  () =>
    ({
      default: () => ({ variable: "--font-front-porch-hero" }),
    }) as never
);

vi.mock(
  import("next/navigation"),
  () =>
    ({
      usePathname: () => "/explore",
      useRouter: () => ({ replace }),
      useSearchParams: () => new URLSearchParams(),
    }) as never
);

vi.mock(
  import("@/features/ux-reset/profile/use-saved-profile"),
  () =>
    ({
      useSavedProfile: () => profile.current,
    }) as never
);

const NAVY = [8, 42, 77] as const;

function channel(value: number): number {
  const unit = value / 255;
  return unit <= 0.04045 ? unit / 12.92 : ((unit + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: readonly [number, number, number]): number {
  return (
    0.2126 * channel(rgb[0]) +
    0.7152 * channel(rgb[1]) +
    0.0722 * channel(rgb[2])
  );
}

function contrast(
  foreground: readonly [number, number, number],
  background: readonly [number, number, number]
): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

function composite(
  color: readonly [number, number, number],
  alpha: number,
  background: readonly [number, number, number]
): [number, number, number] {
  return [
    color[0] * alpha + background[0] * (1 - alpha),
    color[1] * alpha + background[1] * (1 - alpha),
    color[2] * alpha + background[2] * (1 - alpha),
  ];
}

function resetProfile(): void {
  profile.current = {
    data: undefined,
    identity: { kind: "user", userId: "user-a" },
    isError: false,
    refetch: vi.fn<() => Promise<unknown>>(),
    sessionRejected: false,
  };
  replace.mockReset();
}

describe("workspace connecting screen", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("waits out the display delay and then announces once", () => {
    vi.useFakeTimers();
    render(<WorkspaceConnectingScreen />);
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(WORKSPACE_CONNECTING_DELAY_MS - 1);
    });
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect({
      buttons: screen.queryByRole("button"),
      hidden: document
        .querySelector(".workspace-connecting-mark")
        ?.getAttribute("aria-hidden"),
      statuses: screen.getAllByRole("status").length,
      text: screen.getByRole("status").textContent,
    }).toStrictEqual({
      buttons: null,
      hidden: "true",
      statuses: 1,
      text: `${WORKSPACE_CONNECTING_COPY.headline}${WORKSPACE_CONNECTING_COPY.support}`,
    });
  });

  it("cancels a fast load before the screen can paint", () => {
    vi.useFakeTimers();
    const view = render(<WorkspaceConnectingScreen />);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    view.rerender(<WorkspaceConnectingScreen active={false} />);
    act(() => {
      vi.advanceTimersByTime(WORKSPACE_CONNECTING_DELAY_MS);
    });
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("removes the screen immediately when readiness arrives", () => {
    vi.useFakeTimers();
    const view = render(<WorkspaceConnectingScreen />);
    act(() => {
      vi.advanceTimersByTime(WORKSPACE_CONNECTING_DELAY_MS);
    });
    expect(screen.getByRole("status")).toBeTruthy();
    view.rerender(<WorkspaceConnectingScreen active={false} />);
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("keeps approved colors, static reduced motion, and readable contrast", () => {
    render(<WorkspaceConnectingScreen delayMs={0} motion="reduced" />);
    const title = screen.getByRole("heading", {
      name: WORKSPACE_CONNECTING_COPY.headline,
    });
    const support = screen.getByText(WORKSPACE_CONNECTING_COPY.support);
    const dots = [
      ...document.querySelectorAll(".workspace-connecting-mark span"),
    ];
    expect({
      boundary: MAP_VIEWPORT_LOADING_BOUNDARY,
      contrastHeadline: contrast([255, 255, 255], NAVY) >= 4.5,
      contrastSupport:
        contrast(composite([255, 255, 255], 0.85, NAVY), NAVY) >= 4.5,
      dots: dots.map((dot) => (dot as HTMLElement).style.backgroundColor),
      motion: screen.getByTestId("workspace-connecting").dataset.motion,
      support: support.style.color,
      title: title.style.color,
    }).toStrictEqual({
      boundary: "map-viewport",
      contrastHeadline: true,
      contrastSupport: true,
      dots: [
        WORKSPACE_CONNECTING_DOT,
        WORKSPACE_CONNECTING_DOT,
        WORKSPACE_CONNECTING_DOT,
      ],
      motion: "reduced",
      support: WORKSPACE_CONNECTING_SUPPORT_COLOR,
      title: WORKSPACE_CONNECTING_HEADLINE_COLOR,
    });
  });

  it("replaces the animation with retry or sign-in", () => {
    const onRetry = vi.fn<() => void>();
    const view = render(
      <WorkspaceReadinessRecovery kind="error" onRetry={onRetry} />
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("workspace-connecting")).toBeNull();
    view.rerender(
      <WorkspaceReadinessRecovery
        kind="session-rejected"
        signInHref="/auth/sign-in?next=%2Fexplore"
      />
    );
    expect({
      href: screen.getByRole("link", { name: "Sign in" }).getAttribute("href"),
      text: screen.getByRole("alert").textContent,
    }).toStrictEqual({
      href: "/auth/sign-in?next=%2Fexplore",
      text: WORKSPACE_CONNECTING_COPY.unsigned,
    });
  });
});

describe("workspace readiness lifecycle", () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    resetProfile();
  });

  it("shows the shell immediately when the profile is already complete", () => {
    profile.current.data = { startingViewVersion: 1 };
    render(
      <StartingViewGate>
        <p>Shell ready</p>
      </StartingViewGate>
    );
    expect(screen.getByText("Shell ready")).toBeTruthy();
    expect(screen.queryByTestId("workspace-connecting")).toBeNull();
  });

  it("holds only the connecting screen while the profile read is pending", () => {
    vi.useFakeTimers();
    render(
      <StartingViewGate>
        <p>Shell ready</p>
      </StartingViewGate>
    );
    expect(screen.queryByText("Shell ready")).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
    act(() => {
      vi.advanceTimersByTime(WORKSPACE_CONNECTING_DELAY_MS);
    });
    expect(screen.getByRole("status").textContent).toContain(
      WORKSPACE_CONNECTING_COPY.headline
    );
    expect(screen.queryByText("Shell ready")).toBeNull();
  });

  it("uses sign-in or retry instead of an endless connecting screen", () => {
    profile.current.sessionRejected = true;
    const view = render(
      <StartingViewGate>
        <p>Shell ready</p>
      </StartingViewGate>
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toBeTruthy();
    expect(screen.queryByTestId("workspace-connecting")).toBeNull();

    profile.current.sessionRejected = false;
    profile.current.isError = true;
    view.rerender(
      <StartingViewGate>
        <p>Shell ready</p>
      </StartingViewGate>
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(profile.current.refetch).toHaveBeenCalledOnce();
    expect(screen.queryByTestId("workspace-connecting")).toBeNull();
  });

  it("uses the same screen after sign-in and the entrance for a failed return", () => {
    vi.useFakeTimers();
    const view = render(<StartingViewContinuation requested="/explore" />);
    act(() => {
      vi.advanceTimersByTime(WORKSPACE_CONNECTING_DELAY_MS);
    });
    expect(screen.getByTestId("workspace-connecting")).toBeTruthy();

    profile.current.isError = true;
    view.rerender(<StartingViewContinuation requested="/explore" />);
    expect(screen.queryByTestId("workspace-connecting")).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain(
      WORKSPACE_CONNECTING_COPY.unavailable
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });
});
