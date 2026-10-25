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

function browserLocalStorage(): Storage {
  return window.localStorage;
}

/**
 * Reads the browser preference. Getting `localStorage` itself can throw a
 * SecurityError before `readAnalyticsPreference` runs, so that access stays
 * inside this try/catch.
 */
export function readBrowserAnalyticsPreference(
  now = new Date()
): AnalyticsConsentState {
  try {
    return readAnalyticsPreference(browserLocalStorage(), now);
  } catch {
    return "storage-unavailable";
  }
}

/**
 * Writes the browser preference. Getting `localStorage` itself can throw
 * before `writeAnalyticsPreference` runs.
 */
export function writeBrowserAnalyticsPreference(
  decision: AnalyticsPreference,
  now = new Date()
): AnalyticsConsentState {
  try {
    return writeAnalyticsPreference(browserLocalStorage(), decision, now);
  } catch {
    return "storage-unavailable";
  }
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
  if (doNotTrack) {
    return false;
  }
  switch (consent) {
    case "granted":
    case "not-decided": {
      return true;
    }
    case "denied":
    case "storage-unavailable": {
      return false;
    }
    default: {
      const exhaustive: never = consent;
      return exhaustive;
    }
  }
}
