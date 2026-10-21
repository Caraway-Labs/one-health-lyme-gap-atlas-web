/**
 * Export and deletion require a new sign-in before the request is created.
 * ADR 0016 accepts a confirm only when the access token `iat` is within 15
 * minutes, so a still-valid session would otherwise run immediately. The
 * challenge records that token. A later session must be newer than it.
 */

export const PRIVACY_REAUTH_STORAGE_KEY = "atlas.privacy-reauth.v1";

/** Matches the API fresh-session window (`FRESH_SESSION` in ADR 0016). */
export const PRIVACY_REAUTH_MAX_AGE_MS = 15 * 60 * 1000;

/**
 * Client clocks can lead the access-token `iat`. This does not extend the
 * 15-minute API window.
 */
export const PRIVACY_REAUTH_CLOCK_SKEW_MS = 2 * 60 * 1000;

export const PRIVACY_REAUTH_CONTINUE_NOTICE =
  "Sign in again to continue this request.";

export type PrivacyReauthAction = "export" | "deletion";

export type PrivacyReauthChallenge = {
  action: PrivacyReauthAction;
  challengedAtMs: number;
  nonce: string;
  previousIssuedAtMs: number;
};

export type PrivacySessionStamp = {
  issuedAtMs: number | null;
  present: boolean;
};

const NONCE_PATTERN = /^[0-9a-f-]{16,80}$/i;

let activeResumeNonce: string | null = null;

function isPrivacyReauthAction(value: unknown): value is PrivacyReauthAction {
  return value === "export" || value === "deletion";
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function storage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage;
}

export function accessTokenIssuedAtMs(accessToken: string): number | null {
  const segment = accessToken.split(".")[1];
  if (!segment) return null;
  try {
    const normalized = segment.replaceAll("-", "+").replaceAll("_", "/");
    const padLength = (4 - (normalized.length % 4)) % 4;
    const payload: unknown = JSON.parse(
      atob(`${normalized}${"=".repeat(padLength)}`)
    );
    if (!payload || typeof payload !== "object" || !("iat" in payload)) {
      return null;
    }
    const issuedAt = payload.iat;
    if (typeof issuedAt !== "number" || !Number.isFinite(issuedAt)) {
      return null;
    }
    return Math.trunc(issuedAt) * 1000;
  } catch {
    return null;
  }
}

/** The issued-at a later sign-in must beat. A missing session uses zero. */
export function previousIssuedAtForReauth(
  stamp: PrivacySessionStamp,
  nowMs: number
): number {
  if (stamp.issuedAtMs !== null) return stamp.issuedAtMs;
  if (stamp.present) return nowMs;
  return 0;
}

export function privacyReauthChallengeExpired(
  challenge: PrivacyReauthChallenge,
  nowMs: number
): boolean {
  return nowMs - challenge.challengedAtMs > PRIVACY_REAUTH_MAX_AGE_MS;
}

export function privacyReauthSatisfied(
  challenge: PrivacyReauthChallenge,
  issuedAtMs: number | null,
  nowMs: number
): boolean {
  if (issuedAtMs === null) return false;
  if (privacyReauthChallengeExpired(challenge, nowMs)) return false;
  if (nowMs - issuedAtMs > PRIVACY_REAUTH_MAX_AGE_MS) return false;
  if (issuedAtMs <= challenge.previousIssuedAtMs) return false;
  if (issuedAtMs + PRIVACY_REAUTH_CLOCK_SKEW_MS < challenge.challengedAtMs) {
    return false;
  }
  return true;
}

export function readPrivacyReauthChallenge(): PrivacyReauthChallenge | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(PRIVACY_REAUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      !("action" in parsed) ||
      !("challengedAtMs" in parsed) ||
      !("nonce" in parsed) ||
      !("previousIssuedAtMs" in parsed)
    ) {
      return null;
    }
    const { action, challengedAtMs, nonce, previousIssuedAtMs } = parsed;
    if (!isPrivacyReauthAction(action)) return null;
    if (!isTimestamp(challengedAtMs) || !isTimestamp(previousIssuedAtMs)) {
      return null;
    }
    if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) return null;
    return { action, challengedAtMs, nonce, previousIssuedAtMs };
  } catch {
    return null;
  }
}

export function savePrivacyReauthChallenge(
  challenge: PrivacyReauthChallenge
): void {
  const store = storage();
  if (!store) {
    throw new Error("Privacy reauthentication could not be saved.");
  }
  store.setItem(PRIVACY_REAUTH_STORAGE_KEY, JSON.stringify(challenge));
}

export function clearPrivacyReauthChallenge(): void {
  storage()?.removeItem(PRIVACY_REAUTH_STORAGE_KEY);
}

/** Removes the stored challenge only when it is still this sign-in attempt. */
export function claimPrivacyReauthChallenge(
  nonce: string
): PrivacyReauthChallenge | null {
  const challenge = readPrivacyReauthChallenge();
  if (!challenge || challenge.nonce !== nonce) return null;
  clearPrivacyReauthChallenge();
  return challenge;
}

/**
 * One in-flight resume per challenge. React remounts the effect in
 * development; the same nonce may enter twice, and the caller drops the
 * stale run.
 */
export function beginPrivacyReauthResume(nonce: string): boolean {
  if (activeResumeNonce !== null && activeResumeNonce !== nonce) return false;
  activeResumeNonce = nonce;
  return true;
}

export function endPrivacyReauthResume(nonce: string): void {
  if (activeResumeNonce === nonce) activeResumeNonce = null;
}

export function resetPrivacyReauthResumeForTests(): void {
  activeResumeNonce = null;
}
