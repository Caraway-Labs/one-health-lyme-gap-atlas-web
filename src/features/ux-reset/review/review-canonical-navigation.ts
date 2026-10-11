type LeavingClickModifiers = {
  altKey: boolean;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

/**
 * Href of a primary click that leaves Review. Modifier clicks and same-page
 * links stay with the browser.
 */
export function leavingReviewDestination(
  target: EventTarget | null,
  reviewPath: string,
  locationHref: string,
  modifiers: LeavingClickModifiers
): string | null {
  if (
    modifiers.button !== 0 ||
    modifiers.altKey ||
    modifiers.ctrlKey ||
    modifiers.metaKey ||
    modifiers.shiftKey
  ) {
    return null;
  }
  if (!(target instanceof Element)) {
    return null;
  }
  const anchor = target.closest("a[href]");
  if (!(anchor instanceof HTMLAnchorElement)) {
    return null;
  }
  if (anchor.target === "_blank" || anchor.hasAttribute("download")) {
    return null;
  }
  const rawHref = anchor.getAttribute("href");
  if (!rawHref) {
    return null;
  }
  const here = new URL(locationHref);
  const destination = new URL(rawHref, here);
  if (destination.origin !== here.origin) {
    return null;
  }
  if (destination.pathname === reviewPath) {
    return null;
  }
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

/**
 * When a scope rewrite is still applying and the click's navigation lost,
 * return the href the user chose. A completed navigation is left alone.
 */
export function followPendingReviewDestination(input: {
  destination: string | null;
  pathname: string;
  reviewPath: string;
}): string | null {
  if (!input.destination || input.pathname !== input.reviewPath) {
    return null;
  }
  return input.destination;
}

/**
 * After a scope rewrite settles, follow a click that is still on Review.
 * A newer rewrite or a completed navigation is left alone.
 */
export async function settleReviewCanonicalRewrite(input: {
  clearDestination: () => void;
  generation: number;
  isCurrentGeneration: (generation: number) => boolean;
  push: (href: string) => void;
  readDestination: () => string | null;
  removeListener: () => void;
  reviewPath: string;
  rewrite: Promise<unknown>;
}): Promise<void> {
  try {
    await input.rewrite;
  } catch {
    // A rejected rewrite can still leave the click on Review.
  }
  input.removeListener();
  if (!input.isCurrentGeneration(input.generation)) {
    return;
  }
  const follow = followPendingReviewDestination({
    destination: input.readDestination(),
    pathname: window.location.pathname,
    reviewPath: input.reviewPath,
  });
  input.clearDestination();
  if (follow) {
    input.push(follow);
  }
}
