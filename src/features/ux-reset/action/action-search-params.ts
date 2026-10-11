import { createMultiParser } from "nuqs";

/**
 * Action reads `plan` only. It is page-local and is not part of the shared
 * handoff. An empty or blank value is no plan.
 */
const actionPlanParser = createMultiParser({
  parse: (values) =>
    values.map((value) => value.trim()).filter((value) => value.length > 0),
  serialize: (value) => value,
}).withDefault([]);

export const actionSearchParams = {
  plan: actionPlanParser,
};
