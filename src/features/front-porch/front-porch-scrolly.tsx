"use client";

import { useEffect, useRef, useState } from "react";

import {
  FRONT_PORCH_BEATS,
  FRONT_PORCH_STAGE_HEADER,
  FRONT_PORCH_STAGE_NOTE,
} from "@/features/front-porch/front-porch-copy";

const STAGE_HEADING = "Illustrative data view for the Buncombe County example";
const EVIDENCE_MARKS = ["◌", "⌁", "✳"] as const;

function MobileSketch({ step }: { step: number }) {
  if (step === 0) {
    return (
      <svg aria-hidden="true" viewBox="0 0 300 170">
        <path
          className="front-porch-sketch-county"
          d="M38 45 85 25 121 39 145 18 189 33 224 55 260 43 275 84 253 122 198 148 155 137 104 154 66 116 22 98Z"
          strokeWidth="2"
        />
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
              <span>Geographic focus · Buncombe County, NC</span>
            </div>
            <div className="front-porch-stage-body">
              <div className="front-porch-stage-label">
                <b>Buncombe County</b>
                <small>North Carolina · United States</small>
              </div>
              <svg
                aria-hidden="true"
                className="front-porch-map"
                preserveAspectRatio="xMidYMid meet"
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
                <path
                  className="front-porch-county"
                  d="M45 185 99 160 132 126 178 143 213 98 258 126 300 119 339 156 388 145 433 179 485 169 525 204 514 261 545 297 505 342 453 359 419 404 367 387 322 422 279 402 239 363 194 359 156 315 107 316 77 266 43 237Z"
                  strokeWidth="2.2"
                />
                <path
                  className="front-porch-county-lines"
                  d="m108 218 89-24 68 38 69-41 77 47 86-13M139 162l36 77-18 71m83-192 10 90 26 195m104-248-23 101 63 99"
                  strokeWidth="1.4"
                />
                <g
                  className={
                    active >= 1
                      ? "front-porch-map-points front-porch-map-points-on"
                      : "front-porch-map-points"
                  }
                >
                  <circle
                    className="front-porch-point-halo"
                    cx="193"
                    cy="240"
                    opacity="0.22"
                    r="18"
                  />
                  <circle
                    className="front-porch-point"
                    cx="193"
                    cy="240"
                    r="5"
                  />
                  <circle
                    className="front-porch-point-halo"
                    cx="360"
                    cy="240"
                    opacity="0.18"
                    r="24"
                  />
                  <circle
                    className="front-porch-point"
                    cx="360"
                    cy="240"
                    r="6"
                  />
                  <circle
                    className="front-porch-point-halo"
                    cx="280"
                    cy="339"
                    opacity="0.2"
                    r="14"
                  />
                  <circle
                    className="front-porch-point"
                    cx="280"
                    cy="339"
                    r="5"
                  />
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
