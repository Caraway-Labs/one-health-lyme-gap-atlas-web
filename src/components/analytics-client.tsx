"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { readAmplitudeApiKey } from "@/lib/amplitude-deployment";
import {
  ANALYTICS_PREFERENCE_KEY,
  analyticsMayStart,
  honorsDoNotTrack,
  readBrowserAnalyticsPreference,
  type AnalyticsConsentState,
} from "@/lib/analytics-consent";
import {
  atlasAnalytics,
  isUiControlId,
  trackRouteView,
  trackUiInteraction,
} from "@/lib/atlas-analytics";

export const ANALYTICS_PREFERENCE_CHANGED_EVENT =
  "atlas:analytics-preference-changed";

function enforceStoredAnalyticsPreference(): void {
  const mayStart = analyticsMayStart({
    consent: readBrowserAnalyticsPreference(),
    doNotTrack: honorsDoNotTrack(window.navigator),
  });
  if (!mayStart) {
    atlasAnalytics.stop();
  }
}

function isAnalyticsPreferenceStorageEvent(event: StorageEvent): boolean {
  return event.key === null || event.key === ANALYTICS_PREFERENCE_KEY;
}

function onCrossTabAnalyticsPreference(event: StorageEvent): void {
  if (!isAnalyticsPreferenceStorageEvent(event)) {
    return;
  }
  // Another tab changed or cleared the preference. Stop before any later
  // track, including after this tab has entered the professional shell.
  notifyAnalyticsPreferenceChanged();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onCrossTabAnalyticsPreference);
}

export function AnalyticsClient() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>("not-decided");

  useEffect(() => {
    const refreshPreference = () => {
      enforceStoredAnalyticsPreference();
      setConsent(readBrowserAnalyticsPreference());
    };
    const onStorage = (event: StorageEvent) => {
      if (!isAnalyticsPreferenceStorageEvent(event)) {
        return;
      }
      refreshPreference();
    };
    refreshPreference();
    window.addEventListener(
      ANALYTICS_PREFERENCE_CHANGED_EVENT,
      refreshPreference
    );
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(
        ANALYTICS_PREFERENCE_CHANGED_EVENT,
        refreshPreference
      );
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    // The first render still has the "not-decided" placeholder. Read storage
    // in this effect so a stored grant does not stop the SDK and clear vendor
    // storage before the preference state catches up.
    const storedConsent =
      consent === "not-decided" ? readBrowserAnalyticsPreference() : consent;
    const mayStart = analyticsMayStart({
      consent: storedConsent,
      doNotTrack: honorsDoNotTrack(window.navigator),
    });

    if (!mayStart) {
      atlasAnalytics.stop();
      return;
    }

    let cancelled = false;
    async function startAnalytics() {
      const started = await atlasAnalytics.start(readAmplitudeApiKey());
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
  // Stop here, not only in AnalyticsClient. Docs, the design system, and auth
  // utilities do not mount that listener, and a grant keeps the module-global
  // SDK alive after the listener unmounts. Cross-tab storage events call this
  // same path.
  enforceStoredAnalyticsPreference();
  window.dispatchEvent(new Event(ANALYTICS_PREFERENCE_CHANGED_EVENT));
}
