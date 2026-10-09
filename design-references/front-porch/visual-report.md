# Web #483 visual fidelity report

Candidate based on `origin/main` at `f09fa3db368d16ff9e7f0dab4e89cfebb82e69a0`. All work is isolated on `codex/web-483-front-porch-fidelity`. Production remains unchanged pending explicit product-owner review.

## Visual comparison

[Open the five-panel visual review package](review/index.html). Original prototype, current production baseline, candidate, reference with finalized copy, and highlighted difference are available at each requested viewport. Stored regression snapshots also cover the first chapter transition.

| Viewport   | Direct hero pixel mismatch | Limit |
| ---------- | -------------------------- | ----- |
| 1440 × 900 | 0.468%                     | 2%    |
| 1280 × 800 | 0.515%                     | 2%    |
| 390 × 844  | 0.429%                     | 2%    |
| 320 × 700  | 1.591%                     | 2%    |

Method and reference-to-React mapping are in [README.md](README.md). Fonts load locally, motion is reduced, no elements are masked, and direct live-reference comparisons cannot be waived through snapshot updates. Raw approved screenshots retain the prototype's older copy; normalized comparison uses #475 wording and removes the provisional county assertion.

Remaining differences: shorter approved supporting copy; exact Follow the story CTA; Lyme-only fine line; working navigation links and session-aware account label; no decorative sign-in arrow; at 320px a smaller brand, tighter header and panel padding prevent the prototype's clipping. The original PNG is unchanged; Next.js optimized image rounding and antialiasing account for small artwork differences. First scene retains current qualitative paragraphs, rather than older prototype text. Scenes 2–6 remain interim under #476.

## Verification and independent review

- `npm ci`: passed; no reported vulnerabilities.
- `npm run generate:api` and generated-contract diff: passed, no payload/model changes.
- Docs, typecheck, lint, design-system and UX Reset guards: passed.
- Production Next.js build and Docker build: passed.
- Desktop Playwright: 9/9 passed, including direct comparisons, stored hero/transition snapshots, axe, keyboard story CTA, asset checksum/transparency, published footer links, signed-out account-free exit, and fixture-based Review navigation without county preselection.
- Mobile Playwright: 9/9 passed against the stored snapshots without updating them, including the same reference, accessibility and routing checks.
- Signed-in header label geometry checked at 320, 390, 768, 800, 801, 850, 851, 1024 and 1440px. This label simulation is layout evidence; signed-in Review behavior is separately fixture-based. Real provider login was not performed.
- Full Windows unit run: 1015/1025 passed; nine unrelated workspace async/timing failures and one existing `spawnSync("npx", shell:false)` Windows CLI failure. Isolated rerun: 114/118 passed; another focused run: 70/73 passed, with three remaining Review async assertions. All Front Porch unit tests passed. The unchanged workspace tests and implementation are outside this visual correction. Direct Node shadcn CLI invocation passed; hosted Linux checks remain authoritative for its CLI test.
- Independent separate-agent review identified two visual-test gaps (direct reference comparison and first-transition coverage); both resolved. Final source and desktop/mobile/320 screenshot review found no actionable findings and recommends product-owner visual review.

No merge, deployment, domain change, scientific-content expansion or story closure is authorized by this report. Explicit product-owner visual approval is required by the implementation brief and #483 before merge/deploy.
