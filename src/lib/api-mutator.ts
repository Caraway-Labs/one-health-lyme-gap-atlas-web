import { getPublicConfig } from "@/lib/public-config";

export async function apiMutator<T>(
  url: string,
  options: RequestInit
): Promise<T> {
  const response = await fetch(
    `${getPublicConfig().apiBaseUrl}${url}`,
    options
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      body?.detail ?? `Atlas API request failed (${response.status})`
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
