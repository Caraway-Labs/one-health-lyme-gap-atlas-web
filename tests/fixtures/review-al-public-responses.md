# WEB #574 public response fixtures

Captured by bounded, unauthenticated read-only HTTP requests on 2026-10-11 (America/Denver). These are recorded production responses, not authenticated production browser acceptance and not a promise that the current release will remain unchanged.

- `review-al-01001.json`, `review-al-01003.json`, `review-al-01005.json`: HTTP 200 county profiles from `https://api.carawaylabs.com/v1/counties/{fips}`.
- `review-al-published-identities.json`: the 67 Alabama identities from the published `/v1/atlas/scores` response, projected to identity fields only. The response contained 3,144 national counties; its `state=AL` query did not reduce the response. Tests and implementation explicitly scope identities.
- All three profiles identify release `governed-2026-10-06-nlcd-demo-cohort`. Baldwin's 2023 floor is 5, tick status Established, population 233,420. Autauga and Barbour have null human counts. All three return pathogen No records.
- A further read from `https://api.onehealthatlas.org/v1/counties/01003` confirmed the same release, human floor/status, tick status, and population.
- Live `/v1/states/AL/review` returned unsupported, 67 assessed counties, zero candidates/eligible/evaluated, and all four review rules disabled.

The browser fixture uses synthetic grid polygons to exercise real MapLibre clicks deterministically. That geometry is not production geography. Raw profile score/color fields are retained only to validate the existing generated response schema; Review's factual preview never displays them.
