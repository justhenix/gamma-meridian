export type AiRunStatus =
  | "pending"
  | "running"
  | "succeeded"
  | "failed"
  | "invalid"
  | "escalated";

export interface DeterministicRiskResult {
  classification: "simple" | "needs_information" | "complex" | "high_risk";
  canAttemptAiAnswer: boolean;
  needsHuman: boolean;
  reasonCodes: string[];
  missingFacts: string[];
  rulesetVersion: string;
}

export interface AiRunRecord {
  id: string;
  caseId: string;
  conversationId: string;
  purpose: "answer_case_question" | "handoff_summary";
  triggerType: string;
  triggerId: string;
  requestedByUserId: string | null;
  status: AiRunStatus;
  provider: string;
  model: string;
  providerRequestId: string | null;
  promptKey: string;
  promptVersion: string;
  rulesetVersion: string;
  inputSnapshot: unknown;
  inputSha256: string;
  output: unknown | null;
  outputSha256: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number | null;
  errorCode: string | null;
  idempotencyKey: string;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface AnswerCaseQuestionResult {
  aiRunId: string;
  status: "answered" | "needs_human";
  needsHuman: boolean;
  reasonCodes: string[];
  messageId: string;
  recommendationVersionId: string | null;
  answer: string;
  citations: Array<{
    sourceSectionId: string;
    officialIdentifier: string;
    title: string;
    authority: string;
    canonicalUrl: string;
    locator: string;
  }>;
}
