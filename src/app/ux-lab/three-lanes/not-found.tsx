import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { THREE_LANES_PATH } from "@/features/ux-lab/three-lanes/content";
import { ThreeLanesFrame } from "@/features/ux-lab/three-lanes/lane-nav";

export default function ThreeLanesNotFound() {
  return (
    <ThreeLanesFrame current="front">
      <main className="three-lanes-main">
        <h1 className="type-page">
          This page is not in the three-lanes prototype
        </h1>
        <p className="type-body">
          One Atlas keeps three lanes: Learn, Clinical Resources, and Public
          Health & Intelligence.
        </p>
        <Link
          className={buttonVariants({
            className: "h-[var(--control-height)] w-fit px-4",
          })}
          href={THREE_LANES_PATH}
        >
          Back to One Atlas
        </Link>
      </main>
    </ThreeLanesFrame>
  );
}
