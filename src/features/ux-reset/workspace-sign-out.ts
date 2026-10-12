/**
 * Shared by the sidebar and Settings. Each sign-out attempt gets an epoch.
 * A later failure cannot clear an earlier success, and a stale failure cannot
 * clear a newer attempt. Success records that this document logged out. The
 * restored-workspace cover is applied synchronously, before any session read,
 * so a back-forward cache page does not show the previous account.
 */
const RESTORE_COVER_ID = "workspace-restore-cover";
const RESTORE_COVER_LABEL = "Checking session";

let documentUserId: string | null = null;
let loggedOutInPageLifetime = false;
let navigatingHome = false;
let openSignOutEpoch = 0;
let signOutEpoch = 0;
let succeededSignOutEpoch = 0;
let restoredWorkspaceConcealed = false;
const restoreListeners = new Set<() => void>();

export function noteWorkspaceDocumentUser(userId: string): void {
  if (documentUserId === null) {
    documentUserId = userId;
  }
}

export function workspaceDocumentUserId(): string | null {
  return documentUserId;
}

export function beginWorkspaceSignOut(): number {
  signOutEpoch += 1;
  openSignOutEpoch = signOutEpoch;
  navigatingHome = true;
  return signOutEpoch;
}

export function abortWorkspaceSignOut(epoch: number): void {
  if (epoch !== openSignOutEpoch || succeededSignOutEpoch !== 0) {
    return;
  }
  navigatingHome = false;
}

export function completeWorkspaceSignOut(epoch: number): void {
  succeededSignOutEpoch = epoch;
  loggedOutInPageLifetime = true;
  navigatingHome = true;
}

export function workspaceLoggedOutInPageLifetime(): boolean {
  return loggedOutInPageLifetime;
}

export function workspaceSignOutSuppressesExpiryRedirect(): boolean {
  return navigatingHome;
}

export function workspaceRestoreConcealed(): boolean {
  return restoredWorkspaceConcealed;
}

export function subscribeWorkspaceRestore(listener: () => void): () => void {
  restoreListeners.add(listener);
  return () => {
    restoreListeners.delete(listener);
  };
}

function notifyRestoreListeners(): void {
  for (const listener of restoreListeners) {
    listener();
  }
}

/** Hides the professional shell before a restored session read returns. */
export function concealRestoredWorkspace(): void {
  restoredWorkspaceConcealed = true;
  document.documentElement.dataset.workspaceRestore = "concealed";
  const shell = document.querySelector(".ux-reset-pro-app");
  if (shell instanceof HTMLElement) {
    shell.hidden = true;
    shell.inert = true;
  }
  if (!document.querySelector(`#${RESTORE_COVER_ID}`)) {
    const cover = document.createElement("div");
    cover.id = RESTORE_COVER_ID;
    cover.className = "workspace-restore-cover";
    cover.dataset.testid = "workspace-restore-cover";
    cover.setAttribute("role", "status");
    cover.textContent = RESTORE_COVER_LABEL;
    document.body.append(cover);
  }
  notifyRestoreListeners();
}

/** Shows the shell again after the restored session matches this document. */
export function revealRestoredWorkspace(): void {
  restoredWorkspaceConcealed = false;
  delete document.documentElement.dataset.workspaceRestore;
  const shell = document.querySelector(".ux-reset-pro-app");
  if (shell instanceof HTMLElement) {
    shell.hidden = false;
    shell.inert = false;
  }
  document.querySelector(`#${RESTORE_COVER_ID}`)?.remove();
  notifyRestoreListeners();
}

export function resetWorkspaceSignOutStateForTests(): void {
  documentUserId = null;
  loggedOutInPageLifetime = false;
  navigatingHome = false;
  openSignOutEpoch = 0;
  signOutEpoch = 0;
  succeededSignOutEpoch = 0;
  if (typeof document === "undefined") {
    restoredWorkspaceConcealed = false;
  } else {
    revealRestoredWorkspace();
  }
}
