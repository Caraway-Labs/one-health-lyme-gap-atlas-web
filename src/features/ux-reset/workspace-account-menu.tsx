"use client";

import { QueryClientContext, type QueryClient } from "@tanstack/react-query";
import { DoorOpen, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  useContext,
  useEffect,
  useLayoutEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { ReactElement, ReactNode } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { explicitAccountLabel } from "@/features/ux-reset/account-display-label";
import { clearAccountSessionCache } from "@/features/ux-reset/profile/end-local-session";
import { useProfileSessionIdentity } from "@/features/ux-reset/profile/profile-session";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";
import { followWorkspaceHref } from "@/features/ux-reset/workspace-navigation";
import {
  readWorkspaceSession,
  workspaceShellAction,
  type WorkspaceSessionNavigation,
  type WorkspaceShellAction,
} from "@/features/ux-reset/workspace-session-gate";
import {
  beginWorkspaceShellCheck,
  concealRestoredWorkspace,
  invalidateWorkspaceShellCheck,
  noteWorkspaceDocumentUser,
  revealRestoredWorkspace,
  subscribeWorkspaceSignOut,
  workspaceDocumentUserId,
  workspaceLoggedOutInPageLifetime,
  workspaceRestoreConcealed,
  runWorkspaceSignOut,
  workspaceShellCheckCurrent,
  workspaceSignOutPending,
  workspaceSignOutSuppressesExpiryRedirect,
} from "@/features/ux-reset/workspace-sign-out";
import { analyticsControlAttributes } from "@/lib/atlas-analytics";
import { isProfessionalAppPath } from "@/lib/auth/app-route-guard";
import { signInHrefForReturnPath } from "@/lib/auth/sign-in-href";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const ACCOUNT_LABEL = "Account";
const CHECKING_LABEL = "Checking session";
const SIGN_IN_LABEL = "Sign in";
const SIGN_OUT_LABEL = "Sign out";
const SIGNING_OUT_LABEL = "Signing out";

function workspaceReturnPath(pathname: string, search: string): string {
  if (!search) {
    return pathname;
  }
  return `${pathname}?${search}`;
}

function browserReturnPath(): string {
  return workspaceReturnPath(
    window.location.pathname,
    window.location.search.replace(/^\?/, "")
  );
}

function professionalPath(path: string): boolean {
  const pathname = path.split("?")[0] ?? path;
  return isProfessionalAppPath(pathname);
}

function protectedLeaveConceals(input: {
  concealed: boolean;
  documentUserId: string | null;
  navigation: WorkspaceSessionNavigation;
}): boolean {
  return (
    input.concealed ||
    input.documentUserId !== null ||
    input.navigation === "bfcache"
  );
}

function leaveHref(action: "reload" | "sign-in", path: string): string {
  switch (action) {
    case "reload": {
      return path;
    }
    case "sign-in": {
      return signInHrefForReturnPath(path);
    }
    default: {
      const exhaustive: never = action;
      throw new Error(`Unsupported protected leave: ${String(exhaustive)}`);
    }
  }
}

/** Conceals first, then replaces the document. A later read cannot reveal it. */
function leaveProtectedWorkspace(input: {
  conceal: boolean;
  href: string;
  queryClient: QueryClient | null;
}): void {
  if (input.conceal) {
    concealRestoredWorkspace();
  }
  beginWorkspaceShellCheck();
  clearAccountSessionCache(input.queryClient);
  followWorkspaceHref(input.href, "replace");
}

function applyProtectedShellAction(input: {
  action: WorkspaceShellAction;
  concealed: boolean;
  documentUserId: string | null;
  navigation: WorkspaceSessionNavigation;
  path: string;
  queryClient: QueryClient | null;
}): void {
  switch (input.action) {
    case "reveal": {
      revealRestoredWorkspace();
      break;
    }
    case "hold": {
      break;
    }
    case "reload":
    case "sign-in": {
      leaveProtectedWorkspace({
        conceal: protectedLeaveConceals({
          concealed: input.concealed,
          documentUserId: input.documentUserId,
          navigation: input.navigation,
        }),
        href: leaveHref(input.action, input.path),
        queryClient: input.queryClient,
      });
      return;
    }
    default: {
      const exhaustive: never = input.action;
      throw new Error(`Unsupported shell action: ${String(exhaustive)}`);
    }
  }
}

async function settleProtectedWorkspace(input: {
  generation: number;
  navigation: WorkspaceSessionNavigation;
  path: string;
  queryClient: QueryClient | null;
}): Promise<void> {
  if (!professionalPath(input.path)) {
    return;
  }
  const snapshot = await readWorkspaceSession();
  if (!workspaceShellCheckCurrent(input.generation)) {
    return;
  }
  const documentUserId = workspaceDocumentUserId();
  const concealed = workspaceRestoreConcealed();
  applyProtectedShellAction({
    action: workspaceShellAction({
      concealed,
      documentUserId,
      loggedOutInPageLifetime: workspaceLoggedOutInPageLifetime(),
      navigation: input.navigation,
      read: snapshot.read,
      sessionUserId: snapshot.userId,
    }),
    concealed,
    documentUserId,
    navigation: input.navigation,
    path: input.path,
    queryClient: input.queryClient,
  });
}

function WithAccountTooltip({
  children,
  label,
  showTooltip,
}: {
  children: ReactElement;
  label: string;
  showTooltip: boolean;
}) {
  if (!showTooltip) {
    return children;
  }
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

function AccountStatus({ label }: { label: string }) {
  return (
    <div
      aria-label={label}
      className="ux-reset-account-trigger"
      data-testid="workspace-account-status"
      role="status"
    >
      <UserRound aria-hidden="true" />
      <span className="sidebar-item-label">{label}</span>
    </div>
  );
}

export function WorkspaceAccountMenu() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const identity = useProfileSessionIdentity();
  const queryClient = useContext(QueryClientContext) ?? null;
  const { open, setMobileOpen } = useSidebar();
  const isMobileViewport = useMobileViewport();
  const [loadedLabel, setLoadedLabel] = useState<{
    label: string | null;
    userId: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const pending = useSyncExternalStore(
    subscribeWorkspaceSignOut,
    workspaceSignOutPending,
    () => false
  );
  const signOutSuppressesExpiryRedirect = useSyncExternalStore(
    subscribeWorkspaceSignOut,
    workspaceSignOutSuppressesExpiryRedirect,
    () => false
  );
  const showTooltip = !(open || isMobileViewport);
  const returnPath = workspaceReturnPath(pathname, searchParams.toString());
  const signInHref = signInHrefForReturnPath(returnPath);
  const label =
    identity?.kind === "user" && loadedLabel?.userId === identity.userId
      ? loadedLabel.label
      : null;

  useEffect(() => {
    if (identity?.kind !== "user") {
      return;
    }
    const userId = identity.userId;
    let cancelled = false;
    const loadLabel = async () => {
      try {
        const { data } = await createClient().auth.getSession();
        if (cancelled) {
          return;
        }
        setLoadedLabel({
          label: explicitAccountLabel(data.session?.user),
          userId,
        });
      } catch {
        if (!cancelled) {
          setLoadedLabel({ label: null, userId });
        }
      }
    };
    void loadLabel();
    return () => {
      cancelled = true;
    };
  }, [identity]);

  useLayoutEffect(() => {
    if (identity?.kind !== "user") {
      return;
    }
    const documentUserId = workspaceDocumentUserId();
    const concealed = workspaceRestoreConcealed();
    const action = workspaceShellAction({
      concealed,
      documentUserId,
      loggedOutInPageLifetime: workspaceLoggedOutInPageLifetime(),
      navigation: "fresh",
      read: "present",
      sessionUserId: identity.userId,
    });
    switch (action) {
      case "reload": {
        leaveProtectedWorkspace({
          conceal: protectedLeaveConceals({
            concealed,
            documentUserId,
            navigation: "fresh",
          }),
          href: returnPath,
          queryClient,
        });
        return;
      }
      case "reveal":
      case "hold":
      case "sign-in": {
        if (documentUserId === null && !concealed) {
          noteWorkspaceDocumentUser(identity.userId);
        }
        return;
      }
      default: {
        const exhaustive: never = action;
        throw new Error(`Unsupported shell action: ${String(exhaustive)}`);
      }
    }
  }, [identity, queryClient, returnPath]);

  useLayoutEffect(() => {
    if (identity?.kind !== "signed-out" || signOutSuppressesExpiryRedirect) {
      return;
    }
    const generation = beginWorkspaceShellCheck();
    if (workspaceDocumentUserId() !== null && professionalPath(returnPath)) {
      concealRestoredWorkspace();
    }
    void settleProtectedWorkspace({
      generation,
      navigation: "fresh",
      path: returnPath,
      queryClient,
    });
    return () => {
      invalidateWorkspaceShellCheck(generation);
    };
  }, [identity, queryClient, returnPath, signOutSuppressesExpiryRedirect]);

  useEffect(() => {
    const concealIfProfessional = (path: string) => {
      if (!professionalPath(path)) {
        return false;
      }
      concealRestoredWorkspace();
      return true;
    };
    let pageshowGeneration = 0;
    const onPageHide = (event: PageTransitionEvent) => {
      if (!event.persisted || !concealIfProfessional(browserReturnPath())) {
        return;
      }
      beginWorkspaceShellCheck();
    };
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }
      const path = browserReturnPath();
      if (!concealIfProfessional(path)) {
        return;
      }
      pageshowGeneration = beginWorkspaceShellCheck();
      void settleProtectedWorkspace({
        generation: pageshowGeneration,
        navigation: "bfcache",
        path,
        queryClient,
      });
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
      invalidateWorkspaceShellCheck(pageshowGeneration);
    };
  }, [queryClient]);

  async function signOut() {
    const result = await runWorkspaceSignOut(queryClient);
    if (result === null) {
      return;
    }
    if (!result.ok) {
      setNotice(result.notice);
      return;
    }
    setNotice(null);
    followWorkspaceHref("/");
  }

  let control: ReactNode;
  if (identity === null) {
    control = <AccountStatus label={CHECKING_LABEL} />;
  } else if (
    identity.kind === "signed-out" ||
    identity.kind === "unconfigured"
  ) {
    control = (
      <WithAccountTooltip label={SIGN_IN_LABEL} showTooltip={showTooltip}>
        <Link
          {...analyticsControlAttributes("workspace_sign_in")}
          aria-label={SIGN_IN_LABEL}
          className={cn(
            buttonVariants({ variant: "ghost" }),
            "ux-reset-account-trigger"
          )}
          href={signInHref}
          onClick={() => {
            setMobileOpen(false);
          }}
        >
          <UserRound aria-hidden="true" />
          <span className="sidebar-item-label">{SIGN_IN_LABEL}</span>
        </Link>
      </WithAccountTooltip>
    );
  } else if (identity.kind === "user") {
    const visibleLabel = pending ? SIGNING_OUT_LABEL : (label ?? ACCOUNT_LABEL);
    control = (
      <DropdownMenu>
        <WithAccountTooltip label={visibleLabel} showTooltip={showTooltip}>
          <DropdownMenuTrigger
            render={
              <Button
                aria-busy={pending || undefined}
                aria-label={visibleLabel}
                className="ux-reset-account-trigger"
                disabled={pending}
                type="button"
                variant="ghost"
              />
            }
          >
            <UserRound aria-hidden="true" />
            <span className="sidebar-item-label">{visibleLabel}</span>
          </DropdownMenuTrigger>
        </WithAccountTooltip>
        <DropdownMenuContent
          align="start"
          className="ux-reset-account-menu"
          side="top"
        >
          <DropdownMenuItem
            {...analyticsControlAttributes("workspace_sign_out")}
            disabled={pending}
            onClick={() => {
              void signOut();
            }}
          >
            <DoorOpen aria-hidden="true" />
            {pending ? SIGNING_OUT_LABEL : SIGN_OUT_LABEL}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  } else {
    const exhaustive: never = identity;
    control = exhaustive;
  }

  return (
    <div data-testid="workspace-account-menu">
      {control}
      {notice ? (
        <p
          className={cn(
            "type-small ux-reset-account-notice",
            showTooltip && "sr-only"
          )}
          data-testid="workspace-sign-out-notice"
          role="status"
        >
          {notice}
        </p>
      ) : null}
    </div>
  );
}
