"use client";

import { useEffect } from "react";

import { legacyAnalyticalFragmentHref } from "@/lib/analytical-navigation-handoff";

export function LegacyRootFragmentRedirect() {
  useEffect(() => {
    const redirectLegacyFragment = () => {
      if (window.location.pathname !== "/") return;
      const destination = legacyAnalyticalFragmentHref(
        window.location.hash,
        window.location.search
      );
      if (!destination) return;
      window.location.replace(destination);
    };

    redirectLegacyFragment();
    window.addEventListener("hashchange", redirectLegacyFragment);
    return () =>
      window.removeEventListener("hashchange", redirectLegacyFragment);
  }, []);

  return null;
}
