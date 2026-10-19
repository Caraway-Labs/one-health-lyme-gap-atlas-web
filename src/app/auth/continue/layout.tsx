import type { Metadata } from "next";

export const metadata: Metadata = {
  description: "Checking the saved starting view before Atlas Explorer opens.",
  robots: { follow: false, index: false },
  title: "Choose your starting view | One Health Lyme Gap Atlas",
};

export default function StartingViewContinueLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
