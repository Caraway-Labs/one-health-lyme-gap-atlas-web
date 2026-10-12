"use client";

import { QueryClientContext, type QueryClient } from "@tanstack/react-query";
import { DoorOpen, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
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
import {
  clearAccountSessionCache,
  endLocalAtlasSession,
} from "@/features/ux-reset/profile/end-local-session";
import { useProfileSessionIdentity } from "@/features/ux-reset/profile/profile-session";
import { useMobileViewport } from "@/features/ux-reset/use-mobile-viewport";
import { followWorkspaceHref } from "@/features/ux-reset/workspace-navigation";
import {
  readWorkspaceSession,
  workspaceSessionDecision,
  type WorkspaceSessionNavigation,
} from "@/features/ux-reset/workspace-session-gate";
import {
  abortWorkspaceSignOut,
  beginWorkspaceSignOut,
  completeWorkspaceSignOut,
  noteWorkspaceDocumentUser,
  workspaceDocumentUserId,
  workspaceLoggedOutInPageLifetime,
  workspaceSignOutSuppressesExpiryRedirect,
} from "@/features/ux-reset/workspace-sign-out";
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

async function denyWorkspacePage(input: {
  cancelled: () => boolean;
  navigation: WorkspaceSessionNavigation;
  path: string;
  queryClient: QueryClient | null;
}): Promise<void> {
  const pathname = input.path.split("?")[0] ?? input.path;
  if (!isProfessionalAppPath(pathname)) {
    return;
  }
  const snapshot = await readWorkspaceSession();
  if (input.cancelled()) {
    return;
  }
  const decision = workspaceSessionDecision({
    documentUserId: workspaceDocumentUserId(),
    loggedOutInPageLifetime: workspaceLoggedOutInPageLifetime(),
    navigation: input.navigation,
    read: snapshot.read,
    sessionUserId: snapshot.userId,
  });
  switch (decision) {
    case "keep": {
      return;
    }
    case "reload": {
      clearAccountSessionCache(input.queryClient);
      followWorkspaceHref(input.path, "replace");
      return;
    }
    case "sign-in": {
      clearAccountSessionCache(input.queryClient);
      followWorkspaceHref(signInHrefForReturnPath(input.path), "replace");
      return;
    }
    default: {
      const exhaustive: never = decision;
      throw new Error(
        `Unsupported workspace session decision: ${String(exhaustive)}`
      );
    }
  }
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
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);
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

  useEffect(() => {
    if (identity?.kind !== "user") {
      return;
    }
    const decision = workspaceSessionDecision({
      documentUserId: workspaceDocumentUserId(),
      loggedOutInPageLifetime: workspaceLoggedOutInPageLifetime(),
      navigation: "fresh",
      read: "present",
      sessionUserId: identity.userId,
    });
    switch (decision) {
      case "keep": {
        noteWorkspaceDocumentUser(identity.userId);
        break;
      }
      case "reload": {
        clearAccountSessionCache(queryClient);
        followWorkspaceHref(returnPath, "replace");
        break;
      }
      case "sign-in": {
        break;
      }
      default: {
        const exhaustive: never = decision;
        throw new Error(
          `Unsupported workspace session decision: ${String(exhaustive)}`
        );
      }
    }
  }, [identity, queryClient, returnPath]);

  useEffect(() => {
    if (
      identity?.kind !== "signed-out" ||
      workspaceSignOutSuppressesExpiryRedirect()
    ) {
      return;
    }
    let cancelled = false;
    const denyFreshSignedOutPage = async () => {
      await denyWorkspacePage({
        cancelled: () => cancelled,
        navigation: "fresh",
        path: returnPath,
        queryClient,
      });
    };
    void denyFreshSignedOutPage();
    return () => {
      cancelled = true;
    };
  }, [identity, queryClient, returnPath]);

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }
      void denyWorkspacePage({
        cancelled: () => false,
        navigation: "bfcache",
        path: browserReturnPath(),
        queryClient,
      });
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [queryClient]);

  async function signOut() {
    if (pendingRef.current) {
      return;
    }
    pendingRef.current = true;
    beginWorkspaceSignOut();
    setPending(true);
    setNotice(null);
    const result = await endLocalAtlasSession(queryClient);
    if (!result.ok) {
      abortWorkspaceSignOut();
      pendingRef.current = false;
      setPending(false);
      setNotice(result.notice);
      return;
    }
    completeWorkspaceSignOut();
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
