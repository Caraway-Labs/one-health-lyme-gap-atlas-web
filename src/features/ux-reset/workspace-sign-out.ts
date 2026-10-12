/**
 * Shared by the sidebar and Settings. The home-navigation mark is set before
 * sign-out so a SIGNED_OUT event cannot replace the page with sign-in while
 * navigation to the public home is still starting. Failure clears that mark.
 * Success also records that this document logged out. Both records live with
 * the page, so a back-forward cache restore still has them.
 */
let documentUserId: string | null = null;
let loggedOutInPageLifetime = false;
let navigatingHome = false;

export function noteWorkspaceDocumentUser(userId: string): void {
  if (documentUserId === null) {
    documentUserId = userId;
  }
}

export function workspaceDocumentUserId(): string | null {
  return documentUserId;
}

export function beginWorkspaceSignOut(): void {
  navigatingHome = true;
}

export function abortWorkspaceSignOut(): void {
  navigatingHome = false;
}

export function completeWorkspaceSignOut(): void {
  loggedOutInPageLifetime = true;
  navigatingHome = true;
}

export function workspaceLoggedOutInPageLifetime(): boolean {
  return loggedOutInPageLifetime;
}

export function workspaceSignOutSuppressesExpiryRedirect(): boolean {
  return navigatingHome;
}

export function resetWorkspaceSignOutStateForTests(): void {
  documentUserId = null;
  loggedOutInPageLifetime = false;
  navigatingHome = false;
}
