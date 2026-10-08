import localFont from "next/font/local";

export const frontPorchHeroFont = localFont({
  adjustFontFallback: "Arial",
  display: "swap",
  fallback: ["sans-serif"],
  src: "../../fonts/manrope-500-latin.woff2",
  style: "normal",
  variable: "--font-front-porch-hero",
  weight: "500",
});
