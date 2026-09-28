import type { Metadata } from "next";
import type { ReactNode } from "react";

import "@/features/ux-lab/persona-gateway/persona-gateway.css";

export const metadata: Metadata = {
  robots: { follow: false, index: false },
  title: "Persona Gateway",
};

export default function PersonaGatewayLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
