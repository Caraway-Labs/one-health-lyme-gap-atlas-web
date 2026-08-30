import type { Metadata } from "next";
import { Suspense } from "react";
import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { Providers } from "./providers";
import { SiteNav } from "@/components/site-nav";
import { ChatLauncher } from "@/components/chat-launcher";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "One Health Lyme Gap Atlas",
  description: "A population-level hypothesis generator for Lyme surveillance review.",
  metadataBase: new URL("https://carawaylabs.com"),
  alternates: { canonical: "/" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en" data-scroll-behavior="smooth"><body><TooltipProvider><Suspense fallback={null}><SiteNav /></Suspense><Providers>{children}<ChatLauncher /></Providers></TooltipProvider></body></html>;
}
