import { ClinicalLanePage } from "@/features/ux-lab/three-lanes/clinical-lane";
import type { ThreeLaneId } from "@/features/ux-lab/three-lanes/content";
import { IntelligenceLanePage } from "@/features/ux-lab/three-lanes/intelligence-lane";
import { LearnLanePage } from "@/features/ux-lab/three-lanes/learn-lane";

export function ThreeLanesLanePage({ lane }: { lane: ThreeLaneId }) {
  switch (lane) {
    case "clinical": {
      return <ClinicalLanePage />;
    }
    case "intelligence": {
      return <IntelligenceLanePage />;
    }
    case "learn": {
      return <LearnLanePage />;
    }
    default: {
      const exhaustive: never = lane;
      return exhaustive;
    }
  }
}
