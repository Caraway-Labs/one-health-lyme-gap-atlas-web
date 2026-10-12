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
let signOutPending = false;
let succeededSignOutEpoch = 0;
let restoredWorkspaceConcealed = false;
let shellCheckGeneration = 0;
const restoreListeners = new Set<() => void>();
const signOutListeners = new Set<() => void>();

/** The latest shell check. An older read must not reveal or navigate. */
export function beginWorkspaceShellCheck(): number {
  shellCheckGeneration += 1;
  return shellCheckGeneration;
}

export function workspaceShellCheckCurrent(generation: number): boolean {
  return generation === shellCheckGeneration;
}

export function invalidateWorkspaceShellCheck(generation: number): void {
  if (generation !== shellCheckGeneration) {
    return;
  }
  shellCheckGeneration += 1;
}

export function noteWorkspaceDocumentUser(userId: string): void {
  if (documentUserId === null) {
    documentUserId = userId;
  }
}

export function workspaceDocumentUserId(): string | null {
  return documentUserId;
}

export function beginWorkspaceSignOut(): number | null {
  if (signOutPending) {
    return null;
  }
  signOutEpoch += 1;
  openSignOutEpoch = signOutEpoch;
  signOutPending = true;
  navigatingHome = true;
  notifySignOutListeners();
  return signOutEpoch;
}

export function abortWorkspaceSignOut(epoch: number): void {
  if (epoch !== openSignOutEpoch || succeededSignOutEpoch !== 0) {
    return;
  }
  navigatingHome = false;
  signOutPending = false;
  notifySignOutListeners();
}

export function completeWorkspaceSignOut(epoch: number): void {
  succeededSignOutEpoch = epoch;
  loggedOutInPageLifetime = true;
  navigatingHome = true;
  signOutPending = true;
  notifySignOutListeners();
}

export function workspaceLoggedOutInPageLifetime(): boolean {
  return loggedOutInPageLifetime;
}

export function workspaceSignOutPending(): boolean {
  return signOutPending;
}

export function workspaceSignOutSuppressesExpiryRedirect(): boolean {
  return navigatingHome;
}

export function subscribeWorkspaceSignOut(listener: () => void): () => void {
  signOutListeners.add(listener);
  return () => {
    signOutListeners.delete(listener);
  };
}

function notifySignOutListeners(): void {
  for (const listener of signOutListeners) {
    listener();
  }
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
  signOutPending = false;
  succeededSignOutEpoch = 0;
  shellCheckGeneration = 0;
  notifySignOutListeners();
  if (typeof document === "undefined") {
    restoredWorkspaceConcealed = false;
  } else {
    revealRestoredWorkspace();
  }
}
