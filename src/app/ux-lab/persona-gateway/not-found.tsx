import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { PERSONA_GATEWAY_PATH } from "@/features/ux-lab/persona-gateway/content";

export default function PersonaGatewayNotFound() {
  return (
    <main className="persona-gateway">
      <div className="persona-gateway-body">
        <h1 className="type-page">
          This audience page is not in the prototype
        </h1>
        <p className="type-body">
          Persona Gateway only includes the public, healthcare professional, and
          public health professional lanes.
        </p>
        <Link
          className={buttonVariants({
            className: "h-[var(--control-height)] w-fit px-4",
          })}
          href={PERSONA_GATEWAY_PATH}
        >
          Back to Persona Gateway
        </Link>
      </div>
    </main>
  );
}
