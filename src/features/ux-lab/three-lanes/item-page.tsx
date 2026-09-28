import { ClinicalResourcePage } from "@/features/ux-lab/three-lanes/clinical-lane";
import type { ThreeLaneItem } from "@/features/ux-lab/three-lanes/content";
import { IntelligenceTopicPage } from "@/features/ux-lab/three-lanes/intelligence-lane";
import { LearnArticle } from "@/features/ux-lab/three-lanes/learn-lane";

export function ThreeLanesItemPage({ item }: { item: ThreeLaneItem }) {
  switch (item.kind) {
    case "clinical": {
      return <ClinicalResourcePage resource={item} />;
    }
    case "intelligence": {
      return <IntelligenceTopicPage entry={item} />;
    }
    case "learn": {
      return <LearnArticle topic={item} />;
    }
    default: {
      const exhaustive: never = item;
      return exhaustive;
    }
  }
}
