import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  PublicTrustActions,
  PublicTrustIntro,
  PublicTrustPage,
} from "@/features/public-trust/public-trust-page";

import "@/features/ux-reset/trust-footer.css";
import { ABOUT_CARAWAY_LABS_PATH } from "@/features/ux-reset/routes";
import { pageMetadataForRoute } from "@/lib/navigation";

const APPROACH_PRINCIPLES = [
  {
    body: "Show sources, observation periods and limitations so users can understand what supports an interpretation.",
    title: "Evidence before certainty.",
  },
  {
    body: "One Health means examining relationships among human health, vectors, animals and the environment without assuming causation from correlation.",
    title: "Connected perspectives.",
  },
  {
    body: "Build tools to help researchers and public-health teams investigate and prioritize questions, not replace expert judgment.",
    title: "Practical decision support.",
  },
] as const;

export const metadata: Metadata = {
  ...pageMetadataForRoute(ABOUT_CARAWAY_LABS_PATH),
  alternates: { canonical: ABOUT_CARAWAY_LABS_PATH },
};

export default function AboutCarawayLabsPage() {
  return (
    <PublicTrustPage>
      <PublicTrustIntro title="About Caraway Labs">
        <p className="public-trust-lede">
          <strong>Building practical tools for better decisions.</strong>
        </p>
        <p>
          Caraway Labs develops software experiences that help people work with
          complex information and make more informed decisions.
        </p>
      </PublicTrustIntro>

      <section
        aria-labelledby="about-one-health-atlas"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="about-one-health-atlas">One Health Atlas</h2>
          <p>
            One Health Atlas is a Caraway Labs project focused on helping
            public-health professionals investigate vector-borne disease
            evidence, starting with Lyme disease.
          </p>
          <p>
            The Atlas brings different evidence systems into a common workflow:
            human surveillance, vectors and pathogens, environmental conditions,
            and community context. Its aim is to make it easier to explore what
            the available data shows, where important gaps remain, and what
            deserves closer investigation.
          </p>
        </div>
      </section>

      <section
        aria-labelledby="about-approach"
        className="public-trust-section"
      >
        <div className="public-trust-prose">
          <h2 id="about-approach">How we approach the work</h2>
        </div>
        <ul className="public-trust-cards public-trust-cards--trio">
          {APPROACH_PRINCIPLES.map((principle) => (
            <li key={principle.title}>
              <Card className="overflow-visible">
                <CardHeader>
                  <h3>{principle.title}</h3>
                </CardHeader>
                <CardContent>
                  <p>{principle.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <p className="public-trust-callout">
        One Health Atlas is an independent Caraway Labs project. It is not an
        official public-health agency service, and its information is not
        medical advice.
      </p>

      <PublicTrustActions>
        <Link className="public-trust-return" href="/">
          Return to One Health Atlas
        </Link>
        <Link className="public-trust-return" href="/privacy">
          Privacy
        </Link>
      </PublicTrustActions>
    </PublicTrustPage>
  );
}
