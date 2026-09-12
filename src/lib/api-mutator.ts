import { getPublicConfig } from "@/lib/public-config";

export class AtlasApiError extends Error {
  readonly endpoint: string;
  readonly status: number;
  readonly requestId: string | null;

  constructor(
    message: string,
    endpoint: string,
    status: number,
    requestId: string | null
  ) {
    super(message);
    this.name = "AtlasApiError";
    this.endpoint = endpoint;
    this.status = status;
    this.requestId = requestId;
  }
}

export async function apiMutator<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const headers = new Headers(options.headers);
  if (url.startsWith("/v1/me/")) {
    const { createClient } = await import("@/lib/supabase/client");
    const { data } = await createClient().auth.getSession();
    if (data.session?.access_token)
      headers.set("Authorization", `Bearer ${data.session.access_token}`);
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
      response.headers.get("X-Request-ID")
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
