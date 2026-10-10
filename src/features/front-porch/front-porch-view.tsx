import Image from "next/image";
import Link from "next/link";

import { PrivacyPreferences } from "@/components/privacy-preferences";
import { buttonVariants } from "@/components/ui/button";
import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_EVIDENCE_HREF,
  FRONT_PORCH_EXPLORE_LABEL,
  FRONT_PORCH_EXPLORE_SUPPORT,
  FRONT_PORCH_FOLLOW_STORY_LABEL,
  FRONT_PORCH_FOOTER_LINKS,
  FRONT_PORCH_GLASS_CALLOUT,
  FRONT_PORCH_HERO_HEADLINE,
  FRONT_PORCH_HERO_IMAGE,
  FRONT_PORCH_HERO_SUPPORT,
  FRONT_PORCH_METHODOLOGY_HREF,
  FRONT_PORCH_STORY_ID,
  frontPorchExploreHref,
} from "@/features/front-porch/front-porch-copy";
import { cn } from "@/lib/utils";

const SOURCES_BEAT_ID = "sources-limits";
const ATLAS_BEAT_ID = "atlas";

type FrontPorchViewProps = {
  heroFontClassName?: string;
  signedIn: boolean;
};

export function FrontPorchView({
  heroFontClassName,
  signedIn,
}: FrontPorchViewProps) {
  const exploreHref = frontPorchExploreHref(signedIn);
  const headerAccountLabel = signedIn ? "Open Review" : "Sign in";

  return (
    <div className={cn("front-porch", heroFontClassName)}>
      <a className="front-porch-skip" href={`#${FRONT_PORCH_STORY_ID}`}>
        Skip to the story
      </a>
      <main>
        <section
          aria-labelledby="front-porch-headline"
          className="front-porch-hero"
        >
          <header className="front-porch-bar">
            <Link className="front-porch-brand" href="/">
              <span aria-hidden="true">✧</span>One Health Atlas
            </Link>
            <nav aria-label="Primary" className="front-porch-navlinks">
              <a href={`#${FRONT_PORCH_STORY_ID}`}>The evidence</a>
              <Link href={FRONT_PORCH_METHODOLOGY_HREF}>Our approach</Link>
              <Link href="/docs">Resources</Link>
              <Link className="front-porch-sign-in" href={exploreHref}>
                {headerAccountLabel}
              </Link>
            </nav>
          </header>
          <div className="front-porch-hero-inner">
            <div className="front-porch-hero-copy">
              <div className="front-porch-eyebrow">
                One county. Many signals. A clearer picture.
              </div>
              <h1
                id="front-porch-headline"
                aria-label={FRONT_PORCH_HERO_HEADLINE}
              >
                The data is telling
                <br className="front-porch-headline-break" /> more than one
                story.
              </h1>
              <p className="front-porch-support">{FRONT_PORCH_HERO_SUPPORT}</p>
              <div className="front-porch-actions">
                <a
                  className={buttonVariants({
                    className: "front-porch-cta hero-cta-primary",
                  })}
                  href={`#${FRONT_PORCH_STORY_ID}`}
                >
                  {FRONT_PORCH_FOLLOW_STORY_LABEL}
                </a>
              </div>
              <p className="front-porch-fine">
                Our opening example: Lyme disease.
              </p>
            </div>
            <figure className="front-porch-figure">
              <div className="front-porch-image-frame">
                <Image
                  alt=""
                  height={1229}
                  src={FRONT_PORCH_HERO_IMAGE.src}
                  preload
                  sizes="(max-width: 850px) 300px, 510px"
                  width={1280}
                />
              </div>
              <figcaption className="front-porch-callout">
                {FRONT_PORCH_GLASS_CALLOUT.replaceAll(
                  " + ",
                  " \u00A0 + \u00A0 "
                )}
              </figcaption>
            </figure>
          </div>
          <a className="front-porch-scroll" href={`#${FRONT_PORCH_STORY_ID}`}>
            Scroll to explore <span aria-hidden="true">↓</span>
          </a>
        </section>
        <div className="front-porch-story" id={FRONT_PORCH_STORY_ID}>
          {FRONT_PORCH_BEATS.map((beat) => (
            <section
              aria-labelledby={`front-porch-${beat.id}`}
              className={
                beat.id === ATLAS_BEAT_ID
                  ? "front-porch-beat front-porch-close"
                  : "front-porch-beat"
              }
              key={beat.id}
            >
              <h2 id={`front-porch-${beat.id}`}>{beat.title}</h2>
              {beat.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {beat.id === SOURCES_BEAT_ID ? (
                <p>
                  <Link href={FRONT_PORCH_METHODOLOGY_HREF}>Methodology</Link>
                  {" · "}
                  <Link href={FRONT_PORCH_EVIDENCE_HREF}>
                    Evidence and uncertainty
                  </Link>
                </p>
              ) : null}
              {beat.id === ATLAS_BEAT_ID ? (
                <>
                  <div className="front-porch-actions">
                    <Link
                      className={buttonVariants({
                        className: "front-porch-cta hero-cta-primary",
                      })}
                      href={exploreHref}
                    >
                      {FRONT_PORCH_EXPLORE_LABEL}
                    </Link>
                  </div>
                  <p className="front-porch-close-support">
                    {FRONT_PORCH_EXPLORE_SUPPORT}
                  </p>
                </>
              ) : null}
            </section>
          ))}
        </div>
      </main>
      <footer className="front-porch-footer">
        <p>One Health Atlas</p>
        <nav aria-label="Footer">
          {FRONT_PORCH_FOOTER_LINKS.map((item) => (
            <Link href={item.href} key={item.href}>
              {item.label}
            </Link>
          ))}
          <PrivacyPreferences />
        </nav>
      </footer>
    </div>
  );
}
