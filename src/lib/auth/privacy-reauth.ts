/**
 * Export and deletion require a new sign-in before the request is created.
 * ADR 0016 accepts a confirm only when the access token `iat` is within 15
 * minutes, so a still-valid session would otherwise run immediately. The
 * challenge records the account that confirmed and that token. A later
 * session must be the same account and newer than that token.
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
  /** Account that confirmed the action. A different sign-in must not resume it. */
  subjectId: string;
};

export type PrivacySessionStamp = {
  issuedAtMs: number | null;
  present: boolean;
};

export type PrivacySessionSnapshot = PrivacySessionStamp & {
  accessToken: string | null;
  userId: string | null;
};

export type PrivacyReauthSubjectDecision = "absent" | "match" | "mismatch";

export type PrivacyReauthResumeDisposition = "clear" | "run" | "wait";

const NONCE_PATTERN = /^[0-9a-f-]{16,80}$/i;

/** Supabase user ids are UUIDs. Tests and local fixtures also use short ids. */
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;

let activeResumeNonce: string | null = null;

function isPrivacyReauthAction(value: unknown): value is PrivacyReauthAction {
  return value === "export" || value === "deletion";
}

function isTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Accepts only a bounded account id. Anything else is not a bindable subject. */
export function privacyReauthSubjectId(value: unknown): string | null {
  return typeof value === "string" && SUBJECT_ID_PATTERN.test(value)
    ? value
    : null;
}

/**
 * `null` means nobody is signed in yet, so the challenge can wait.
 * Any other account is a mismatch and must not resume the stored action.
 */
export function privacyReauthSubjectDecision(
  challenge: PrivacyReauthChallenge,
  userId: string | null
): PrivacyReauthSubjectDecision {
  if (userId === null) return "absent";
  if (userId === challenge.subjectId) return "match";
  return "mismatch";
}

/**
 * Whether a saved export or deletion may run for this session.
 * A different account clears the challenge. No session waits. Only the
 * confirming account with a newer token inside the API window may run.
 */
export function privacyReauthResumeDisposition(
  challenge: PrivacyReauthChallenge,
  snapshot: PrivacySessionSnapshot,
  nowMs: number
): PrivacyReauthResumeDisposition {
  if (privacyReauthChallengeExpired(challenge, nowMs)) return "clear";
  const decision = privacyReauthSubjectDecision(challenge, snapshot.userId);
  if (decision === "absent") return "wait";
  if (decision === "mismatch") return "clear";
  decision satisfies "match";
  return privacyReauthSatisfied(challenge, snapshot.issuedAtMs, nowMs)
    ? "run"
    : "wait";
}

/**
 * Getting `localStorage` itself can throw a SecurityError in browsers that
 * deny storage. That access stays inside this try/catch so Settings can still
 * render when the challenge cannot be read.
 */
function storage(): Storage | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
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
  let raw: string | null;
  try {
    raw = storage()?.getItem(PRIVACY_REAUTH_STORAGE_KEY) ?? null;
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (
      !("action" in parsed) ||
      !("challengedAtMs" in parsed) ||
      !("nonce" in parsed) ||
      !("previousIssuedAtMs" in parsed) ||
      !("subjectId" in parsed)
    ) {
      return null;
    }
    const { action, challengedAtMs, nonce, previousIssuedAtMs, subjectId } =
      parsed;
    if (!isPrivacyReauthAction(action)) return null;
    if (!isTimestamp(challengedAtMs) || !isTimestamp(previousIssuedAtMs)) {
      return null;
    }
    if (typeof nonce !== "string" || !NONCE_PATTERN.test(nonce)) return null;
    const boundSubjectId = privacyReauthSubjectId(subjectId);
    if (boundSubjectId === null) return null;
    return {
      action,
      challengedAtMs,
      nonce,
      previousIssuedAtMs,
      subjectId: boundSubjectId,
    };
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
  try {
    store.setItem(PRIVACY_REAUTH_STORAGE_KEY, JSON.stringify(challenge));
  } catch {
    throw new Error("Privacy reauthentication could not be saved.");
  }
}

export function clearPrivacyReauthChallenge(): void {
  try {
    storage()?.removeItem(PRIVACY_REAUTH_STORAGE_KEY);
  } catch {
    // A later denial cannot be cleared, and it also cannot keep the challenge.
  }
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
