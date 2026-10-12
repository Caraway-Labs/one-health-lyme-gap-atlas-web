import { beforeEach, describe, expect, it } from "vitest";

import {
  abortWorkspaceSignOut,
  beginWorkspaceSignOut,
  completeWorkspaceSignOut,
  resetWorkspaceSignOutStateForTests,
  workspaceLoggedOutInPageLifetime,
  workspaceSignOutPending,
  workspaceSignOutSuppressesExpiryRedirect,
} from "@/features/ux-reset/workspace-sign-out";

function startedEpoch(): number {
  const epoch = beginWorkspaceSignOut();
  if (epoch === null) {
    throw new Error("Sign-out did not start.");
  }
  return epoch;
}

describe("workspace sign-out epochs", () => {
  beforeEach(() => {
    resetWorkspaceSignOutStateForTests();
  });

  it("clears redirect suppression when the only attempt fails", () => {
    const epoch = startedEpoch();
    abortWorkspaceSignOut(epoch);
    expect({
      loggedOut: workspaceLoggedOutInPageLifetime(),
      pending: workspaceSignOutPending(),
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      loggedOut: false,
      pending: false,
      suppressing: false,
    });
  });

  it("refuses a second attempt while one is pending", () => {
    const epoch = startedEpoch();
    expect(beginWorkspaceSignOut()).toBeNull();
    expect(workspaceSignOutPending()).toBeTruthy();
    abortWorkspaceSignOut(epoch + 1);
    expect(workspaceSignOutSuppressesExpiryRedirect()).toBeTruthy();
    abortWorkspaceSignOut(epoch);
    expect(workspaceSignOutPending()).toBeFalsy();
    expect(workspaceSignOutSuppressesExpiryRedirect()).toBeFalsy();
  });

  it("does not let the successful attempt abort its own suppression", () => {
    const epoch = startedEpoch();
    completeWorkspaceSignOut(epoch);
    expect(beginWorkspaceSignOut()).toBeNull();
    abortWorkspaceSignOut(epoch);
    expect({
      loggedOut: workspaceLoggedOutInPageLifetime(),
      pending: workspaceSignOutPending(),
      suppressing: workspaceSignOutSuppressesExpiryRedirect(),
    }).toStrictEqual({
      loggedOut: true,
      pending: true,
      suppressing: true,
    });
  });
});
