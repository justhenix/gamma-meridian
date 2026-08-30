export type Locale = "id" | "en";
export type UserRole = "client" | "consultant" | "admin";
export type UserStatus = "invited" | "active" | "suspended";
export type ClientAccountType = "individual" | "company";
export type ClientMembershipRole = "owner" | "member";
export type IntakeStatus = "draft" | "submitted" | "claimed" | "expired";
export type DataClassification = "internal" | "confidential" | "restricted";
export type CaseStatus =
  | "received"
  | "human_review_required"
  | "consultant_working"
  | "waiting_for_client"
  | "resolved"
  | "closed";
export type RiskLevel = "unknown" | "low" | "medium" | "high";
export type CaseRole =
  | "client_owner"
  | "client_collaborator"
  | "lead_consultant"
  | "consultant"
  | "reviewer";
export type ConversationChannel = "client" | "internal";
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export interface UserRecord {
  id: string;
  authSubject: string;
  emailNormalized: string;
  displayName: string;
  globalRole: UserRole;
  locale: Locale;
  status: UserStatus;
  emailVerifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAccountRecord {
  id: string;
  accountType: ClientAccountType;
  legalName: string;
  displayName: string;
  countryCode: string;
  preferredLocale: Locale;
  status: "active" | "archived";
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientAccountMemberRecord {
  id: string;
  clientAccountId: string;
  userId: string;
  membershipRole: ClientMembershipRole;
  status: "active" | "removed";
  invitedByUserId: string;
  createdAt: string;
  removedAt: string | null;
}

export interface IntakeSessionRecord {
  id: string;
  ownerUserId: string | null;
  guestTokenHash: string | null;
  intakeSchemaVersion: string;
  locale: Locale;
  status: IntakeStatus;
  expiresAt: string | null;
  submittedAt: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeAnswerRecord {
  id: string;
  intakeSessionId: string;
  questionKey: string;
  questionVersion: string;
  answer: JsonValue;
  dataClassification: DataClassification;
  createdAt: string;
  updatedAt: string;
}

export interface CaseRecord {
  id: string;
  caseReference: string;
  intakeSessionId: string;
  clientAccountId: string | null;
  createdByUserId: string | null;
  submissionIdempotencyKey: string;
  title: string;
  primaryJurisdiction: string;
  taxTopics: string[];
  taxPeriodStart: string | null;
  taxPeriodEnd: string | null;
  status: CaseStatus;
  riskLevel: RiskLevel;
  resolutionCode: string | null;
  resolutionNote: string | null;
  rowVersion: number;
  receivedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CaseMemberRecord {
  id: string;
  caseId: string;
  userId: string;
  caseRole: CaseRole;
  addedByUserId: string;
  reason: string;
  createdAt: string;
  removedAt: string | null;
}

export interface ConversationRecord {
  id: string;
  caseId: string;
  channel: ConversationChannel;
  status: "open" | "closed";
  createdByUserId: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface MessageRecord {
  id: string;
  conversationId: string;
  authorType: "user" | "ai" | "system";
  authorUserId: string | null;
  aiRunId: string | null;
  bodyMarkdown: string;
  language: Locale;
  clientRequestId: string;
  createdAt: string;
}

export interface AuditEventRecord {
  id: string;
  caseId: string | null;
  actorType: "user" | "guest" | "system";
  actorUserId: string | null;
  actorReferenceId: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  requestId: string;
  reasonCode: string | null;
  changedFields: string[];
  metadata: Record<string, JsonValue>;
  createdAt: string;
}
