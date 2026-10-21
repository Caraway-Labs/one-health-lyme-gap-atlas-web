"use client";

import { useEffect, useRef, useState } from "react";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_DISCLOSURE_LABEL,
  FRONT_PORCH_STAGE_HEADER,
  FRONT_PORCH_STAGE_INTERPRET,
  FRONT_PORCH_STAGE_NOTE,
  type FrontPorchBeat,
} from "@/features/front-porch/front-porch-copy";
import { FrontPorchEvidenceIcon } from "@/features/front-porch/front-porch-icons";
import { MONTGOMERY_COUNTY_OUTLINE } from "@/features/front-porch/montgomery-county-outline.generated";

const STAGE_HEADING =
  "Illustrative data view for the Montgomery County example";
const COUNTY_MARKERS = [
  { cx: 344, cy: 140, halo: 14, point: 5, opacity: 0.22 },
  { cx: 230, cy: 290, halo: 16, point: 6, opacity: 0.18 },
  { cx: 392, cy: 272, halo: 16, point: 5, opacity: 0.2 },
] as const;
const COUNTY_PLACEMENT = { x: 301.4, y: 260.3, scale: 1.08, lift: 18 } as const;
const READING_LINE = 0.28;
/**
 * Panel 01's main paragraph must rise to this share of the viewport before
 * its dot, halo, card, and status appear. Later beats keep READING_LINE.
 */
export const FRONT_PORCH_FIRST_FINDING_LINE = 0.64;

export function frontPorchRevealIndex({
  nearest,
  firstParagraphBottom,
  viewportHeight,
  reducedMotion,
  beatCount = FRONT_PORCH_BEATS.length,
}: {
  nearest: number;
  firstParagraphBottom: number;
  viewportHeight: number;
  reducedMotion: boolean;
  beatCount?: number;
}) {
  if (reducedMotion) {
    return beatCount - 1;
  }
  if (nearest > 0) {
    return nearest;
  }
  return firstParagraphBottom <= viewportHeight * FRONT_PORCH_FIRST_FINDING_LINE
    ? 0
    : -1;
}

function CardLines({ beat }: { beat: FrontPorchBeat }) {
  return beat.cardLines.map((line) => (
    <span
      className={
        line.highlight
          ? "front-porch-card-line front-porch-card-highlight"
          : `front-porch-card-line front-porch-card-${line.tone}`
      }
      key={`${line.tone}-${line.italicLead ?? ""}-${line.text}`}
    >
      {line.italicLead ? <em>{line.italicLead}</em> : null}
      {line.text}
    </span>
  ));
}

function MobileSketch({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg aria-hidden="true" viewBox="120 50 350 390">
        <g
          transform={`translate(0 ${-COUNTY_PLACEMENT.lift}) translate(${COUNTY_PLACEMENT.x} ${COUNTY_PLACEMENT.y}) scale(${COUNTY_PLACEMENT.scale}) translate(${-COUNTY_PLACEMENT.x} ${-COUNTY_PLACEMENT.y})`}
        >
          <path
            className="front-porch-sketch-county"
            d={MONTGOMERY_COUNTY_OUTLINE}
            strokeLinejoin="round"
            strokeWidth="4"
          />
        </g>
      </svg>
    );
  }
  if (step === 1) {
    return (
      <svg aria-hidden="true" viewBox="0 0 300 170">
        <circle className="front-porch-sketch-a" cx="80" cy="75" r="32" />
        <circle className="front-porch-sketch-b" cx="162" cy="50" r="20" />
        <circle className="front-porch-sketch-c" cx="219" cy="112" r="28" />
        <path
          className="front-porch-sketch-link"
          d="M80 75 162 50 219 112"
          strokeDasharray="4 7"
        />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 300 170">
      <circle className="front-porch-sketch-ring-a" cx="92" cy="82" r="55" />
      <circle className="front-porch-sketch-ring-b" cx="158" cy="82" r="55" />
      <circle className="front-porch-sketch-ring-c" cx="125" cy="39" r="55" />
    </svg>
  );
}

export function FrontPorchScrolly() {
  const [reading, setReading] = useState(0);
  const [revealed, setRevealed] = useState(-1);
  const beatRefs = useRef<(HTMLElement | null)[]>([]);
  const progressRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      const scrolling = document.documentElement;
      const max = scrolling.scrollHeight - window.innerHeight;
      if (progressRef.current) {
        const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
        progressRef.current.style.width = `${progress}%`;
      }

      const reducedMotion =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let index = 0; index < beatRefs.current.length; index += 1) {
        const beat = beatRefs.current[index];
        if (!beat) {
          continue;
        }
        const distance = Math.abs(
          beat.getBoundingClientRect().top - window.innerHeight * READING_LINE
        );
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      }
      const firstParagraph = beatRefs.current[0]?.querySelector("p");
      const nextRevealed = frontPorchRevealIndex({
        nearest,
        firstParagraphBottom:
          firstParagraph?.getBoundingClientRect().bottom ??
          Number.POSITIVE_INFINITY,
        viewportHeight: window.innerHeight,
        reducedMotion,
      });
      const nextReading = reducedMotion
        ? FRONT_PORCH_BEATS.length - 1
        : nearest;
      setReading((current) =>
        current === nextReading ? current : nextReading
      );
      setRevealed((current) =>
        current === nextRevealed ? current : nextRevealed
      );
    };

    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const revealedBeat = revealed >= 0 ? FRONT_PORCH_BEATS[revealed] : null;

  return (
    <>
      <div
        aria-hidden="true"
        className="front-porch-progress"
        ref={progressRef}
      />
      <section aria-label="Follow the evidence" className="front-porch-story">
        <div className="front-porch-story-copy">
          {FRONT_PORCH_BEATS.map((beat, index) => (
            <article
              aria-labelledby={`front-porch-${beat.id}`}
              className={
                index === reading
                  ? "front-porch-beat front-porch-beat-active"
                  : "front-porch-beat"
              }
              key={beat.id}
              ref={(element) => {
                beatRefs.current[index] = element;
              }}
            >
              <div className="front-porch-kicker">{beat.kicker}</div>
              <h2 id={`front-porch-${beat.id}`}>{beat.title}</h2>
              <p>{beat.body}</p>
              <p className="front-porch-caveat">{beat.caveat}</p>
              <details className="front-porch-detail">
                <summary>{FRONT_PORCH_DISCLOSURE_LABEL}</summary>
                {beat.sourceDetail.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                <ul>
                  {beat.sourceLinks.map((link) => (
                    <li key={link.href}>
                      <a
                        href={link.href}
                        {...(link.href.startsWith("http")
                          ? { rel: "noopener noreferrer", target: "_blank" }
                          : {})}
                      >
                        {link.label}
                        {link.href.startsWith("http")
                          ? " (opens in a new tab)"
                          : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
              <div className="front-porch-mobile-note">
                <strong>{beat.mobileLabel}</strong>
                <MobileSketch step={index} />
                <CardLines beat={beat} />
              </div>
            </article>
          ))}
        </div>
        <div className="front-porch-stage-wrap">
          <div
            aria-label={STAGE_HEADING}
            className="front-porch-stage"
            role="region"
          >
            <div className="front-porch-stage-top">
              <strong>{FRONT_PORCH_STAGE_HEADER}</strong>
              <span>Geographic focus</span>
            </div>
            <div
              aria-label="County illustration"
              className="front-porch-stage-body"
              role="region"
              // oxlint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- scrollable county panel must be keyboard accessible
              tabIndex={0}
            >
              <div className="front-porch-map-frame">
                <div className="front-porch-stage-label">
                  <b>Montgomery County</b>
                  <small>Virginia · United States</small>
                </div>
                <svg
                  aria-hidden="true"
                  className="front-porch-map"
                  preserveAspectRatio="xMidYMin meet"
                  viewBox="0 0 600 480"
                >
                  <defs>
                    <pattern
                      height="22"
                      id="county-dot-grid"
                      patternUnits="userSpaceOnUse"
                      width="22"
                    >
                      <circle className="front-porch-dot" cx="1" cy="1" r="1" />
                    </pattern>
                  </defs>
                  <rect fill="url(#county-dot-grid)" height="480" width="600" />
                  <g
                    transform={`translate(0 ${-COUNTY_PLACEMENT.lift}) translate(${COUNTY_PLACEMENT.x} ${COUNTY_PLACEMENT.y}) scale(${COUNTY_PLACEMENT.scale}) translate(${-COUNTY_PLACEMENT.x} ${-COUNTY_PLACEMENT.y})`}
                  >
                    <path
                      className="front-porch-county"
                      d={MONTGOMERY_COUNTY_OUTLINE}
                      strokeLinejoin="round"
                      strokeWidth="2.2"
                    />
                    {COUNTY_MARKERS.map((marker, index) => (
                      <g
                        className={
                          index <= revealed
                            ? "front-porch-map-points front-porch-map-points-on"
                            : "front-porch-map-points"
                        }
                        key={marker.cx}
                      >
                        <circle
                          className="front-porch-point-halo"
                          cx={marker.cx}
                          cy={marker.cy}
                          opacity={marker.opacity}
                          r={marker.halo}
                        />
                        <circle
                          className="front-porch-point"
                          cx={marker.cx}
                          cy={marker.cy}
                          r={marker.point}
                        />
                      </g>
                    ))}
                  </g>
                </svg>
                <div className="front-porch-evidence">
                  {FRONT_PORCH_BEATS.map((beat, index) => (
                    <div
                      className={
                        index <= revealed
                          ? "front-porch-evidence-card front-porch-evidence-show"
                          : "front-porch-evidence-card"
                      }
                      key={beat.id}
                    >
                      <span
                        aria-hidden="true"
                        className="front-porch-evidence-icon"
                      >
                        <FrontPorchEvidenceIcon index={index} />
                      </span>
                      <span>
                        <strong>{beat.cardTitle}</strong>
                        <CardLines beat={beat} />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="front-porch-stage-bottom">
              <span>
                <span className="front-porch-marker-note">
                  {FRONT_PORCH_STAGE_NOTE}
                </span>
                <span className="front-porch-interpret-note">
                  {FRONT_PORCH_STAGE_INTERPRET}
                </span>
              </span>
              {revealedBeat ? (
                <span className="front-porch-stage-status">
                  {revealedBeat.status}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
