import { beforeEach, describe, expect, it } from "vitest";

import {
  abortWorkspaceSignOut,
  beginWorkspaceSignOut,
  completeWorkspaceSignOut,
  resetWorkspaceSignOutStateForTests,
  workspaceLoggedOutInPageLifetime,
  workspaceSignOutSuppressesExpiryRedirect,
} from "@/features/ux-reset/workspace-sign-out";

describe("workspace sign-out epochs", () => {
  beforeEach(() => {
    resetWorkspaceSignOutStateForTests();
  });

  it("clears redirect suppression when the only attempt fails", () => {
    const epoch = beginWorkspaceSignOut();
    abortWorkspaceSignOut(epoch);
    expect({
      loggedOut: workspaceLoggedOutInPageLifetime(),
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      loggedOut: false,
      suppressing: false,
    });
  });

  it("keeps a successful attempt when a later attempt fails", () => {
    const first = beginWorkspaceSignOut();
    const second = beginWorkspaceSignOut();
    completeWorkspaceSignOut(first);
    abortWorkspaceSignOut(second);
    expect({
      loggedOut: workspaceLoggedOutInPageLifetime(),
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      loggedOut: true,
      suppressing: true,
    });
  });

  it("ignores a stale failure while a newer attempt is open", () => {
    const first = beginWorkspaceSignOut();
    beginWorkspaceSignOut();
    abortWorkspaceSignOut(first);
    expect(workspaceSignOutSuppressesExpiryRedirect()).toBeTruthy();
  });

  it("clears suppression only after the newest attempt fails", () => {
    const first = beginWorkspaceSignOut();
    const second = beginWorkspaceSignOut();
    abortWorkspaceSignOut(first);
    abortWorkspaceSignOut(second);
    expect(workspaceSignOutSuppressesExpiryRedirect()).toBeFalsy();
  });

  it("does not let the successful attempt abort its own suppression", () => {
    const epoch = beginWorkspaceSignOut();
    completeWorkspaceSignOut(epoch);
    abortWorkspaceSignOut(epoch);
    expect(workspaceSignOutSuppressesExpiryRedirect()).toBeTruthy();
  });
});
