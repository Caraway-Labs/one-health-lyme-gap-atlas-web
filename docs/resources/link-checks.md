# Resources link check

Automated checks for the destinations in `src/lib/resources/catalog.ts`. These notes are not shown on the Resources page.

Curl followed redirects with a browser user agent. A final HTTP 200 at the supplied URL, with no redirect, is recorded as reachable from this client. HTTP 403 is recorded as blocked automated access. It is not treated as a broken link. A TLS failure is recorded separately and is not treated as a missing page.

## Reachable at the supplied URL

56 destinations returned HTTP 200 with no redirect. That includes the Lyme disease surveillance case definition on `ndc.services.cdc.gov`, 45 state destinations, and all nine regional centers.

## Blocked automated access (HTTP 403)

Kept at the supplied URL:

- https://www.cdc.gov/lyme/data-research/facts-stats/surveillance-data-1.html
- https://www.cdc.gov/mmwr/volumes/73/wr/mm7306a1.htm
- https://www.cdc.gov/ticks/resources/TickSurveillance_Iscapularis-P.pdf
- https://www.cdc.gov/ticks/data-research/facts-stats/western-blacklegged-tick-surveillance.html
- https://www.cdc.gov/ticks/data-research/facts-stats/tick-surveillance-data-sets.html
- https://www.cdc.gov/lyme/diagnosis-testing/
- https://www.cdc.gov/lyme/hcp/communication-resources/index.html
- https://www.cdc.gov/ticks/prevention/index.html
- https://www.cdc.gov/lyme/communication-resources/index.html
- https://www.cdc.gov/ticks/communication-resources/index.html
- https://www.atsdr.cdc.gov/place-health/php/svi/svi-frequently-asked-questions-faqs.html
- https://dec.alaska.gov/eh/vet/ticks/submit-a-tick
- https://www.mass.gov/tick-borne-diseases
- https://www.dhhs.nh.gov/programs-services/disease-prevention/infectious-disease-control/tickborne-diseases

A separate fetch retrieved page content for the CDC Lyme surveillance data page, the New Hampshire tickborne diseases page, and the Massachusetts tick-borne diseases page. Alaska's curl result was 403 and a second fetch timed out, so that destination stays unverified. The supplied URL is unchanged.

## TLS failure from this client

`https://www.healthyms.com/msdhsite/_static/14%2C0%2C119.html` failed curl with `SEC_E_CERT_EXPIRED`. A separate fetch returned the Mississippi State Department of Health Entomology and Vector Control Program page at that URL. The supplied URL is unchanged.

No supplied URL was replaced. None of the 200 responses redirected.
