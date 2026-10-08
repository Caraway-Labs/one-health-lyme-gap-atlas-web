export const FRONT_PORCH_SESSION_HEADER = "x-atlas-front-porch-session";

/**
 * Middleware is the only place that may refresh a Front Porch session.
 * The page reads this header and does not write cookies during render.
 * Any other value, including a client-supplied one that middleware replaced,
 * is signed out.
 */
export function frontPorchSessionHeaders(
  source: Headers,
  signedIn: boolean
): Headers {
  const headers = new Headers(source);
  headers.set(FRONT_PORCH_SESSION_HEADER, signedIn ? "1" : "0");
  return headers;
}

export function isFrontPorchSignedInHeader(value: string | null): boolean {
  return value === "1";
}
