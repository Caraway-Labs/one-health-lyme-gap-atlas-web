import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  THREE_LANE_IDS,
  threeLaneItem,
  threeLaneItems,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesItemPage } from "@/features/ux-lab/three-lanes/item-page";

type ThreeLanesItemRouteProps = {
  params: Promise<{ item: string; lane: string }>;
};

export function generateStaticParams() {
  return THREE_LANE_IDS.flatMap((lane) =>
    threeLaneItems(lane).map((item) => ({
      item: item.id,
      lane,
    }))
  );
}

export async function generateMetadata({
  params,
}: ThreeLanesItemRouteProps): Promise<Metadata> {
  const { item: itemId, lane } = await params;
  const item = threeLaneItem(lane, itemId);
  if (!item) {
    return { title: "One Atlas / Three Lanes" };
  }
  return {
    description: item.kind === "learn" ? item.lede : item.summary,
    robots: { follow: false, index: false },
    title: item.title,
  };
}

export default async function Page({ params }: ThreeLanesItemRouteProps) {
  const { item: itemId, lane } = await params;
  const item = threeLaneItem(lane, itemId);
  if (!item) {
    notFound();
  }
  return <ThreeLanesItemPage item={item} />;
}
