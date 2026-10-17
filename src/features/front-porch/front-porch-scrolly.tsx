"use client";

import { useEffect, useRef, useState } from "react";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_STAGE_HEADER,
  FRONT_PORCH_STAGE_NOTE,
} from "@/features/front-porch/front-porch-copy";

const STAGE_HEADING =
  "Illustrative data view for the Montgomery County example";
const EVIDENCE_MARKS = ["◌", "⌁", "✳"] as const;
const COUNTY_MARKERS = [
  { cx: 344, cy: 140, halo: 14, point: 5, opacity: 0.22 },
  { cx: 230, cy: 290, halo: 16, point: 6, opacity: 0.18 },
  { cx: 392, cy: 272, halo: 16, point: 5, opacity: 0.2 },
] as const;
// Simplified from the Census county boundary (GEOID 51121) and stored as a static path.
const MONTGOMERY_COUNTY_OUTLINE =
  "M203.1 184.8 L158.8 198.5 L147.9 214.1 L149.5 228.7 L166.5 253.2 L201.2 234.3 L215.0 238.7 L211.0 245.9 L191.8 275.8 L203.0 307.7 L204.5 314.1 L187.5 322.9 L194.0 356.7 L190.0 363.1 L181.3 366.7 L195.8 419.4 L211.3 409.0 L242.8 403.7 L250.8 403.8 L288.8 394.5 L326.7 388.4 L369.4 340.6 L439.8 311.7 L432.2 211.2 L386.2 148.3 L383.8 120.8 L342.0 98.0 L238.9 168.0 L203.2 184.8Z";
const ORIGINAL_ZIGZAG = "M108 218 l89 -24 l68 38 l69 -41 l77 47 l86 -13";
const ORIGINAL_LEFT_LINE = "M139 162 l36 77 l-18 71";
const ORIGINAL_REMAINING_LINES = "M380 155 l-23 101 l63 99";
const ORIGINAL_VERTICAL_LINE = "M240 118 l10 90 l26 195";
const ORIGINAL_LINE_CENTER = { x: 302.5, y: 260.5 } as const;
const COUNTY_LINE_FIT = { x: 301.4, y: 260.3, scale: 0.75 } as const;
const LEFTMOST_LINE_SHIFT = 24;
const NEXT_LINE_SHIFT = 77.3;
const VERTICAL_LINE_SHIFT = 16;
const COUNTY_PLACEMENT = { x: 301.4, y: 260.3, scale: 1.08, lift: 18 } as const;

function CountyLines({ clipId }: { clipId: string }) {
  return (
    <g
      aria-hidden="true"
      clipPath={`url(#${clipId})`}
      transform={`translate(${COUNTY_LINE_FIT.x} ${COUNTY_LINE_FIT.y}) scale(${COUNTY_LINE_FIT.scale}) translate(${-ORIGINAL_LINE_CENTER.x} ${-ORIGINAL_LINE_CENTER.y})`}
    >
      <path
        className="front-porch-county-texture"
        d={ORIGINAL_ZIGZAG}
        transform={`translate(${LEFTMOST_LINE_SHIFT} 0)`}
      />
      <path
        className="front-porch-county-texture"
        d={ORIGINAL_LEFT_LINE}
        transform={`translate(${NEXT_LINE_SHIFT} 0)`}
      />
      <path
        className="front-porch-county-texture"
        d={ORIGINAL_VERTICAL_LINE}
        transform={`translate(${VERTICAL_LINE_SHIFT} 0)`}
      />
      <path
        className="front-porch-county-texture"
        d={ORIGINAL_REMAINING_LINES}
      />
    </g>
  );
}

function MobileSketch({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg aria-hidden="true" viewBox="120 50 350 390">
        <defs>
          <clipPath id="county-sketch-texture-clip">
            <path d={MONTGOMERY_COUNTY_OUTLINE} />
          </clipPath>
        </defs>
        <g
          transform={`translate(0 ${-COUNTY_PLACEMENT.lift}) translate(${COUNTY_PLACEMENT.x} ${COUNTY_PLACEMENT.y}) scale(${COUNTY_PLACEMENT.scale}) translate(${-COUNTY_PLACEMENT.x} ${-COUNTY_PLACEMENT.y})`}
        >
          <path
            className="front-porch-sketch-county"
            d={MONTGOMERY_COUNTY_OUTLINE}
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <CountyLines clipId="county-sketch-texture-clip" />
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
  const [active, setActive] = useState(0);
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
      if (reducedMotion) {
        setActive(FRONT_PORCH_BEATS.length - 1);
        return;
      }

      let nearest = 0;
      let best = Number.POSITIVE_INFINITY;
      for (let index = 0; index < beatRefs.current.length; index += 1) {
        const beat = beatRefs.current[index];
        if (!beat) {
          continue;
        }
        const distance = Math.abs(
          beat.getBoundingClientRect().top - window.innerHeight * 0.28
        );
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      }
      setActive((current) => (current === nearest ? current : nearest));
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

  const activeBeat = FRONT_PORCH_BEATS[active] ?? FRONT_PORCH_BEATS[0];

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
                index === active
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
              <div className="front-porch-mobile-note">
                <strong>{beat.mobileLabel}</strong>
                <MobileSketch step={index} />
                <span>{beat.cardDetail}</span>
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
              <span>Geographic focus · Montgomery County, VA</span>
            </div>
            <div className="front-porch-stage-body">
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
                    <clipPath id="county-texture-clip">
                      <path d={MONTGOMERY_COUNTY_OUTLINE} />
                    </clipPath>
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
                    <CountyLines clipId="county-texture-clip" />
                    {COUNTY_MARKERS.map((marker, index) => (
                      <g
                        className={
                          index <= active
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
                        index <= active
                          ? "front-porch-evidence-card front-porch-evidence-show"
                          : "front-porch-evidence-card"
                      }
                      key={beat.id}
                    >
                      <span
                        aria-hidden="true"
                        className="front-porch-evidence-icon"
                      >
                        {EVIDENCE_MARKS[index]}
                      </span>
                      <span>
                        <strong>{beat.cardTitle}</strong>
                        <span>{beat.cardDetail}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="front-porch-stage-bottom">
              <span>{FRONT_PORCH_STAGE_NOTE}</span>
              <span className="front-porch-stage-status">
                {activeBeat.status}
              </span>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
