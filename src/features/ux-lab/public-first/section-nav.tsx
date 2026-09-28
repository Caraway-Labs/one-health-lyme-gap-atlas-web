import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  publicFirstHref,
  type PublicFirstPlaceId,
  type PublicFirstSection,
} from "@/features/ux-lab/public-first/content";

const SECTIONS = [
  { id: "snapshot", label: "Local snapshot" },
  { id: "clinical", label: "Clinical Resources" },
  { id: "surveillance", label: "Public Health & Surveillance" },
] as const satisfies readonly {
  id: PublicFirstSection;
  label: string;
}[];

const linkClassName = buttonVariants({
  className: "public-first-nav-link",
  variant: "outline",
});

export function PublicFirstSectionNav({
  placeId,
  section,
}: {
  placeId: PublicFirstPlaceId;
  section: PublicFirstSection;
}) {
  return (
    <nav aria-label="Public-first sections" className="public-first-nav">
      {SECTIONS.map((item) => (
        <Link
          aria-current={item.id === section ? "page" : undefined}
          className={linkClassName}
          href={publicFirstHref(placeId, item.id)}
          key={item.id}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
