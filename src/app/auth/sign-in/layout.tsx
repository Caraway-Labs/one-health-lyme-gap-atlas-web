import type { Metadata } from "next";

import { pageMetadataForRoute } from "@/lib/navigation";

export const metadata: Metadata = pageMetadataForRoute("/auth/sign-in");

export default function SignInLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return children;
}
