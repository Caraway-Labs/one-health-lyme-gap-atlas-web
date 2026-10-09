# Approved Front Porch reference — Web #483

`approved-hero.html` and `one_health_nature_portal.png` are unchanged owner-supplied review fixtures. They are outside the public directory and are never served by production. The PNG matches the production artwork SHA-256 `4025b63ba21fb82174eec77f9e1aa2dd192275692c515cf26c8674ba9178c326`.

HTML SHA-256: `05af7d77145fd21894c999c6ce6af40327f3cffcd25dcaf0d66db46900d08332`.

The HTML is the visual authority; Web #475 is the later copy authority. No new architecture, API, authentication, scientific claims, or full-scrolly decision is introduced. Existing qualitative scenes 2–6 remain interim pending #476. Applicable decisions: workspace ADRs 0001–0003 and web ADR 0014 optional accounts; DESIGN_SYSTEM.md permits editorial domain CSS and shared Button variants.

| Prototype | React / scoped CSS |
| --- | --- |
| `.hero` | FrontPorchView section / `.front-porch-hero` |
| `.nav`, `.brand`, `.navlinks`, `.sign` | Header, brand Link, primary nav, session Link / `.front-porch-bar`, `.front-porch-brand`, `.front-porch-navlinks`, `.front-porch-sign-in` |
| `.inner`, `.copy`, `.eyebrow`, `h1` | Hero grid, copy, eyebrow, accessible heading / `.front-porch-hero-inner`, `.front-porch-hero-copy`, `.front-porch-eyebrow`, `#front-porch-headline` |
| `.copy p`, `.cta`, `.fine` | Approved support, shared buttonVariants anchor, Lyme introduction / `.front-porch-support`, `.front-porch-cta`, `.front-porch-fine` |
| `.art`, `.art img`, `.mini` | Figure, Next Image, figcaption / `.front-porch-figure`, `.front-porch-image-frame img`, `.front-porch-callout` |
| `.scroll` | Working story anchor / `.front-porch-scroll` |
| `.below` | First semantic story beat / `.front-porch-beat:first-child` |

Navigation destinations are the story anchor, published methodology, `/docs`, and the unchanged session-aware auth/Review helper.

## Deterministic visual verification

Run `$env:ATLAS_VISUAL_PRODUCTION="1"; npx playwright test tests/e2e/front-porch-visual.spec.ts` in PowerShell (or `ATLAS_VISUAL_PRODUCTION=1 npx playwright test tests/e2e/front-porch-visual.spec.ts` on Linux). This builds and starts the production application. The ordinary development E2E run excludes this file; CI runs it as a separate required quality step. Captures assert no `nextjs-portal`, no browser runtime exceptions, and bundled DM Sans glyph rendering using Chromium's font inspection. Approved-reference attachments are collected before stored-snapshot assertions.

Canonical refreshed baselines were captured on Playwright 1.62.1 Chromium in `mcr.microsoft.com/playwright:v1.62.1-noble` (digest `sha256:dcc5531e97840b9b5e794f2814476b21571c5124a3fca2267d73041f56e7580e`). Only the 390px hero, 320px hero and 320px first-transition snapshots were refreshed. The original HTML and artwork hashes above remain unchanged.

`tests/e2e/front-porch-visual.spec.ts` renders both actual HTML and React at 1440×900, 1280×800, 390×844 and 320×700. Fonts are local licensed Manrope and DM Sans, loaded before capture. Motion is reduced, screenshot animations disabled, and no content is masked. The original HTML is attached untouched; a separately labeled comparison replaces only later-approved paragraph/CTA, qualifies the Lyme example by removing the provisional county, and removes the decorative sign-in arrow. Runtime copy is never taken from the old prototype.

Direct reference comparisons allow at most 2% mismatched pixels, counting pixels whose largest RGB channel delta exceeds 51 (20% of 255). This channel tolerance accommodates edge antialiasing; geometry assertions independently check sizes. No threshold increase is authorized. Stored hero and first-transition snapshots also use Playwright's 2% mismatch cap. Snapshot updates do not bypass direct reference comparisons. CI retains attachments, differences and traces.

Expected differences: finalized shorter support copy and CTA; no provisional Buncombe assertion; functional nav; decorative artwork has empty alt because adjacent text explains domains; accessible heading and focus behavior; compact 320px header to prevent clipping. Scenes 1–6 preserve current approved qualitative copy rather than the prototype's old first-scene text. Product-owner visual approval remains required before merge or deployment.
