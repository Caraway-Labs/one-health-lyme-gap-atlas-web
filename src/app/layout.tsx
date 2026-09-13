import type { Metadata } from "next";

import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { RouteChrome } from "@/components/route-chrome";
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
          <Providers>
            <RouteChrome>{children}</RouteChrome>
          </Providers>
        </TooltipProvider>
      </body>
    </html>
  );
}
