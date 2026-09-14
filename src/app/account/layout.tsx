import type { Metadata } from "next";

import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata: Metadata = pageMetadataForRoute("/account");

export default function AccountLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
