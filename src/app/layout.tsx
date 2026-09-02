import type { Metadata } from "next";
import { Suspense } from "react";

import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { ChatLauncher } from "@/components/chat-launcher";
import { SiteNav } from "@/components/site-nav";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Providers } from "./providers";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "A population-level hypothesis generator for Lyme surveillance review.",
  metadataBase: new URL("https://carawaylabs.com"),
  title: "One Health Lyme Gap Atlas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <TooltipProvider>
          <Suspense fallback={null}>
            <SiteNav />
          </Suspense>
          <Providers>
            {children}
            <ChatLauncher />
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
