import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  FRONT_PORCH_EXPLORE_LABEL,
  FRONT_PORCH_EXPLORE_SUPPORT,
  FRONT_PORCH_FINALE,
  FRONT_PORCH_FOLLOW_STORY_LABEL,
  FRONT_PORCH_GLASS_CALLOUT,
  FRONT_PORCH_HERO_EXAMPLE,
  FRONT_PORCH_HERO_EYEBROW,
  FRONT_PORCH_HERO_HEADLINE,
  FRONT_PORCH_HERO_HEADLINE_LINES,
  FRONT_PORCH_HERO_IMAGE,
  FRONT_PORCH_HERO_SUPPORT,
  FRONT_PORCH_INTRO,
  FRONT_PORCH_STORY_ID,
  FRONT_PORCH_TRUST,
  FRONT_PORCH_TRUST_ID,
  FRONT_PORCH_TRUST_PANEL_LABEL,
  FRONT_PORCH_TRUST_LINES,
  frontPorchExploreHref,
} from "@/features/front-porch/front-porch-copy";
import { FrontPorchScrolly } from "@/features/front-porch/front-porch-scrolly";
import { FrontPorchTrustFooter } from "@/features/front-porch/front-porch-trust-footer";
import { cn } from "@/lib/utils";

type FrontPorchViewProps = {
  heroFontClassName?: string;
  signedIn: boolean;
};

export function FrontPorchView({
  heroFontClassName,
  signedIn,
}: FrontPorchViewProps) {
  const exploreHref = frontPorchExploreHref(signedIn);
  const headerAccountLabel = signedIn ? "Open Atlas Explorer" : "Sign in";

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
              <span aria-hidden="true" className="front-porch-mark">
                <span>✧</span>
              </span>
              One Health Atlas
            </Link>
            <nav aria-label="Primary" className="front-porch-navlinks">
              <a href={`#${FRONT_PORCH_STORY_ID}`}>The evidence</a>
              <a href={`#${FRONT_PORCH_TRUST_ID}`}>Our approach</a>
              <Link href="/docs">Resources</Link>
              <Link className="front-porch-sign-in" href={exploreHref}>
                {headerAccountLabel}
              </Link>
            </nav>
          </header>
          <div className="front-porch-hero-inner">
            <div className="front-porch-hero-copy">
              <div className="front-porch-eyebrow">
                {FRONT_PORCH_HERO_EYEBROW}
              </div>
              <h1
                aria-label={FRONT_PORCH_HERO_HEADLINE}
                id="front-porch-headline"
              >
                {FRONT_PORCH_HERO_HEADLINE_LINES[0]}
                <br className="front-porch-headline-break" />{" "}
                {FRONT_PORCH_HERO_HEADLINE_LINES[1]}
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
              <p className="front-porch-fine">{FRONT_PORCH_HERO_EXAMPLE}</p>
            </div>
            <figure className="front-porch-figure">
              <div className="front-porch-image-frame">
                <Image
                  alt=""
                  height={1229}
                  preload
                  sizes="(max-width: 850px) 300px, 480px"
                  src={FRONT_PORCH_HERO_IMAGE.src}
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
        <section
          aria-labelledby="front-porch-intro"
          className="front-porch-intro"
        >
          <div className="front-porch-intro-inner">
            <div className="front-porch-eyebrow">
              {FRONT_PORCH_INTRO.eyebrow}
            </div>
            <h2 id="front-porch-intro">{FRONT_PORCH_INTRO.title}</h2>
            <p>{FRONT_PORCH_INTRO.paragraph}</p>
          </div>
        </section>
        <div id={FRONT_PORCH_STORY_ID}>
          <FrontPorchScrolly />
        </div>
        <section
          aria-labelledby="front-porch-trust-title"
          className="front-porch-trust"
          id={FRONT_PORCH_TRUST_ID}
        >
          <div className="front-porch-trust-inner">
            <div>
              <div className="front-porch-eyebrow">
                {FRONT_PORCH_TRUST.eyebrow}
              </div>
              <h2 id="front-porch-trust-title">{FRONT_PORCH_TRUST.title}</h2>
              <p>{FRONT_PORCH_TRUST.paragraph}</p>
            </div>
            <div className="front-porch-trust-panel">
              <div className="front-porch-trust-panel-label">
                {FRONT_PORCH_TRUST_PANEL_LABEL}
              </div>
              {FRONT_PORCH_TRUST_LINES.map((line) => (
                <div className="front-porch-trust-line" key={line.label}>
                  <span>{line.label}</span>
                  <strong>{line.detail}</strong>
                </div>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-labelledby="front-porch-finale-title"
          className="front-porch-finale"
        >
          <div className="front-porch-finale-inner">
            <div className="front-porch-eyebrow">
              {FRONT_PORCH_FINALE.eyebrow}
            </div>
            <h2 id="front-porch-finale-title">{FRONT_PORCH_FINALE.title}</h2>
            <p>{FRONT_PORCH_FINALE.paragraph}</p>
            <div className="front-porch-actions">
              <Link
                className={buttonVariants({
                  className: "front-porch-cta front-porch-cta-dark",
                })}
                href={exploreHref}
              >
                {FRONT_PORCH_EXPLORE_LABEL}
                <span aria-hidden="true" className="front-porch-cta-arrow">
                  ↗
                </span>
              </Link>
            </div>
            <p className="front-porch-close-support">
              {FRONT_PORCH_EXPLORE_SUPPORT}
            </p>
          </div>
        </section>
      </main>
      <FrontPorchTrustFooter />
    </div>
  );
}
