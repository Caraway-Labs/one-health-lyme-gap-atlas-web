/**
 * Non-secret Amplitude deployment metadata for build-time project routing checks.
 * API keys remain in NEXT_PUBLIC_AMPLITUDE_API_KEY; this label must match the key's project.
 */
export const AMPLITUDE_PROJECT_IDS = {
  production: "856061",
  development: "860994",
} as const;

export type AmplitudeProjectTarget = keyof typeof AMPLITUDE_PROJECT_IDS;

export function readAmplitudeProjectTarget(): AmplitudeProjectTarget {
  const value = process.env.NEXT_PUBLIC_AMPLITUDE_PROJECT_TARGET;
  if (value === "development") {
    return "development";
  }
  return "production";
}

export function readAmplitudeApiKey(): string | undefined {
  const apiKey = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY?.trim();
  return apiKey || undefined;
}

export type AnalyticsRuntimeBlocker =
  | "consent_not_granted"
  | "do_not_track"
  | "storage_unavailable"
  | "missing_api_key";

export type AnalyticsRuntimeDiagnostics = {
  blocker: AnalyticsRuntimeBlocker | null;
  projectTarget: AmplitudeProjectTarget;
  projectId: string;
};

export function describeAnalyticsRuntime({
  consent,
  doNotTrack,
  apiKey,
  projectTarget = readAmplitudeProjectTarget(),
}: {
  consent: "granted" | "denied" | "not-decided" | "storage-unavailable";
  doNotTrack: boolean;
  apiKey?: string;
  projectTarget?: AmplitudeProjectTarget;
}): AnalyticsRuntimeDiagnostics {
  let blocker: AnalyticsRuntimeBlocker | null = null;
  if (consent === "storage-unavailable") {
    blocker = "storage_unavailable";
  } else if (consent !== "granted") {
    blocker = "consent_not_granted";
  } else if (doNotTrack) {
    blocker = "do_not_track";
  } else if (!apiKey) {
    blocker = "missing_api_key";
  }

  return {
    blocker,
    projectTarget,
    projectId: AMPLITUDE_PROJECT_IDS[projectTarget],
  };
}
