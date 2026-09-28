import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  PERSONA_AUDIENCES,
  personaAudiencePath,
} from "@/features/ux-lab/persona-gateway/content";
import { UX_LAB_AUDIENCES } from "@/features/ux-lab/prototype-contract";

export function PersonaGatewayPage() {
  return (
    <main className="persona-gateway">
      <header className="persona-gateway-hero">
        <div className="persona-gateway-hero-inner">
          <p className="eyebrow light">One Health Lyme Gap Atlas</p>
          <h1 className="type-page">Which audience experience do you need?</h1>
          <p className="type-body">
            Atlas serves families, healthcare professionals, and public health
            teams. Those jobs differ, so this front door asks you to choose an
            audience before anything else. You can switch later from inside the
            lane you pick.
          </p>
        </div>
      </header>

      <section
        aria-labelledby="persona-gateway-choices"
        className="persona-gateway-body"
      >
        <h2 className="type-section" id="persona-gateway-choices">
          Choose an audience
        </h2>
        <ul className="persona-entry-list">
          {UX_LAB_AUDIENCES.map((audience) => {
            const definition = PERSONA_AUDIENCES[audience];
            const titleId = `persona-${audience}-title`;
            return (
              <li key={audience}>
                <Card className="persona-entry-card">
                  <CardHeader>
                    <Badge variant="secondary">{definition.kicker}</Badge>
                    <h3 className="type-card" id={titleId}>
                      <Link
                        className="persona-entry-link"
                        href={personaAudiencePath(audience)}
                      >
                        {definition.title}
                      </Link>
                    </h3>
                    <CardDescription>{definition.cardSummary}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="type-small">{definition.boundary}</p>
                  </CardContent>
                  <CardFooter>
                    <span
                      className={buttonVariants({
                        className:
                          "pointer-events-none h-[var(--control-height)] px-4",
                      })}
                    >
                      Enter {definition.title}
                    </span>
                  </CardFooter>
                </Card>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
