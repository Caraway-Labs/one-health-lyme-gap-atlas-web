/**
 * Next.js writes its canonical URL from HistoryUpdater during hydration, before
 * the App Router popstate listener exists. A Back/Forward in that gap updates
 * the address bar and then leaves the loaded document in place, including when
 * the traversal only changes the query on the same pathname. Reload the history
 * entry the browser already selected. A traversal that already committed
 * before this module loads is still displaced when the address bar differs
 * from the loaded document by pathname, search, or hash. A later replaceState
 * may also try to write the loaded document URL back; skip that write. Other
 * same-page replaceState calls still apply.
 */

let installed = false;
let routerHistoryReady = false;
let recovering = false;
let displacedHref: string | null = null;
let nativeReplaceState: typeof history.replaceState | null = null;
let popstateListener: (() => void) | null = null;

function navigationDocumentHref(): string {
  const entry = performance.getEntriesByType("navigation")[0];
  if (entry && "name" in entry && entry.name.length > 0) {
    return entry.name;
  }
  return window.location.href;
}

function sameHistoryTarget(left: string, right: string): boolean {
  let leftUrl: URL;
  let rightUrl: URL;
  try {
    leftUrl = new URL(left, window.location.href);
    rightUrl = new URL(right, window.location.href);
  } catch {
    return false;
  }
  if (
    leftUrl.origin !== rightUrl.origin ||
    leftUrl.pathname !== rightUrl.pathname ||
    leftUrl.hash !== rightUrl.hash ||
    leftUrl.searchParams.size !== rightUrl.searchParams.size
  ) {
    return false;
  }
  for (const [key, value] of leftUrl.searchParams) {
    if (rightUrl.searchParams.get(key) !== value) {
      return false;
    }
  }
  return true;
}

function scheduleHistoryRecovery(href: string): void {
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
  const recover = (href: string): void => {
    if (recovering) {
      return;
    }
    recovering = true;
    reload(href);
  };
  nativeReplaceState = history.replaceState.bind(history);
  if (!sameHistoryTarget(window.location.href, resolvedDocumentHref)) {
    displacedHref = window.location.href;
  }

  popstateListener = () => {
    if (routerHistoryReady) {
      return;
    }
    displacedHref = window.location.href;
    if (!sameHistoryTarget(displacedHref, resolvedDocumentHref)) {
      recover(displacedHref);
    }
  };
  window.addEventListener("popstate", popstateListener);

  const previous = nativeReplaceState;
  history.replaceState = (data, unused, url) => {
    const nextHref = url == null ? null : String(url);
    const writesLoadedDocument =
      nextHref !== null && sameHistoryTarget(nextHref, resolvedDocumentHref);
    const traversalLeftDocument =
      displacedHref !== null &&
      !sameHistoryTarget(displacedHref, resolvedDocumentHref);
    if (
      !routerHistoryReady &&
      displacedHref !== null &&
      writesLoadedDocument &&
      traversalLeftDocument
    ) {
      recover(displacedHref);
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
  if (popstateListener) {
    window.removeEventListener("popstate", popstateListener);
  }
  popstateListener = null;
  installed = false;
  routerHistoryReady = false;
  recovering = false;
  displacedHref = null;
}
