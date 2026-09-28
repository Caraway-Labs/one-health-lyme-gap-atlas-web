import Link from "next/link";
import type { ReactNode } from "react";

import {
  THREE_LANES,
  THREE_LANES_PATH,
  THREE_LANE_IDS,
  threeLanePath,
  type ThreeLaneId,
} from "@/features/ux-lab/three-lanes/content";

export function ThreeLanesFrame({
  children,
  current,
}: {
  children: ReactNode;
  current: ThreeLaneId | "front";
}) {
  return (
    <div className="three-lanes" data-lane={current}>
      <nav aria-label="Atlas lanes" className="three-lanes-nav">
        <div className="three-lanes-nav-inner">
          <Link
            aria-current={current === "front" ? "page" : undefined}
            className="three-lanes-brand"
            href={THREE_LANES_PATH}
          >
            One Atlas
          </Link>
          <ul className="three-lanes-lanes">
            {THREE_LANE_IDS.map((laneId) => (
              <li key={laneId}>
                <Link
                  aria-current={current === laneId ? "page" : undefined}
                  href={threeLanePath(laneId)}
                >
                  {THREE_LANES[laneId].navLabel}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </nav>
      {children}
    </div>
  );
}
