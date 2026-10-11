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
 * Startup runs once per unresolved history entry. Once it settles, that entry
 * has an explicit scope that reproduces the screen, including a national
 * fallback. A county already in the history entry is an explicit location, so
 * the saved starting view does not replace it. A later restore that drops the
 * written scope from a scope-less entry is written again.
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
  const historyKeyRef = useRef<string | null>(null);
  const settledRef = useRef(false);
  const [startupSettled, setStartupSettled] = useState(false);

  useEffect(() => {
    if (!profileReady || stateOptions.length === 0) {
      return;
    }
    // A history entry that omits scope is unresolved even when the Next
    // snapshot still shows a scope from an earlier shallow update.
    const historyParams = new URLSearchParams(window.location.search);
    const historyHasScope = hasExplicitReviewScopeParam(historyParams);
    const historyHasCounty = historyParams.has("county");
    const historySearch = historyParams.toString();
    if (historyKeyRef.current !== historySearch) {
      historyKeyRef.current = historySearch;
      if (!historyHasScope && !historyHasCounty) {
        resolvedScopeRef.current = null;
        settledRef.current = false;
      }
    }
    const unresolvedEntry = !historyHasScope && !historyHasCounty;
    if (
      settledRef.current &&
      resolvedScopeRef.current !== null &&
      activeScope !== resolvedScopeRef.current &&
      unresolvedEntry
    ) {
      // The parser can return to the national default after Back, after
      // startup already matched the saved state. Write that state again.
      settledRef.current = false;
    }
    if (settledRef.current) {
      return;
    }
    if (resolvedScopeRef.current === null) {
      const explicitScope =
        hasExplicitReviewScopeParam(searchParams) && historyHasScope;
      const parsedScope =
        historyHasCounty && !historyHasScope
          ? parsedReviewScopeFromUrl(historyParams)
          : parsedReviewScopeFromUrl(searchParams);
      resolvedScopeRef.current = resolveStartingReviewScope(
        explicitScope || historyHasCounty,
        parsedScope,
        profileStateCode,
        stateOptions
      );
    }
    const starting = resolvedScopeRef.current;
    // Record the resolution even when the parsed scope is already that value.
    // A scope-less URL would otherwise stay national while a reload applies
    // a later saved state.
    setScope(starting);
    if (starting !== activeScope) {
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
