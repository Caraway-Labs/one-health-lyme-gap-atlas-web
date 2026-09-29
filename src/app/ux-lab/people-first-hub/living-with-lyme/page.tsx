import type { Metadata } from "next";

import { LivingWithLymePage } from "@/features/ux-lab/people-first-hub/living-with-lyme-page";

export const metadata: Metadata = {
  title: "Living with Lyme",
};

export default function Page() {
  return <LivingWithLymePage />;
}
