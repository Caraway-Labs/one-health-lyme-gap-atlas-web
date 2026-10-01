import { expect } from "@playwright/test";

export function expectAnalyticalHandoffHref(
  href: string | null,
  pathname: string,
  params: Record<string, string>
) {
  expect(href).toBeTruthy();
  const url = new URL(href!, "http://localhost");
  expect(url.pathname).toBe(pathname);
  for (const [key, value] of Object.entries(params)) {
    expect(url.searchParams.get(key)).toBe(value);
  }
}

/** Assert a nav link copies the listed query keys from the active page URL. */
export function expectNavLinkHandoffMatchesPage(
  href: string | null,
  pathname: string,
  pageUrl: string,
  paramKeys: string[]
) {
  expect(href).toBeTruthy();
  const linkUrl = new URL(href!, "http://localhost");
  const current = new URL(pageUrl);
  expect(linkUrl.pathname).toBe(pathname);
  for (const key of paramKeys) {
    expect(linkUrl.searchParams.get(key)).toBe(current.searchParams.get(key));
  }
}
