/**
 * Next.js writes its canonical URL from HistoryUpdater during hydration, before
 * the App Router popstate listener exists. A Back/Forward in that gap is
 * applied by the browser and then replaced with the document URL. Reload the
 * history entry the browser already moved to instead of keeping the stale page.
 */

let installed = false;
let routerHistoryReady = false;
let recovering = false;
let displacedHref: string | null = null;
let nativeReplaceState: typeof history.replaceState | null = null;

function navigationDocumentHref(): string {
  const entry = performance.getEntriesByType("navigation")[0];
  if (entry && "name" in entry && entry.name.length > 0) {
    return entry.name;
  }
  return window.location.href;
}

function pathnameOf(href: string): string | null {
  try {
    return new URL(href, window.location.href).pathname;
  } catch {
    return null;
  }
}

function scheduleHistoryRecovery(href: string): void {
  if (recovering) {
    return;
  }
  recovering = true;
  queueMicrotask(() => {
    window.location.replace(href);
  });
}

export function installBrowserHistoryHydrationGuard(
  documentHref?: string,
  reload: (href: string) => void = scheduleHistoryRecovery
): void {
  if (typeof window === "undefined" || installed) {
    return;
  }
  installed = true;
  const resolvedDocumentHref = documentHref ?? navigationDocumentHref();
  nativeReplaceState = history.replaceState.bind(history);
  const documentPath = pathnameOf(resolvedDocumentHref);
  if (
    documentPath !== null &&
    documentPath !== pathnameOf(window.location.href)
  ) {
    displacedHref = window.location.href;
  }

  window.addEventListener("popstate", () => {
    if (!routerHistoryReady) {
      displacedHref = window.location.href;
    }
  });

  const previous = nativeReplaceState;
  history.replaceState = (data, unused, url) => {
    const nextHref = url == null ? null : String(url);
    const nextPath = nextHref === null ? null : pathnameOf(nextHref);
    const displacedPath =
      displacedHref === null ? null : pathnameOf(displacedHref);
    if (
      !routerHistoryReady &&
      displacedHref !== null &&
      displacedPath !== null &&
      nextPath !== null &&
      documentPath !== null &&
      nextPath !== displacedPath &&
      nextPath === documentPath
    ) {
      reload(displacedHref);
      return;
    }
    previous(data, unused, url);
  };
}

export function markBrowserHistoryHydrationReady(): void {
  routerHistoryReady = true;
  displacedHref = null;
}

export function resetBrowserHistoryHydrationGuardForTests(): void {
  if (nativeReplaceState) {
    history.replaceState = nativeReplaceState;
  }
  nativeReplaceState = null;
  installed = false;
  routerHistoryReady = false;
  recovering = false;
  displacedHref = null;
}
