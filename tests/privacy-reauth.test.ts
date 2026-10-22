import { afterEach, describe, expect, it } from "vitest";

import {
  accessTokenIssuedAtMs,
  beginPrivacyReauthResume,
  claimPrivacyReauthChallenge,
  clearPrivacyReauthChallenge,
  endPrivacyReauthResume,
  previousIssuedAtForReauth,
  PRIVACY_REAUTH_CLOCK_SKEW_MS,
  PRIVACY_REAUTH_MAX_AGE_MS,
  PRIVACY_REAUTH_STORAGE_KEY,
  privacyReauthChallengeExpired,
  privacyReauthResumeDisposition,
  privacyReauthSatisfied,
  privacyReauthSubjectDecision,
  privacyReauthSubjectId,
  readPrivacyReauthChallenge,
  resetPrivacyReauthResumeForTests,
  savePrivacyReauthChallenge,
  type PrivacyReauthChallenge,
  type PrivacySessionSnapshot,
} from "../src/lib/auth/privacy-reauth";

const NOW = 1_800_000_000_000;

function challenge(
  overrides: Partial<PrivacyReauthChallenge> = {}
): PrivacyReauthChallenge {
  return {
    action: "export",
    challengedAtMs: NOW - 60_000,
    nonce: "11111111-1111-4111-8111-111111111111",
    previousIssuedAtMs: NOW - 120_000,
    subjectId: "user-a",
    ...overrides,
  };
}

function snapshot(
  overrides: Partial<PrivacySessionSnapshot> = {}
): PrivacySessionSnapshot {
  return {
    accessToken: "token-a",
    issuedAtMs: NOW - 5000,
    present: true,
    userId: "user-a",
    ...overrides,
  };
}

function token(issuedAtMs: number): string {
  const payload = btoa(JSON.stringify({ iat: issuedAtMs / 1000 }))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${payload}.sig`;
}

function payloadToken(payload: string): string {
  const encoded = btoa(payload)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `header.${encoded}.sig`;
}

function withLocalStorage(get: () => Storage, run: () => void) {
  const descriptor = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get,
  });
  try {
    run();
  } finally {
    if (descriptor) {
      Object.defineProperty(window, "localStorage", descriptor);
    } else {
      Reflect.deleteProperty(window, "localStorage");
    }
  }
}

describe("privacy reauthentication", () => {
  afterEach(() => {
    localStorage.clear();
    resetPrivacyReauthResumeForTests();
  });

  it("reads an access-token issued-at and rejects malformed tokens", () => {
    expect({
      infinite: accessTokenIssuedAtMs(payloadToken('{"iat":1e309}')),
      missing: accessTokenIssuedAtMs("not-a-jwt"),
      nan: accessTokenIssuedAtMs(token(Number.NaN)),
      text: accessTokenIssuedAtMs("header.@@@.sig"),
      valid: accessTokenIssuedAtMs(token(NOW)),
    }).toStrictEqual({
      infinite: null,
      missing: null,
      nan: null,
      text: null,
      valid: NOW,
    });
  });

  it("rejects access tokens whose payload is not an issued-at claim", () => {
    expect({
      array: accessTokenIssuedAtMs(payloadToken("[]")),
      empty: accessTokenIssuedAtMs(payloadToken("null")),
      stringIssuedAt: accessTokenIssuedAtMs(payloadToken('{"iat":"100"}')),
      withoutIssuedAt: accessTokenIssuedAtMs(payloadToken('{"sub":"user-a"}')),
    }).toStrictEqual({
      array: null,
      empty: null,
      stringIssuedAt: null,
      withoutIssuedAt: null,
    });
  });

  it("accepts a newer sign-in inside the 15-minute API window", () => {
    const issuedAtMs = NOW - PRIVACY_REAUTH_MAX_AGE_MS;
    const current = challenge({
      challengedAtMs: issuedAtMs,
      previousIssuedAtMs: issuedAtMs - 1000,
    });
    expect(privacyReauthSatisfied(current, NOW - 5000, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, issuedAtMs, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, issuedAtMs - 1000, NOW)).toBeFalsy();
    expect(privacyReauthSatisfied(current, null, NOW)).toBeFalsy();
  });

  it("rejects the same token, a stale token, and an expired challenge", () => {
    const current = challenge();
    expect(
      privacyReauthSatisfied(current, current.previousIssuedAtMs, NOW)
    ).toBeFalsy();
    expect(
      privacyReauthSatisfied(
        current,
        NOW - PRIVACY_REAUTH_MAX_AGE_MS - 1000,
        NOW
      )
    ).toBeFalsy();
    const expired = challenge({
      challengedAtMs: NOW - PRIVACY_REAUTH_MAX_AGE_MS - 1,
    });
    expect(privacyReauthChallengeExpired(expired, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(expired, NOW - 5000, NOW)).toBeFalsy();
  });

  it("allows a small clock skew but not an older sign-in", () => {
    const withinSkew = NOW - PRIVACY_REAUTH_CLOCK_SKEW_MS;
    const current = challenge({
      challengedAtMs: NOW,
      previousIssuedAtMs: withinSkew - 60_000,
    });
    expect(privacyReauthSatisfied(current, withinSkew, NOW)).toBeTruthy();
    expect(privacyReauthSatisfied(current, withinSkew - 1000, NOW)).toBeFalsy();
  });

  it("records a missing session as no prior issued-at", () => {
    expect(
      previousIssuedAtForReauth({ issuedAtMs: null, present: false }, NOW)
    ).toBe(0);
    expect(
      previousIssuedAtForReauth({ issuedAtMs: NOW - 1000, present: true }, NOW)
    ).toBe(NOW - 1000);
    expect(
      previousIssuedAtForReauth({ issuedAtMs: null, present: true }, NOW)
    ).toBe(NOW);
  });

  it("binds a challenge to an account id and ignores any other id", () => {
    expect({
      empty: privacyReauthSubjectId(""),
      missing: privacyReauthSubjectId(null),
      spaced: privacyReauthSubjectId("user a"),
      valid: privacyReauthSubjectId("user-a"),
    }).toStrictEqual({
      empty: null,
      missing: null,
      spaced: null,
      valid: "user-a",
    });
    const current = challenge();
    expect({
      absent: privacyReauthSubjectDecision(current, null),
      match: privacyReauthSubjectDecision(current, "user-a"),
      mismatch: privacyReauthSubjectDecision(current, "user-b"),
    }).toStrictEqual({
      absent: "absent",
      match: "match",
      mismatch: "mismatch",
    });
  });

  it("runs only for the confirming account and clears every other account", () => {
    const current = challenge();
    expect({
      absent: privacyReauthResumeDisposition(
        current,
        snapshot({
          accessToken: null,
          issuedAtMs: null,
          present: false,
          userId: null,
        }),
        NOW
      ),
      expiredMismatch: privacyReauthResumeDisposition(
        challenge({ challengedAtMs: NOW - PRIVACY_REAUTH_MAX_AGE_MS - 1 }),
        snapshot({ userId: "user-b" }),
        NOW
      ),
      match: privacyReauthResumeDisposition(current, snapshot(), NOW),
      mismatch: privacyReauthResumeDisposition(
        current,
        snapshot({ accessToken: "token-b", userId: "user-b" }),
        NOW
      ),
      staleMatch: privacyReauthResumeDisposition(
        current,
        snapshot({ issuedAtMs: current.previousIssuedAtMs }),
        NOW
      ),
    }).toStrictEqual({
      absent: "wait",
      expiredMismatch: "clear",
      match: "run",
      mismatch: "clear",
      staleMatch: "wait",
    });
  });

  it("claims only the stored challenge for this attempt", () => {
    const current = challenge();
    savePrivacyReauthChallenge(current);
    expect(readPrivacyReauthChallenge()).toStrictEqual(current);
    expect(claimPrivacyReauthChallenge("someone-else")).toBeNull();
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toContain(
      "export"
    );
    expect(claimPrivacyReauthChallenge(current.nonce)).toStrictEqual(current);
    expect(localStorage.getItem(PRIVACY_REAUTH_STORAGE_KEY)).toBeNull();
  });

  it("ignores malformed stored challenges", () => {
    localStorage.setItem(PRIVACY_REAUTH_STORAGE_KEY, "{");
    expect(readPrivacyReauthChallenge()).toBeNull();
    localStorage.setItem(
      PRIVACY_REAUTH_STORAGE_KEY,
      JSON.stringify({ action: "export" })
    );
    expect(readPrivacyReauthChallenge()).toBeNull();
    for (const raw of [
      "null",
      "[]",
      "1",
      JSON.stringify({
        action: "archive",
        challengedAtMs: NOW,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: NOW,
        subjectId: "user-a",
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: 1.5,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: NOW,
        subjectId: "user-a",
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: NOW,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: -1,
        subjectId: "user-a",
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: NOW,
        nonce: "not a nonce",
        previousIssuedAtMs: NOW,
        subjectId: "user-a",
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: NOW,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: NOW,
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: NOW,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: NOW,
        subjectId: "user a",
      }),
      JSON.stringify({
        action: "deletion",
        challengedAtMs: NOW,
        nonce: "11111111-1111-4111-8111-111111111111",
        previousIssuedAtMs: NOW,
        subjectId: 12,
      }),
    ]) {
      localStorage.setItem(PRIVACY_REAUTH_STORAGE_KEY, raw);
      expect(readPrivacyReauthChallenge()).toBeNull();
    }
    clearPrivacyReauthChallenge();
    expect(readPrivacyReauthChallenge()).toBeNull();
    expect(claimPrivacyReauthChallenge(challenge().nonce)).toBeNull();
  });

  it("keeps one resume in flight until that attempt ends", () => {
    const current = challenge();
    const other = challenge({
      nonce: "22222222-2222-4222-8222-222222222222",
    });
    expect(beginPrivacyReauthResume(current.nonce)).toBeTruthy();
    expect(beginPrivacyReauthResume(current.nonce)).toBeTruthy();
    expect(beginPrivacyReauthResume(other.nonce)).toBeFalsy();
    endPrivacyReauthResume(other.nonce);
    expect(beginPrivacyReauthResume(other.nonce)).toBeFalsy();
    endPrivacyReauthResume(current.nonce);
    expect(beginPrivacyReauthResume(other.nonce)).toBeTruthy();
    endPrivacyReauthResume(other.nonce);
  });

  it("treats denied or missing storage as no saved challenge", () => {
    const current = challenge();
    withLocalStorage(
      () => {
        throw new DOMException(
          "Failed to read the 'localStorage' property from 'Window'",
          "SecurityError"
        );
      },
      () => {
        expect(readPrivacyReauthChallenge()).toBeNull();
        expect(claimPrivacyReauthChallenge(current.nonce)).toBeNull();
        clearPrivacyReauthChallenge();
        expect(() => savePrivacyReauthChallenge(current)).toThrow(
          "Privacy reauthentication could not be saved."
        );
      }
    );

    const denied = {
      getItem() {
        throw new DOMException("storage denied", "SecurityError");
      },
      setItem() {
        throw new DOMException("storage denied", "SecurityError");
      },
      removeItem() {
        throw new DOMException("storage denied", "SecurityError");
      },
    } as unknown as Storage;
    withLocalStorage(
      () => denied,
      () => {
        expect(readPrivacyReauthChallenge()).toBeNull();
        clearPrivacyReauthChallenge();
        expect(() => savePrivacyReauthChallenge(current)).toThrow(
          "Privacy reauthentication could not be saved."
        );
      }
    );

    withLocalStorage(
      () => undefined as unknown as Storage,
      () => {
        expect(readPrivacyReauthChallenge()).toBeNull();
        clearPrivacyReauthChallenge();
        expect(() => savePrivacyReauthChallenge(current)).toThrow(
          "Privacy reauthentication could not be saved."
        );
      }
    );
  });
});
