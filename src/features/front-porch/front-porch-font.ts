import localFont from "next/font/local";

export const frontPorchHeroFont = localFont({
  adjustFontFallback: "Arial",
  display: "swap",
  fallback: ["sans-serif"],
  src: "../../fonts/manrope-variable.ttf",
  style: "normal",
  variable: "--font-front-porch-hero",
  weight: "200 800",
});

export const frontPorchBodyFont = localFont({
  display: "swap",
  src: "../../fonts/dm-sans-variable.ttf",
  variable: "--font-front-porch-body",
  weight: "100 1000",
});
