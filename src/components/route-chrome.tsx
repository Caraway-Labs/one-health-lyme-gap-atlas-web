"use client";

import { usePathname } from "next/navigation";

import { AnalyticsClient } from "@/components/analytics-client";
import { AppShell } from "@/components/app-shell";
import { ChatLauncher } from "@/components/chat-launcher";
import { FeedbackProvider } from "@/components/feedback-dialog";
import { PublicLayout } from "@/components/public-layout";
import { getRouteShell } from "@/lib/navigation";

export function RouteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shell = getRouteShell(pathname);

  if (shell === "docs" || shell === "none") return children;

  return (
    <FeedbackProvider>
      {shell === "public" ? (
        <PublicLayout>{children}</PublicLayout>
      ) : (
        <>
          <AnalyticsClient />
          <AppShell>{children}</AppShell>
          <ChatLauncher />
        </>
      )}
    </FeedbackProvider>
  );
}
