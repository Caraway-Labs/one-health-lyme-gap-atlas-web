"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  hasExplicitReviewScopeParam,
  parsedReviewScopeFromUrl,
  resolveStartingReviewScope,
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
 */
export function useApplyProfileStartingScope({
  activeScope,
  profileReady,
  profileStateCode,
  setScope,
  stateOptions,
}: ApplyProfileStartingScopeArgs) {
  const searchParams = useSearchParams();
  const appliedRef = useRef(false);

  useEffect(() => {
    if (!profileReady || appliedRef.current || stateOptions.length === 0) {
      return;
    }
    const explicit = hasExplicitReviewScopeParam(searchParams);
    const parsed = parsedReviewScopeFromUrl(searchParams);
    const starting = resolveStartingReviewScope(
      explicit,
      parsed,
      profileStateCode,
      stateOptions
    );
    appliedRef.current = true;
    if (starting !== activeScope) {
      setScope(starting);
    }
  }, [
    activeScope,
    profileReady,
    profileStateCode,
    searchParams,
    setScope,
    stateOptions,
  ]);
}
