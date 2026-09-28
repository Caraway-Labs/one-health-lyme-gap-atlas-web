import Link from "next/link";

import {
  THREE_LANES,
  type ThreeLaneCrossLink,
  type ThreeLaneId,
} from "@/features/ux-lab/three-lanes/content";

export function SharedLaneLinks({
  current,
  links,
}: {
  current: ThreeLaneId;
  links: readonly ThreeLaneCrossLink[];
}) {
  const crossLaneLinks = links.filter((link) => link.lane !== current);
  if (crossLaneLinks.length === 0) {
    return null;
  }

  return (
    <nav
      aria-label="Same material in other Atlas lanes"
      className="three-lanes-shared"
    >
      <h2 className="type-card">Also in Atlas</h2>
      <p className="type-small">
        This material is shared. Each lane presents it for a different task.
      </p>
      <ul>
        {crossLaneLinks.map((link) => (
          <li key={link.href}>
            <Link className="three-lanes-text-link" href={link.href}>
              {THREE_LANES[link.lane].navLabel}: {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
