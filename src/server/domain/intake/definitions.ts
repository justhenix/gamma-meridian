import "server-only";

export interface IntakeQuestionDefinition {
  version: string;
  required: boolean;
}

export interface IntakeDefinition {
  questions: Record<string, IntakeQuestionDefinition>;
}

const definitions: Record<string, IntakeDefinition> = {
  v1: {
    questions: {
      summary: { version: "1", required: true },
      client_type: { version: "1", required: false },
      urgency: { version: "1", required: false },
    },
  },
};

export function getIntakeDefinition(version: string): IntakeDefinition | null {
  return definitions[version] ?? null;
}
