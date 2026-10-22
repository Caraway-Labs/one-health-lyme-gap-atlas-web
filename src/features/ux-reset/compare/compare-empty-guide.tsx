import { ArrowLeftRight, ChartColumn, Search } from "lucide-react";

const STEPS = [
  {
    description: "Search by county, state, or FIPS.",
    icon: Search,
    id: "first",
    title: "Choose County A",
  },
  {
    description: "You choose it. Atlas never picks one for you.",
    icon: ArrowLeftRight,
    id: "second",
    title: "Choose County B",
  },
  {
    description: "Evidence, gaps, and limits appear side by side.",
    icon: ChartColumn,
    id: "read",
    title: "Read the comparison",
  },
] as const;

/**
 * Empty-state guide. A fixed three-step orientation, not a tutorial or tour.
 */
export function CompareEmptyGuide() {
  return (
    <ol
      aria-label="How to compare two counties"
      className="ux-reset-compare-steps"
      data-testid="compare-empty-guide"
    >
      {STEPS.map((step, index) => {
        const Icon = step.icon;
        return (
          <li key={step.id}>
            <span aria-hidden="true" className="ux-reset-compare-step-icon">
              <Icon />
            </span>
            <span className="ux-reset-compare-step-text">
              <strong>
                {index + 1}. {step.title}
              </strong>
              <span>{step.description}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
