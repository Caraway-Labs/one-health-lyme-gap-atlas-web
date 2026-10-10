# Web #354 production domain migration

Status: prepared, not deployed. Owner approval is required before merging, changing existing DNS traffic, or promoting the release.

## Verified baseline (2026-10-09)

- App: `48160ff6-ce65-4e60-abab-e097e80daecf`.
- Active deployment: `176f17c2-ea59-4c2e-96fc-85a445d1c448`.
- Source/main: `60aa4902d42919ca7d0d62f7906516384c55aacd`.
- Current hosts: `carawaylabs.com`, `www.carawaylabs.com`, and `one-health-lyme-gap-atlas-web-yqobn.ondigitalocean.app`.
- All six new hosts resolve to Squarespace and return HTTPS 200, not Atlas.
- All three apex domains publish DNSSEC DS records. App Platform does not support DNSSEC-enabled custom domains.
- Source auto-deploy is disabled; production promotion runs on pushes to main or a manual `Quality and deploy` workflow dispatch with `deploy_production=true`, behind the production environment branch policy and latest-main guard (no required reviewer is currently configured). Merging can trigger production deployment; do not merge before prerequisites pass.
- No #354 assignee, issue comments, or competing open implementation PR found.
- Supabase project: `rtyszvluhkvskvgblymu`. No Supabase CLI, connector, or environment management token is available in this session. Dashboard URL configuration and Google provider settings remain unverified.
- Existing API CORS allowlist excludes `https://onehealthatlas.org`.

## Scope and contracts

Retain the existing DigitalOcean/Next.js deployment and Supabase identity model. Update the operations configuration, metadata, sitemap, robots, docs URL, and five defensive host redirects. Retain both legacy hosts and the starter host. The API base URL remains `https://api.carawaylabs.com`. No API models, public health interpretation, UI layout, or accessibility semantics change. Applicable decisions: workspace ADRs 0001, 0004, 0009 and web ADR 0014 optional accounts. #354 supplies the new hostname decision; this does not change hosting topology. Do not publish this candidate until the prerequisites below pass.

## Owner actions, in order

1. Open <https://account.squarespace.com/domains>. For each of `onehealthatlas.org`, `onehealthatlas.com`, `onehealthatlas.ai`, select the domain → **DNS → DNSSEC**. Turn **DNS Security Extensions** off and click **Confirm**. This is a security setting change requiring owner approval. Confirm DS records disappear before domain registration in App Platform. Keep the registrar and nameservers unchanged.
2. Agent resumes: add all six custom hostnames to the verified existing app, retaining the current primary hostname during staging. Use the current live spec, changing domains only, without `--update-sources`. Do not submit the repository template over the live spec: it contains secret placeholders.
3. After owner authorizes DNS traffic changes and the domains are registered: in the same Squarespace dashboard, select each domain → **DNS → DNS Settings**. Save the existing website records for rollback. Replace the four Squarespace apex A records with **Host `@`, Type `A`, Data `162.159.140.98`** and **Host `@`, Type `A`, Data `172.66.0.96`**. Replace the existing `www` CNAME with **Host `www`, Type `CNAME`, Data `one-health-lyme-gap-atlas-web-yqobn.ondigitalocean.app`**. Click **Save** for each record. Preserve mail/TXT/verification records. Confirm the apex resolves to those two addresses and `www` resolves to the starter hostname. If there are conflicting AAAA records, stop for review rather than leaving IPv6 pointing to the old site. Do not use Squarespace URL forwarding; the existing Next.js service handles paths and queries.
4. Open <https://supabase.com/dashboard/project/rtyszvluhkvskvgblymu/auth/url-configuration>. Under **Redirect URLs**, click **Add URL** and add `https://onehealthatlas.org/auth/callback`, `https://onehealthatlas.org/auth/callback?next=*`, `https://onehealthatlas.org/auth/confirm`, and `https://onehealthatlas.org/auth/confirm?next=*`. Click **Save URLs**; retain existing callback entries. Set **Site URL** to `https://onehealthatlas.org` and click **Save** only at approved cutover. Confirm the saved values persist after reload. Check email templates for hardcoded old website URLs; do not alter secrets or provider credentials.
5. The existing API requires an additive CORS allowance for `https://onehealthatlas.org`, retaining current origins. This changes API production configuration and needs separately scoped authorization; do not migrate the API hostname or begin #355. Verify a real API request and OPTIONS response return the new Access-Control-Allow-Origin before cutover.
6. Owner reviews the PR and authorizes merge and production promotion. Run the existing gated workflow for the exact reviewed commit. Confirm managed TLS on all six hosts and the deployed SHA. Preserve legacy hostnames.

## Verification after approved promotion

- Open `https://onehealthatlas.org`, `/docs`, `/geographic_explorer`, and a shared deep link with query parameters on desktop and mobile.
- Open `/docs?migration=354` on each defensive hostname: expect a permanent redirect to the same path/query on `.org`, without a loop.
- Verify `/favicon.svg`, a page's actual `/_next/static/` asset, `/robots.txt`, and `/sitemap.xml`; verify site metadata and docs links use `.org`.
- Verify existing Python API calls in browser Network, without CORS errors.
- Open `/auth/sign-in?next=%2Fprofile`, select Google, complete login, and confirm return to `.org/profile`. Sign out and repeat with the email link. Test the legacy host sign-in as well: the configured public origin changes and old-host PKCE/session cookies must not be assumed portable across hosts.
- Verify old apex and starter homepage remain available. Do not claim actual OAuth success until a human completes this test.

Rollback: retain old DNS records and the active deployment above. Restore the previous website DNS records and approved deployment/configuration if cutover fails. Preserve all existing auth allowlist entries throughout.

References: [DigitalOcean domains](https://docs.digitalocean.com/products/app-platform/how-to/manage-domains/), [ingress IPs](https://docs.digitalocean.com/products/app-platform/how-to/add-ip-address/), [Squarespace DNSSEC](https://support.squarespace.com/hc/en-us/articles/31094668921229-DNSSEC-for-Squarespace-domains), [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls).
