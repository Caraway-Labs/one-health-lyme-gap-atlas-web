"use client";

import { usePathname } from "next/navigation";

import { AnalyticsClient } from "@/components/analytics-client";
import { AppShell } from "@/components/app-shell";
import { ChatLauncher } from "@/components/chat-launcher";

export function RouteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDocsRoute = pathname === "/docs" || pathname.startsWith("/docs/");

  if (isDocsRoute) return children;

  return (
    <>
      <AnalyticsClient />
      <AppShell>{children}</AppShell>
      <ChatLauncher />
    </>
  );
}
