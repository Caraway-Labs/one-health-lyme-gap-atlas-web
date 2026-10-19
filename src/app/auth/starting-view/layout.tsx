import type { Metadata } from "next";

export const metadata: Metadata = {
  description:
    "Choose where Atlas Explorer starts. You can change this later in Settings.",
  robots: { follow: false, index: false },
  title: "Choose your starting view | One Health Lyme Gap Atlas",
};

export default function StartingViewLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
