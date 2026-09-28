import type { ReactNode } from "react";

import { PublicSiteShell } from "@/features/ux-lab/public-site-pro-app/public-site-shell";

export default function PublicSiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <PublicSiteShell>{children}</PublicSiteShell>;
}
