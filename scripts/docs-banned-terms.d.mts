export type BannedTermPatternKind = "phrase" | "regex";

export type BannedTerm = {
  allowInCode?: boolean;
  avoid: string;
  id: string;
  instead: string;
  mechanical: boolean;
  pattern?: string;
  patternKind?: BannedTermPatternKind;
};

export const BANNED_TERMS: readonly BannedTerm[];
