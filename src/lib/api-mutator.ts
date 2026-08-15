const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function apiMutator<T>(
  url: string,
  options: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${url}`, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Atlas API request failed (${response.status})`);
  }
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("json") || contentType.includes("geo+json")
    ? await response.json()
    : await response.text();
  return { data, status: response.status, headers: response.headers } as T;
}
