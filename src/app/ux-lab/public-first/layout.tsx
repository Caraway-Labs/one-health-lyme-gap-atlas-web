import type { ReactNode } from "react";

import "@/features/ux-lab/public-first/public-first.css";

export default function PublicFirstLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
