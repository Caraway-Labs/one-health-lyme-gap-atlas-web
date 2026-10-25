import type { CountyDetail } from "@/generated/models";
import { SUGGESTED_FOLLOW_UP_BY_COLOR } from "@/lib/atlas-ui";
import {
  type CountyFollowUpWorkflow,
  stateUnallocatedContext,
} from "@/lib/follow-up-workflows";

export type ExplorerFollowUpRow = {
  explanation: string;
  heading: string;
  id: string;
  whoCanHelp: string;
};

export function explorerFollowUpAccent(color: string): string | null {
  const normalized = color.trim().toLowerCase();
  if (Object.hasOwn(SUGGESTED_FOLLOW_UP_BY_COLOR, normalized)) {
    return normalized;
  }
  return null;
}

/** Explorer rows use the same category actions as the workflow. */
export function explorerFollowUpRows(
  workflow: CountyFollowUpWorkflow,
  county: CountyDetail
): ExplorerFollowUpRow[] {
  const unallocated = stateUnallocatedContext(county);
  return workflow.rows.map((row, index) => {
    const base = [row.action, row.detail].filter(Boolean).join(" ");
    const explanation =
      index === 0 && unallocated && !base.includes(unallocated)
        ? `${base} ${unallocated}`
        : base;
    return {
      explanation,
      heading: row.label,
      id: row.id,
      whoCanHelp: row.partners,
    };
  });
}
