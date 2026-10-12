import { createParser } from "nuqs";

import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";
import { parseExplorerCountyMode } from "@/features/ux-reset/review/explorer-mode";

const reviewLocalParsers = {
  mode: createParser({
    parse: (value) => parseExplorerCountyMode(value),
    serialize: (value) => value,
  }),
  page: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  sort: createParser({
    parse: (value) => value,
    serialize: String,
  }),
};

/** Review route URL state: shared reset context plus page-local sort/page. */
export const reviewSearchParams = {
  ...uxResetSharedContextParsers,
  ...reviewLocalParsers,
};
