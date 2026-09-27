import { getPublicConfig } from "@/lib/public-config";

function parseRetryAfterSeconds(value: string | null): number | null {
  if (!value) return null;
  const asInteger = Number.parseInt(value, 10);
  if (String(asInteger) === value.trim() && asInteger >= 0) {
    return asInteger;
  }
  const asDate = Date.parse(value);
  if (Number.isNaN(asDate)) return null;
  return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
}

function shouldAttachBearer(url: string): boolean {
  return url.startsWith("/v1/me/") || url.startsWith("/v1/feedback");
}

export class AtlasApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;
  readonly responseBody: unknown;

  constructor(
    message: string,
    endpoint: string,
    status: number,
    requestId: string | null,
    retryAfterSeconds: number | null = null,
    responseBody: unknown = null
  ) {
    super(message);
    this.name = "AtlasApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
    this.responseBody = responseBody;
  }
}

export async function apiMutator<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const headers = new Headers(options.headers);
  if (shouldAttachBearer(url)) {
    try {
      const { createClient } = await import("@/lib/supabase/client");
      const { data } = await createClient().auth.getSession();
      if (data.session?.access_token) {
        headers.set("Authorization", `Bearer ${data.session.access_token}`);
      }
    } catch {
      // Anonymous callers and hosts without Supabase stay unsigned.
    }
  }
  const response = await fetch(`${getPublicConfig().apiBaseUrl}${url}`, {
    ...options,
    headers,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new AtlasApiError(
      body?.detail ?? `Atlas API request failed (${response.status})`,
      url,
      response.status,
      response.headers.get("X-Request-ID"),
      parseRetryAfterSeconds(response.headers.get("Retry-After")),
      body
    );
  }
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/pdf")
    ? await response.blob()
    : contentType.includes("json") || contentType.includes("geo+json")
      ? await response.json()
      : await response.text();
  return { data, headers: response.headers, status: response.status } as T;
}
