"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import "./workspace-connecting-screen.css";

export const WORKSPACE_CONNECTING_DELAY_MS = 450;

export const WORKSPACE_CONNECTING_COPY = {
  headline: "Connecting the data.",
  support: "Preparing your Atlas workspace…",
  retry: "Try again",
  signIn: "Sign in",
  unavailable:
    "We couldn’t load your starting view. Nothing was changed. Try again.",
  unsigned:
    "Your session expired. Sign in again before continuing. Nothing was changed.",
} as const;

export const WORKSPACE_CONNECTING_DOT = "rgb(121, 212, 201)";
export const WORKSPACE_CONNECTING_HEADLINE_COLOR = "rgb(255, 255, 255)";
export const WORKSPACE_CONNECTING_SUPPORT_COLOR = "rgba(255, 255, 255, 0.85)";

type WorkspaceConnectingMotion = "reduced" | "system";

/**
 * Full-viewport session/workspace transition. It paints only after the
 * display delay and unmounts as soon as `active` is false. It does not
 * wait for map data or for the dot animation to finish.
 */
export function WorkspaceConnectingScreen({
  active = true,
  delayMs = WORKSPACE_CONNECTING_DELAY_MS,
  motion = "system",
}: {
  active?: boolean;
  delayMs?: number;
  motion?: WorkspaceConnectingMotion;
}) {
  const visible = useDelayedWorkspaceConnecting(active, delayMs);
  if (!visible) {
    return null;
  }

  return (
    <main
      className="workspace-connecting"
      data-motion={motion}
      data-testid="workspace-connecting"
    >
      <div className="workspace-connecting-group">
        <div aria-hidden="true" className="workspace-connecting-mark">
          <span style={{ backgroundColor: WORKSPACE_CONNECTING_DOT }} />
          <span style={{ backgroundColor: WORKSPACE_CONNECTING_DOT }} />
          <span style={{ backgroundColor: WORKSPACE_CONNECTING_DOT }} />
        </div>
        <div role="status">
          <h1
            className="type-card workspace-connecting-title"
            style={{ color: WORKSPACE_CONNECTING_HEADLINE_COLOR }}
          >
            {WORKSPACE_CONNECTING_COPY.headline}
          </h1>
          <p
            className="type-body workspace-connecting-support"
            style={{ color: WORKSPACE_CONNECTING_SUPPORT_COLOR }}
          >
            {WORKSPACE_CONNECTING_COPY.support}
          </p>
        </div>
      </div>
    </main>
  );
}

export function WorkspaceReadinessRecovery({
  kind,
  onRetry,
  signInHref,
}: {
  kind: "error" | "session-rejected";
  onRetry?: () => void;
  signInHref?: string;
}) {
  if (kind === "session-rejected") {
    return (
      <main className="app-content ux-reset-pro-main">
        <p role="alert">{WORKSPACE_CONNECTING_COPY.unsigned}</p>
        <Link href={signInHref ?? "/auth/sign-in"}>
          {WORKSPACE_CONNECTING_COPY.signIn}
        </Link>
      </main>
    );
  }

  return (
    <main className="app-content ux-reset-pro-main">
      <p role="alert">{WORKSPACE_CONNECTING_COPY.unavailable}</p>
      <Button
        onClick={() => {
          onRetry?.();
        }}
        type="button"
      >
        {WORKSPACE_CONNECTING_COPY.retry}
      </Button>
    </main>
  );
}

function useDelayedWorkspaceConnecting(
  active: boolean,
  delayMs: number
): boolean {
  const [schedule, setSchedule] = useState({ active, delayMs });
  const [visible, setVisible] = useState(active && delayMs === 0);
  if (schedule.active !== active || schedule.delayMs !== delayMs) {
    setSchedule({ active, delayMs });
    setVisible(active && delayMs === 0);
  }

  useEffect(() => {
    if (!active || delayMs === 0) {
      return;
    }
    const timeout = window.setTimeout(() => {
      setVisible(true);
    }, delayMs);
    return () => {
      window.clearTimeout(timeout);
    };
  }, [active, delayMs]);

  return visible;
}
