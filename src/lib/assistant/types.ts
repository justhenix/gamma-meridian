export type ClientConversationState =
  | "ai_assistant"
  | "expert_requested"
  | "waiting_for_expert"
  | "expert_joined"
  | "resolved";

export type CaseStatusFilter =
  | "all"
  | "new"
  | "ai_handling"
  | "needs_expert"
  | "waiting"
  | "resolved";

export type HelpdeskCaseStatus =
  | "ai_handling"
  | "needs_expert"
  | "consultant_working"
  | "waiting_for_client"
  | "resolved"
  | "closed";

export type RiskLevel = "low" | "medium" | "high" | "unknown";

export interface StaffHelpdeskListItem {
  caseId: string;
  caseReference: string;
  clientName: string;
  title: string;
  status: HelpdeskCaseStatus;
  riskLevel: RiskLevel;
  updatedAt: string;
  escalationSeverity: "low" | "medium" | "high" | "critical" | null;
  assignedToCurrentStaff: boolean;
}

export interface Citation {
  id: string;
  code: string; // e.g. "PMK 172/2023 · Pasal 4"
  title: string;
  authority: string;
  locator: string; // e.g. "Pasal 4 Ayat (2) Huruf b"
  effectiveDate?: string;
  excerpt: string;
  officialUrl: string;
  verified: boolean;
}

export interface ChatMessage {
  id: string;
  sender: "client" | "ai" | "consultant" | "system";
  authorName?: string;
  authorTitle?: string;
  body: string;
  timestamp: string;
  isStreaming?: boolean;
  citations?: Citation[];
  suggestedFollowUps?: string[];
  escalationRecommended?: boolean;
  escalationState?: "none" | "recommended" | "requested" | "acknowledged";
  freeEscalationConfirmed?: boolean;
}

export interface MissingFact {
  key: string;
  label: string;
  status: "provided" | "missing" | "needs_verification";
  value?: string;
}

export interface RiskFlag {
  id: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  statuteRef?: string;
}

export interface HandoffBrief {
  caseId: string;
  summary: string;
  clientIntent: string;
  aiConclusion: string;
  escalationTrigger: string;
  missingFacts: MissingFact[];
  riskFlags: RiskFlag[];
  matchedRegulations: Citation[];
}

export interface HelpdeskCase {
  id: string;
  caseReference: string;
  clientName: string;
  companyName: string;
  email: string;
  title: string;
  practiceArea: string;
  primaryJurisdiction: string;
  status: HelpdeskCaseStatus;
  riskLevel: RiskLevel;
  receivedAt: string;
  updatedAt: string;
  intakeSummary: string;
  conversationState: ClientConversationState;
  assignedConsultant?: {
    name: string;
    title: string;
  };
  messages: ChatMessage[];
  handoffBrief: HandoffBrief;
}
