import { createParser } from "nuqs";

import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";
import {
  parseExplorerCountyMode,
  parseExplorerCountySelection,
} from "@/features/ux-reset/review/explorer-mode";

const reviewLocalParsers = {
  mode: createParser({
    parse: (value) => parseExplorerCountyMode(value),
    serialize: (value) => value,
  }),
  page: createParser({
    parse: (value) => value,
    serialize: String,
  }),
  selection: createParser({
    parse: (value) => parseExplorerCountySelection(value),
    serialize: (value) => value,
  }),
  sort: createParser({
    parse: (value) => value,
    serialize: String,
  }),
};

/** Review route URL state: shared reset context plus page-local keys. */
export const reviewSearchParams = {
  ...uxResetSharedContextParsers,
  ...reviewLocalParsers,
};
