import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  PERSONA_AUDIENCES,
  PERSONA_GATEWAY_PATH,
  personaAudiencePath,
} from "@/features/ux-lab/persona-gateway/content";
import {
  UX_LAB_AUDIENCES,
  type UxLabAudience,
} from "@/features/ux-lab/prototype-contract";
import { cn } from "@/lib/utils";

const switcherLinkClassName =
  "h-[var(--control-height)] px-4 whitespace-normal";

export function AudienceSwitcher({ current }: { current: UxLabAudience }) {
  return (
    <div className="persona-switcher-bar">
      <nav aria-label="Switch audience" className="persona-switcher">
        {UX_LAB_AUDIENCES.map((audience) => {
          const definition = PERSONA_AUDIENCES[audience];
          const selected = audience === current;
          return (
            <Link
              aria-current={selected ? "true" : undefined}
              className={cn(
                buttonVariants({
                  className: switcherLinkClassName,
                  variant: selected ? "default" : "outline",
                })
              )}
              href={personaAudiencePath(audience)}
              key={audience}
            >
              {definition.title}
              {selected ? (
                <span className="sr-only">, selected audience</span>
              ) : null}
            </Link>
          );
        })}
      </nav>
      <Link className="persona-gateway-return" href={PERSONA_GATEWAY_PATH}>
        All audiences
      </Link>
    </div>
  );
}
