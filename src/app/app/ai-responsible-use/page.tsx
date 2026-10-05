import type { Metadata } from "next";

import { AiResponsibleUsePage } from "@/features/ux-reset/ai-responsible-use/ai-responsible-use-page";

export const metadata: Metadata = {
  description:
    "How AI and machine learning contribute to Atlas in the professional workspace, with current, experimental, in-development, and planned capabilities kept distinct.",
  title: "AI / Responsible Use | One Health Lyme Gap Atlas",
};

export default function ResetAiResponsibleUseRoute() {
  return <AiResponsibleUsePage />;
}
