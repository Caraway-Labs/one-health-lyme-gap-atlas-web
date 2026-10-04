import { createParser } from "nuqs";

import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";

const reviewLocalParsers = {
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
