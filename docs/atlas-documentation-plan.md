# Atlas documentation plan

This plan is the launch contract for the `/docs` help center. It keeps the initial surface small while preserving clear ownership as the Atlas grows.

## Audience hierarchy

1. Epidemiologists and public-health surveillance users are the primary audience and set the bar for plain language, evidence interpretation, and reproducible workflows.
2. Researchers and the general public need a shorter explanation of purpose, limitations, and how to read the evidence without assuming epidemiology expertise.
3. Developers and API consumers need machine-readable contract links and examples that preserve provenance, versioning, missingness, pagination, and error semantics.
4. Agent/MCP integrators need owning-service connection, tool, resource, and compatibility guidance when a supported public MCP contract exists.

## Information architecture

The planned page tree is organized into these families:

```text
Getting started
  What Atlas is
  Quick start
  Understanding the interface
Using Atlas
  Atlas Explorer
  Comparing geographies
  County and state intelligence
  Saving, sharing, and exporting
Understanding the data
  Indicators and measures
  Missingness, suppression, and uncertainty
  Human, vector/pathogen, environmental, and population context
AI and evidence
  Ask Atlas
  Evidence library
  AI ethics and limitations
Methods and trust
  Provenance and freshness
  Methodology
  Privacy
  Accessibility
Developers
  Public REST API
  MCP server
  Schemas, examples, and citation
Support
  FAQ
  Troubleshooting
  Feedback and release notes
```

The launch priority is one page, `Start with Atlas`, covering purpose, quick start, data interpretation, missingness, provenance, trust links, and the developer-contract boundary. Additional pages are added when the related product behavior or owning contract is stable enough to document.

## Page patterns

- Tutorial: a goal-oriented sequence with a clear starting state and outcome.
- Concept: plain-language explanation with links to the relevant Atlas view.
- Reference: stable definitions or contract links; the owning system remains authoritative.
- Method: source, method/version, freshness, uncertainty, and limitations.
- Troubleshooting: symptom, safe checks, recovery, and support path.
- Release note: released changes only, linked to the originating work.
- Developer guide: copyable examples plus a link to the machine-readable contract; never a second schema catalog.

## Ownership and boundaries

| Content family | Authoritative owner/source | Docs responsibility |
| --- | --- | --- |
| Product workflows and UI behavior | Atlas Web repository and released UI | Explain current behavior; mark planned and experimental work explicitly. |
| Indicator, measure, observation, and geography definitions | Atlas semantic/API/data contracts | Link or generate from the contract; do not hand-maintain conflicting definitions. |
| Provenance, freshness, and limitations | API/data release metadata and approved web methodology surfaces | Explain how to interpret the fields and link back to the in-app context. |
| Methodology | Approved Atlas methodology and web/data owners | Describe the released method/version without adding unsupported claims. |
| Privacy | Approved web privacy contract and policy | Link to the approved `/privacy` surface; no new retention or identity promises. |
| AI ethics and limitations | `src/lib/ai-ethics-content.ts` and `/ai-ethics` | Link to the approved page; do not duplicate unresolved policy commitments. |
| REST API/OpenAPI | Atlas API repository | Link to the live OpenAPI artifact and generated references when the API story releases them. |
| MCP tools/resources/compatibility | Owning MCP/API contracts and tests | Publish only supported guidance; do not infer capability from internal prototypes. |
| Release notes | Web repository release workflow and linked service releases | Summarize material released changes and link to the source change. |

The Atlas application keeps contextual **About this data**, data-dictionary, provenance, and methodology information beside results. The docs site adds orientation and deeper explanation; core Atlas workflows never require the docs site to load.

## Language and search contract

Use **current** or **released** only for behavior available in production. Use **planned** for approved future work and **experimental** for prototypes that are not a public commitment. Never describe a planned alert, account, API, MCP, or AI capability as available.

Initial search vocabulary includes: Atlas Explorer, county, geography, state, surveillance, Lyme disease, tick, pathogen, evidence, measure, indicator, observation, provenance, source, vintage, freshness, missing data, suppressed, unavailable, uncertainty, methodology, OpenAPI, REST, MCP, AI Ethics, privacy, and accessibility. Common synonyms such as “case data,” “reporting,” “vector,” “agent,” and “developer integration” should be added to page metadata or search configuration as the corresponding pages are published.
