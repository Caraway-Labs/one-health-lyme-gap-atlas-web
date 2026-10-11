"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  hasExplicitReviewScopeParam,
  parsedReviewScopeFromUrl,
  resolveStartingReviewScope,
  type ReviewScope,
} from "@/features/ux-reset/review/resolve-review-scope";
import type { AtlasStateOption } from "@/lib/atlas-state-geography";

type ApplyProfileStartingScopeArgs = {
  activeScope: "ALL" | string;
  profileStateCode: string | null | undefined;
  profileReady: boolean;
  setScope: (scope: "ALL" | string) => void;
  stateOptions: readonly AtlasStateOption[];
};

/**
 * Applies profile default jurisdiction once when the Review URL omits `scope`.
 * Returns whether that one-time resolution has settled. Later profile
 * refetches must not start a second resolution or reopen startup.
 */
export function useApplyProfileStartingScope({
  activeScope,
  profileReady,
  profileStateCode,
  setScope,
  stateOptions,
}: ApplyProfileStartingScopeArgs): boolean {
  const searchParams = useSearchParams();
  const resolvedScopeRef = useRef<ReviewScope | null>(null);
  const settledRef = useRef(false);
  const [startupSettled, setStartupSettled] = useState(false);

  useEffect(() => {
    if (!profileReady || settledRef.current || stateOptions.length === 0) {
      return;
    }
    if (resolvedScopeRef.current === null) {
      // A history entry that omits scope is unresolved even when the Next
      // snapshot still shows a scope from an earlier shallow update.
      const historyHasScope = hasExplicitReviewScopeParam(
        new URLSearchParams(window.location.search)
      );
      const explicit =
        hasExplicitReviewScopeParam(searchParams) && historyHasScope;
      resolvedScopeRef.current = resolveStartingReviewScope(
        explicit,
        parsedReviewScopeFromUrl(searchParams),
        profileStateCode,
        stateOptions
      );
    }
    const starting = resolvedScopeRef.current;
    if (starting !== activeScope) {
      setScope(starting);
      return;
    }
    settledRef.current = true;
    setStartupSettled(true);
  }, [
    activeScope,
    profileReady,
    profileStateCode,
    searchParams,
    setScope,
    stateOptions,
  ]);

  return startupSettled;
}
