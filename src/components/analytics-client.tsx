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
  type AnalyticsPreference,
} from "@/lib/analytics-consent";
import {
  atlasAnalytics,
  isUiControlId,
  trackRouteView,
  trackUiInteraction,
} from "@/lib/atlas-analytics";

export const ANALYTICS_PREFERENCE_CHANGED_EVENT =
  "atlas:analytics-preference-changed";

type AnalyticsPreferenceWrite = {
  attempted: AnalyticsPreference;
  written: AnalyticsConsentState;
};

/**
 * Opt-out whose write did not persist. Storage can still read as not-decided
 * or as a stale grant, both of which would otherwise keep the SDK on.
 * Cleared when this document persists a choice or another tab writes one.
 */
let unpersistedOptOut = false;

export function readEnforcedAnalyticsPreference(): AnalyticsConsentState {
  if (unpersistedOptOut) {
    return "storage-unavailable";
  }
  return readBrowserAnalyticsPreference();
}

function enforceStoredAnalyticsPreference(): void {
  const mayStart = analyticsMayStart({
    consent: readEnforcedAnalyticsPreference(),
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
  // A persisted grant or denial from another tab replaces an opt-out this
  // document could not save. Clearing the key does not: that opt-out stays
  // off until a choice is actually stored. A missing preference with no
  // held opt-out remains the default-on path.
  if (event.key === ANALYTICS_PREFERENCE_KEY) {
    const stored = readBrowserAnalyticsPreference();
    if (stored === "granted" || stored === "denied") {
      unpersistedOptOut = false;
    }
  }
  notifyAnalyticsPreferenceChanged();
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", onCrossTabAnalyticsPreference);
}

export function AnalyticsClient() {
  const pathname = usePathname();
  const [consent, setConsent] = useState<AnalyticsConsentState>("not-decided");
  const [preferenceReady, setPreferenceReady] = useState(false);

  useEffect(() => {
    const refreshPreference = () => {
      enforceStoredAnalyticsPreference();
      setConsent(readEnforcedAnalyticsPreference());
      setPreferenceReady(true);
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
    // The first render still has the placeholder consent. Wait until the
    // preference effect has read storage so an opt-out, Do Not Track signal,
    // or storage failure cannot initialize the SDK for one frame.
    if (!preferenceReady) {
      return;
    }
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
      const started = await atlasAnalytics.start(readAmplitudeApiKey());
      if (started && !cancelled) trackRouteView(pathname);
    }

    void startAnalytics();

    return () => {
      cancelled = true;
    };
  }, [consent, pathname, preferenceReady]);

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

export function notifyAnalyticsPreferenceChanged(
  update?: AnalyticsPreferenceWrite
): void {
  // Stop here, not only in AnalyticsClient. The professional /app shell does
  // not mount that listener, and a grant made on legacy Atlas keeps the
  // module-global SDK alive after the listener unmounts. Cross-tab storage
  // events call this same path. A failed opt-out is remembered before the
  // storage re-read so default-on cannot start the SDK again this document.
  if (
    update?.attempted === "denied" &&
    update.written === "storage-unavailable"
  ) {
    unpersistedOptOut = true;
  } else if (update?.written === "granted" || update?.written === "denied") {
    unpersistedOptOut = false;
  }
  enforceStoredAnalyticsPreference();
  window.dispatchEvent(new Event(ANALYTICS_PREFERENCE_CHANGED_EVENT));
}
