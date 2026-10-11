import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
    <main className="about-caraway">
      <header className="about-caraway-header">
        <h1 className="type-page">About Caraway Labs</h1>
        <p className="about-caraway-lede">
          <strong>Building practical tools for better decisions.</strong>
        </p>
        <p>
          Caraway Labs develops software experiences that help people work with
          complex information and make more informed decisions.
        </p>
      </header>

      <section
        aria-labelledby="about-one-health-atlas"
        className="about-caraway-section"
      >
        <h2 id="about-one-health-atlas">One Health Atlas</h2>
        <p>
          One Health Atlas is a Caraway Labs project focused on helping
          public-health professionals investigate vector-borne disease evidence,
          starting with Lyme disease.
        </p>
        <p>
          The Atlas brings different evidence systems into a common workflow:
          human surveillance, vectors and pathogens, environmental conditions,
          and community context. Its aim is to make it easier to explore what
          the available data shows, where important gaps remain, and what
          deserves closer investigation.
        </p>
      </section>

      <section
        aria-labelledby="about-approach"
        className="about-caraway-approach"
      >
        <div className="about-caraway-section">
          <h2 id="about-approach">How we approach the work</h2>
        </div>
        <ul className="about-caraway-principles">
          {APPROACH_PRINCIPLES.map((principle) => (
            <li key={principle.title}>
              <Card>
                <CardHeader>
                  <h3 className="type-card">{principle.title}</h3>
                </CardHeader>
                <CardContent>
                  <p className="type-body">{principle.body}</p>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <p className="about-caraway-disclosure">
        One Health Atlas is an independent Caraway Labs project. It is not an
        official public-health agency service, and its information is not
        medical advice.
      </p>

      <p className="about-caraway-actions">
        <Link className="about-caraway-return" href="/">
          Return to One Health Atlas
        </Link>
        <Link className="about-caraway-return" href="/privacy">
          Privacy
        </Link>
      </p>
    </main>
  );
}
