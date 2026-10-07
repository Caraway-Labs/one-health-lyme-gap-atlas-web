"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect, useState } from "react";

import {
  installBrowserHistoryHydrationGuard,
  markBrowserHistoryHydrationReady,
} from "@/lib/browser-history-hydration";

installBrowserHistoryHydrationGuard();

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { retry: 2, staleTime: 300_000 } },
      })
  );
  useEffect(() => {
    markBrowserHistoryHydrationReady();
  }, []);
  return (
    <NuqsAdapter>
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    </NuqsAdapter>
  );
}
