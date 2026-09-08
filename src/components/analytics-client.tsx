"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  analyticsMayStart,
  honorsDoNotTrack,
  readAnalyticsPreference,
  type AnalyticsConsentState,
} from "@/lib/analytics-consent";
import {
  atlasAnalytics,
  isUiControlId,
  trackRouteView,
  trackUiInteraction,
} from "@/lib/atlas-analytics";

const PREFERENCE_CHANGED_EVENT = "atlas:analytics-preference-changed";

export function AnalyticsClient() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>("not-decided");

  useEffect(() => {
    const refreshPreference = () =>
      setConsent(readAnalyticsPreference(window.localStorage));
    const onPreferenceChanged = () => refreshPreference();
    refreshPreference();
    window.addEventListener(PREFERENCE_CHANGED_EVENT, onPreferenceChanged);
    return () =>
      window.removeEventListener(PREFERENCE_CHANGED_EVENT, onPreferenceChanged);
  }, []);

  useEffect(() => {
    const mayStart = analyticsMayStart({
      consent,
      doNotTrack: honorsDoNotTrack(window.navigator),
    });

    if (!mayStart) {
      atlasAnalytics.stop();
      return;
    }

    let cancelled = false;
    async function startAnalytics() {
      const started = await atlasAnalytics.start(
        process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY
      );
      if (started && !cancelled) trackRouteView(pathname);
    }

    void startAnalytics();

    return () => {
      cancelled = true;
    };
  }, [consent, pathname]);

  useEffect(() => {
    const onInteraction = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const control = target.closest<HTMLElement>(
        "[data-atlas-analytics-control]"
      );
      const controlId = control?.dataset.atlasAnalyticsControl;
      if (isUiControlId(controlId)) trackUiInteraction(pathname, controlId);
    };
    window.addEventListener("click", onInteraction);
    return () => window.removeEventListener("click", onInteraction);
  }, [pathname]);

  return null;
}

export function notifyAnalyticsPreferenceChanged(): void {
  window.dispatchEvent(new Event(PREFERENCE_CHANGED_EVENT));
}
