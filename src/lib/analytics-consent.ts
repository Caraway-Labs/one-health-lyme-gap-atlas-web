export const ANALYTICS_PREFERENCE_KEY = "atlas.analytics-preference.v1";

const PREFERENCE_LIFETIME_MS = 1000 * 60 * 60 * 24 * 183;

export type AnalyticsPreference = "granted" | "denied";

export type StoredAnalyticsPreference = {
  decision: AnalyticsPreference;
  decidedAt: string;
  expiresAt: string;
  version: 1;
};

export type AnalyticsConsentState =
  | "granted"
  | "denied"
  | "not-decided"
  | "storage-unavailable";

type BrowserNavigator = Pick<Navigator, "doNotTrack">;

export function honorsDoNotTrack(navigator: BrowserNavigator): boolean {
  return navigator.doNotTrack === "1" || navigator.doNotTrack === "yes";
}

export function readAnalyticsPreference(
  storage: Storage,
  now = new Date()
): AnalyticsConsentState {
  try {
    const serialized = storage.getItem(ANALYTICS_PREFERENCE_KEY);
    if (!serialized) {
      return "not-decided";
    }

    let preference: StoredAnalyticsPreference;
    try {
      preference = JSON.parse(serialized);
    } catch {
      storage.removeItem(ANALYTICS_PREFERENCE_KEY);
      return "not-decided";
    }
    const isValid =
      preference.version === 1 &&
      (preference.decision === "granted" || preference.decision === "denied") &&
      !Number.isNaN(Date.parse(preference.decidedAt)) &&
      !Number.isNaN(Date.parse(preference.expiresAt));

    if (!isValid || Date.parse(preference.expiresAt) <= now.getTime()) {
      storage.removeItem(ANALYTICS_PREFERENCE_KEY);
      return "not-decided";
    }

    return preference.decision;
  } catch {
    return "storage-unavailable";
  }
}

export function writeAnalyticsPreference(
  storage: Storage,
  decision: AnalyticsPreference,
  now = new Date()
): AnalyticsConsentState {
  try {
    const preference: StoredAnalyticsPreference = {
      decision,
      decidedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + PREFERENCE_LIFETIME_MS).toISOString(),
      version: 1,
    };
    storage.setItem(ANALYTICS_PREFERENCE_KEY, JSON.stringify(preference));
    return decision;
  } catch {
    return "storage-unavailable";
  }
}

export function analyticsMayStart({
  consent,
  doNotTrack,
}: {
  consent: AnalyticsConsentState;
  doNotTrack: boolean;
}): boolean {
  return consent === "granted" && !doNotTrack;
}
