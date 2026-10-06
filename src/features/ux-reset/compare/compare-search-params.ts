import { createParser } from "nuqs";

import { parseCompareReturnTarget } from "@/features/ux-reset/compare/compare-entry";
import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";

const compareReturnParser = createParser({
  parse: (value) => parseCompareReturnTarget(value),
  serialize: (value) => value,
});

/**
 * Compare route URL state. The county pair is the shared `compare` key.
 * `return` is page-local and is set only by an explicit Review or Investigate entry.
 */
export const compareSearchParams = {
  ...uxResetSharedContextParsers,
  return: compareReturnParser,
};
