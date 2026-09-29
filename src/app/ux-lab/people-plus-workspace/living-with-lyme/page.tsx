import type { Metadata } from "next";
import Link from "next/link";

import { AtlasDataStamp } from "@/components/atlas-data-stamp";
import { buttonVariants } from "@/components/ui/button";
import { PEOPLE_LIVING_CONCERNS } from "@/features/ux-lab/people-plus-workspace/content";
import {
  PEOPLE_CLINICIANS_PATH,
  PEOPLE_LOCAL_PATH,
} from "@/features/ux-lab/people-plus-workspace/paths";

export const metadata: Metadata = {
  title: "Living with Lyme",
};

const relatedLinkClassName = buttonVariants({ variant: "outline" });

export default function LivingWithLymePage() {
  return (
    <>
      <header>
        <p className="eyebrow">Lived experience</p>
        <h1 className="type-page">Living with Lyme and ongoing concerns</h1>
        <p className="type-body people-plus-lead">
          This representative page is for people already affected by Lyme
          disease. It foregrounds understandable language, trusted-resource
          patterns, and clear boundaries—not surveillance dashboards or clinical
          care instructions.
        </p>
        <AtlasDataStamp label="Sample trusted-resource cue">
          Governed partner links and FAQs would appear here with review dates.
          This prototype uses static sample text only.
        </AtlasDataStamp>
      </header>

      <section aria-labelledby="living-concerns">
        <h2 className="type-section" id="living-concerns">
          Common questions this path could answer
        </h2>
        <div className="people-plus-topic-list">
          {PEOPLE_LIVING_CONCERNS.map((concern) => (
            <article key={concern.heading} className="people-plus-boundary">
              <h3 className="type-card">{concern.heading}</h3>
              <p className="type-body">{concern.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section aria-labelledby="living-related">
        <h2 className="type-section" id="living-related">
          Related paths in this environment
        </h2>
        <div className="people-plus-path-grid">
          <Link className={relatedLinkClassName} href={PEOPLE_LOCAL_PATH}>
            Sample local context
          </Link>
          <Link className={relatedLinkClassName} href={PEOPLE_CLINICIANS_PATH}>
            Clinician resource listings
          </Link>
        </div>
      </section>
    </>
  );
}
