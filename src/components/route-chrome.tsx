"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { AnalyticsClient } from "@/components/analytics-client";
import { AppShell } from "@/components/app-shell";
import { ChatLauncher } from "@/components/chat-launcher";
import { FeedbackProvider } from "@/components/feedback-dialog";
import { PublicLayout } from "@/components/public-layout";
import { getRouteShell, routeMountsAnalyticsClient } from "@/lib/navigation";

export function RouteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const shell = getRouteShell(pathname);
  let content: ReactNode;

  if (shell === "docs" || shell === "none") {
    content = children;
  } else if (
    pathname === "/auth/sign-in" ||
    pathname === "/auth/starting-view" ||
    pathname === "/auth/continue"
  ) {
    // Sign-in and starting-view setup are full-page entrances. Analytics can
    // start here without the workspace sidebar or chat launcher.
    content = <FeedbackProvider>{children}</FeedbackProvider>;
  } else {
    content = (
      <FeedbackProvider>
        {shell === "public" ? (
          <PublicLayout>{children}</PublicLayout>
        ) : (
          <>
            <AppShell>{children}</AppShell>
            <ChatLauncher />
          </>
        )}
      </FeedbackProvider>
    );
  }

  return (
    <>
      {routeMountsAnalyticsClient(pathname) ? <AnalyticsClient /> : null}
      {content}
    </>
  );
}
