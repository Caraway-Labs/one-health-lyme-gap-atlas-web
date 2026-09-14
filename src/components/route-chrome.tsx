"use client";

import { usePathname } from "next/navigation";

import { AnalyticsClient } from "@/components/analytics-client";
import { AppShell } from "@/components/app-shell";
import { ChatLauncher } from "@/components/chat-launcher";
import { PublicLayout } from "@/components/public-layout";
import { getRouteShell } from "@/lib/navigation";

export function RouteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const shell = getRouteShell(pathname);

  if (shell === "docs" || shell === "none") return children;
  if (shell === "public") return <PublicLayout>{children}</PublicLayout>;

  return (
    <>
      <AnalyticsClient />
      <AppShell>{children}</AppShell>
      <ChatLauncher />
    </>
  );
}
