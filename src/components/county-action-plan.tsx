import type { CountyDetail } from "@/generated/models";
import { followUpPlanFor } from "@/lib/atlas-ui";

const PROGRAM_RESOURCES = [
  {
    href: "https://www.dhs.wisconsin.gov/tick/lyme-reporting-surveillance.htm",
    label: "Wisconsin: reporting and investigation protocol",
  },
  {
    href: "https://www.health.state.mn.us/diseases/tickborne/monitoring.html",
    label: "Minnesota: tick monitoring program",
  },
  {
    href: "https://www.cdph.ca.gov/Programs/CID/DCDC/Pages/LymeDisease.aspx",
    label: "California: surveillance and outreach resources",
  },
  {
    href: "https://www.health.ny.gov/diseases/communicable/lyme/",
    label: "New York: tick collection and surveillance",
  },
];

export function CountyActionPlan({ detail }: { detail: CountyDetail }) {
  const plan = followUpPlanFor(detail);

  return (
    <section className="action-plan" aria-labelledby="county-action-heading">
      <div className="action-plan-heading">
        <div>
          <span className="eyebrow">Suggested follow-up</span>
          <h4 id="county-action-heading">{plan.level}</h4>
        </div>
        <span className="action-timeframe">{plan.timeframe}</span>
      </div>
      <p className="action-summary">{plan.summary}</p>
      <p className="action-caution">
        <strong>What this means:</strong> This is a review recommendation, not a
        measure of individual risk or proof that Lyme disease is undercounted.
      </p>
      <ol className="action-list">
        {plan.actions.map((action) => (
          <li key={`${action.owner}-${action.task}`}>
            <strong>{action.owner}</strong>
            <span>{action.task}</span>
          </li>
        ))}
      </ol>
      <details className="action-resources">
        <summary>Official program examples and resources</summary>
        <p>
          These examples show approaches used by other state vector-borne
          disease programs. Follow the selected county&apos;s own state
          requirements.
        </p>
        <ul>
          {PROGRAM_RESOURCES.map((resource) => (
            <li key={resource.href}>
              <a href={resource.href} target="_blank" rel="noreferrer">
                {resource.label}
                <span aria-hidden="true"> ↗</span>
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
