import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  THREE_LANE_IDS,
  threeLaneById,
} from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesLanePage } from "@/features/ux-lab/three-lanes/lane-page";

type ThreeLanesLaneRouteProps = {
  params: Promise<{ lane: string }>;
};

export function generateStaticParams() {
  return THREE_LANE_IDS.map((lane) => ({ lane }));
}

export async function generateMetadata({
  params,
}: ThreeLanesLaneRouteProps): Promise<Metadata> {
  const lane = threeLaneById((await params).lane);
  if (!lane) {
    return { title: "One Atlas / Three Lanes" };
  }
  return {
    description: lane.summary,
    robots: { follow: false, index: false },
    title: lane.navLabel,
  };
}

export default async function Page({ params }: ThreeLanesLaneRouteProps) {
  const lane = threeLaneById((await params).lane);
  if (!lane) {
    notFound();
  }
  return <ThreeLanesLanePage lane={lane.id} />;
}
