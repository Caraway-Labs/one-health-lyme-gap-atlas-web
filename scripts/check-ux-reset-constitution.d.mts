export type CheckUxResetConstitutionOptions = {
  constitutionRel?: string;
  agentsRel?: string;
  skipAgents?: boolean;
};

export function validateConstitutionText(constitution: string): string[];

export function validateAgentsText(agents: string): string[];

export function checkUxResetConstitution(
  root?: string,
  options?: CheckUxResetConstitutionOptions
): string[];
