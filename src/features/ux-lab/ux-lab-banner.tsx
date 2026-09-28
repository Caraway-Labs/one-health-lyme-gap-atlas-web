import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  UX_LAB_BANNER_LABEL,
  UX_LAB_PATH,
} from "@/features/ux-lab/prototype-contract";

const bannerLinkClassName = buttonVariants({
  className: "h-[var(--control-height)] bg-background px-4",
  size: "sm",
  variant: "outline",
});

export function UxLabBanner() {
  return (
    <div aria-label="Prototype status" className="ux-lab-banner" role="region">
      <p>
        <strong>{UX_LAB_BANNER_LABEL}</strong>
      </p>
      <nav aria-label="Prototype shortcuts" className="ux-lab-banner-links">
        <Link className={bannerLinkClassName} href={UX_LAB_PATH}>
          UX Lab index
        </Link>
        <Link className={bannerLinkClassName} href="/">
          Production Atlas
        </Link>
      </nav>
    </div>
  );
}
