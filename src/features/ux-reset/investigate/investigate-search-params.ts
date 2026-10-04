import { uxResetSharedContextParsers } from "@/features/ux-reset/context-params";

/** Investigate route URL state. Page-local keys are not read or copied. */
export const investigateSearchParams = {
  ...uxResetSharedContextParsers,
};
