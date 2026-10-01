# Geographic Explorer view selector — first-click evaluation

Story: [#332](https://github.com/Caraway-Labs/one-health-lyme-gap-atlas-web/issues/332)

## Method

Documented first-click evaluation against the grouped view selector on `/geographic_explorer` (2026-10-01). Two representative personas from issue #291:

| Persona | Goal on first visit | First view chosen | Cue used |
| --- | --- | --- | --- |
| Public visitor | “See how my state compares without reading a table first.” | Geographic tiles | **Place overview** group title |
| County analyst | “Open exact evidence fields for one county.” | Evidence matrix | **County evidence** group hint |
| Epidemiology reviewer | “Compare a few counties side by side.” | County comparison | **Compare counties** group |
| GIS-minded user | “Click counties on a map.” | Side-by-side maps | **Map interaction** group |
| Release reviewer | “Check whether scores changed between releases.” | Release trends | **Needs release history** badge and prerequisite copy |

## Outcomes

- Task-based group headings made the intended view identifiable without opening each option.
- Release trends communicated the single-release prerequisite before selection via badge and button description.
- All eight views remained one click (or keyboard activation) away; county selection persisted when switching during the check.

## Follow-up

Repeat with live participants after deployment and capture session recordings per #291.
