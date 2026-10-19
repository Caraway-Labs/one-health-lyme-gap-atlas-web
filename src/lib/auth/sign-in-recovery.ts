export const SIGN_IN_COPY = {
  brand: "One Health Atlas",
  changeEmail: "Use a different email",
  confirmationBody: "Check your email for your Atlas sign-in link.",
  confirmationHeading: "Check your email",
  emailLabel: "Email",
  emailPlaceholder: "you@example.org",
  explanation: "We’ll email you a link to sign in or create your account.",
  google: "Continue with Google",
  googleUnavailable: "Google sign-in is unavailable. Please try again.",
  heading: "Sign in or create an account",
  help: "Help",
  notConfigured: "Account sign-in is not configured.",
  passwordHint: "No password needed.",
  privacy: "Privacy",
  purpose: "Sign in to use the Atlas workspace and keep your starting view.",
  resend: "Resend link",
  sending: "Sending…",
  invalidEmail: "Enter a valid email address.",
  separator: "or",
  submit: "Email me a sign-in link",
  throttle: "We could not send another link yet. Wait and try again.",
  unavailable: "We could not send a sign-in link. Please try again.",
} as const;

export type AuthProviderFailure = {
  code?: string;
  message?: string;
  status?: number;
};

const THROTTLE_CODES = new Set([
  "over_email_send_rate_limit",
  "over_request_rate_limit",
]);

const EMAIL_ADDRESS = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function signInEmailValidationMessage(address: string): string | null {
  if (EMAIL_ADDRESS.test(address)) return null;
  return SIGN_IN_COPY.invalidEmail;
}

export function emailConfirmRedirect(
  origin: string,
  nextPath: string | null
): string {
  if (!nextPath) {
    return `${origin}/auth/confirm`;
  }
  return `${origin}/auth/confirm?next=${encodeURIComponent(nextPath)}`;
}

export function googleCallbackRedirect(
  origin: string,
  nextPath: string | null
): string {
  if (!nextPath) {
    return `${origin}/auth/callback`;
  }
  return `${origin}/auth/callback?next=${encodeURIComponent(nextPath)}`;
}

export function isAuthDeliveryThrottled(error: AuthProviderFailure): boolean {
  if (error.status === 429) return true;
  if (error.code && THROTTLE_CODES.has(error.code)) return true;
  return /rate limit|only request this after/i.test(error.message ?? "");
}

export function signInDeliveryErrorMessage(error: AuthProviderFailure): string {
  if (isAuthDeliveryThrottled(error)) return SIGN_IN_COPY.throttle;
  if (error.message === SIGN_IN_COPY.notConfigured) {
    return SIGN_IN_COPY.notConfigured;
  }
  return SIGN_IN_COPY.unavailable;
}

export function signInCallbackErrorMessage(code: string | null): string | null {
  switch (code) {
    case "expired_or_invalid": {
      return "That sign-in link is no longer valid. Request a new one.";
    }
    case "missing_code": {
      return "Google sign-in did not finish. Try again or use email.";
    }
    case "missing_link": {
      return "That sign-in link is incomplete. Request a new one.";
    }
    case null:
    case "": {
      return null;
    }
    default: {
      return "Sign-in did not finish. Try again or use email.";
    }
  }
}
