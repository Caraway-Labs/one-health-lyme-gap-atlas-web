import type { DocsMarkdownKind } from "@/lib/docs-llms-export";

export type DocsPageAction = "copy-markdown" | "view-source";

export type ClipboardTextWriter = {
  writeText: (value: string) => Promise<void>;
};

export type CopyPageMarkdownResult =
  | { method: "clipboard" | "fallback"; status: "copied" }
  | { status: "unavailable" };

const markdownCache = new Map<string, Promise<string>>();

export function docsPageActionKind(action: DocsPageAction): DocsMarkdownKind {
  switch (action) {
    case "copy-markdown": {
      return "processed";
    }
    case "view-source": {
      return "raw";
    }
    default: {
      const unreachable: never = action;
      return unreachable;
    }
  }
}

/**
 * Public export path for a docs page. `/docs` becomes `/docs.md` or
 * `/docs.mdx`; nested pages append the same suffix. Those paths are the
 * rewrites served by the documentation export route.
 */
export function docsPageActionPath(
  pageUrl: string,
  action: DocsPageAction
): string {
  const normalized =
    pageUrl.length > 1 && pageUrl.endsWith("/")
      ? pageUrl.slice(0, -1)
      : pageUrl;
  if (!normalized.startsWith("/docs")) {
    throw new Error("Documentation page actions require a /docs URL.");
  }
  const suffix = docsPageActionKind(action) === "processed" ? ".md" : ".mdx";
  return `${normalized}${suffix}`;
}

async function readMarkdownResponse(
  url: string,
  fetchImpl: typeof fetch
): Promise<string> {
  const response = await fetchImpl(url);
  if (!response.ok) {
    throw new Error("Documentation markdown export failed.");
  }
  const type = response.headers.get("content-type") ?? "";
  const markdownType =
    type.toLowerCase().includes("markdown") ||
    type.toLowerCase().includes("text/plain");
  if (!markdownType) {
    throw new Error("Documentation markdown export was not markdown.");
  }
  return response.text();
}

export async function loadDocsPageMarkdown(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const cached = markdownCache.get(url);
  if (cached) return cached;
  const pending = readMarkdownResponse(url, fetchImpl);
  markdownCache.set(url, pending);
  try {
    return await pending;
  } catch (error) {
    markdownCache.delete(url);
    throw error;
  }
}

export async function copyPageMarkdown(
  text: string,
  clipboard: ClipboardTextWriter | null | undefined,
  fallbackCopy: (value: string) => boolean
): Promise<CopyPageMarkdownResult> {
  if (clipboard && typeof clipboard.writeText === "function") {
    try {
      await clipboard.writeText(text);
      return { method: "clipboard", status: "copied" };
    } catch {
      // Permission or an insecure context rejects the async clipboard API.
    }
  }
  if (fallbackCopy(text)) {
    return { method: "fallback", status: "copied" };
  }
  return { status: "unavailable" };
}

export function copyWithDocumentExecCommand(
  text: string,
  documentRef: Document | undefined = globalThis.document
): boolean {
  if (!documentRef?.body || typeof documentRef.execCommand !== "function") {
    return false;
  }
  const area = documentRef.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.setAttribute("aria-hidden", "true");
  area.tabIndex = -1;
  area.style.position = "fixed";
  area.style.opacity = "0";
  documentRef.body.append(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = documentRef.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    area.remove();
  }
  return copied;
}
