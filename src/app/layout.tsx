import type { Metadata } from "next";
import { Inter } from "next/font/google";

import "maplibre-gl/dist/maplibre-gl.css";
import "./globals.css";
import { RouteChrome } from "@/components/route-chrome";
import { TooltipProvider } from "@/components/ui/tooltip";

import { Providers } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description:
    "A population-level hypothesis generator for Lyme surveillance review.",
  metadataBase: new URL("https://onehealthatlas.org"),
  icons: {
    icon: [
      {
        url: "/favicon.ico?v=summit-compass-north-20261010",
        sizes: "16x16 32x32 48x48",
        type: "image/x-icon",
      },
      {
        url: "/favicon-16x16.png?v=summit-compass-north-20261010",
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: "/favicon-32x32.png?v=summit-compass-north-20261010",
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: "/favicon-48x48.png?v=summit-compass-north-20261010",
        sizes: "48x48",
        type: "image/png",
      },
    ],
    apple: [
      {
        url: "/apple-touch-icon.png?v=summit-compass-north-20261010",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
  title: "One Health Lyme Gap Atlas",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html className={inter.variable} lang="en" data-scroll-behavior="smooth">
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
