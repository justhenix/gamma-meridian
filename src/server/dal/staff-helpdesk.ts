import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../auth/actor";
import type { GuestTokenService } from "../auth/guest-token";
import { AuthorizationPolicy } from "../auth/policy";
import { CasesRepository } from "../db/repositories/cases";
import { ClientsRepository } from "../db/repositories/clients";
import { ConversationsRepository } from "../db/repositories/conversations";
import { EscalationsRepository, type EscalationRecord } from "../db/repositories/escalations";
import { UsersRepository } from "../db/repositories/users";
import { DomainError } from "../domain/shared/errors";
import type { CaseRecord, CaseStatus, JsonValue } from "../domain/shared/types";
import type {
  ChatMessage,
  Citation,
  ClientConversationState,
  HandoffBrief,
  HelpdeskCaseStatus,
  RiskFlag,
  StaffHelpdeskListItem,
} from "../../lib/assistant/types";

function helpdeskStatus(status: CaseStatus): HelpdeskCaseStatus {
  switch (status) {
    case "received":
      return "ai_handling";
    case "human_review_required":
      return "needs_expert";
    case "consultant_working":
      return "consultant_working";
    case "waiting_for_client":
      return "waiting_for_client";
    case "resolved":
      return "resolved";
    case "closed":
      return "closed";
  }
}

function conversationState(status: CaseStatus): ClientConversationState {
  switch (status) {
    case "received":
      return "ai_assistant";
    case "human_review_required":
      return "waiting_for_expert";
    case "consultant_working":
    case "waiting_for_client":
      return "expert_joined";
    case "resolved":
    case "closed":
      return "resolved";
  }
}

function asString(value: JsonValue | undefined, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asArray(value: JsonValue | undefined): JsonValue[] {
  return Array.isArray(value) ? value : [];
}

function readableCode(value: string): string {
  return value
    .replace(/[_:-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function safeText(value: JsonValue | undefined): string {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null || value === undefined) return "";
  return JSON.stringify(value);
}

function handoffBrief(escalation: EscalationRecord, caseRecord: CaseRecord): HandoffBrief {
  const handoff = escalation.handoffSummary;
  const missingFacts = asArray(handoff.missingFacts)
    .filter((value): value is string => typeof value === "string")
    .map((value) => ({
      key: value,
      label: readableCode(value),
      status: "missing" as const,
    }));
  const riskSeverity: RiskFlag["severity"] = escalation.severity === "critical"
    ? "high"
    : escalation.severity;
  const riskFlags = asArray(handoff.riskFlags)
    .filter((value): value is string => typeof value === "string")
    .map((value) => ({
      id: value,
      title: readableCode(value),
      description: "Review this point before giving final client advice.",
      severity: riskSeverity,
    }));
  const matchedRegulations: Citation[] = asArray(handoff.retrievedRegulations)
    .flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const source = value as Record<string, JsonValue>;
      const sourceSectionId = asString(source.sourceSectionId);
      const title = asString(source.title);
      const authority = asString(source.authority);
      const locator = asString(source.locator);
      const officialUrl = asString(source.canonicalUrl);
      if (!sourceSectionId || !title || !authority || !officialUrl) return [];
      return [{
        id: sourceSectionId,
        code: asString(source.officialIdentifier, title),
        title,
        authority,
        locator,
        excerpt: asString(source.bodyText).slice(0, 320),
        officialUrl,
        verified: true,
      } satisfies Citation];
    });

  return {
    caseId: caseRecord.id,
    summary: asString(handoff.summary, "Conversation escalated for Meridian expert review."),
    clientIntent: asString(handoff.originalQuestion, caseRecord.title),
    aiConclusion: asString(
      handoff.previousAiAnswer,
      "No final AI answer was retained for this handoff.",
    ),
    escalationTrigger: escalation.reasonText,
    missingFacts,
    riskFlags,
    matchedRegulations,
  };
}

function intakeSummary(escalation: EscalationRecord): string {
  const facts = asArray(escalation.handoffSummary.intakeFacts)
    .flatMap((value) => {
      if (!value || typeof value !== "object" || Array.isArray(value)) return [];
      const fact = value as Record<string, JsonValue>;
      const key = asString(fact.questionKey);
      const answer = safeText(fact.answer);
      return key && answer ? [`${readableCode(key)}: ${answer}`] : [];
    });
  return facts.join("\n") || "Client context is preserved in the shared conversation.";
}

export class StaffHelpdeskDal {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async list(actor: Actor): Promise<StaffHelpdeskListItem[]> {
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const user = await policy.requireActiveUser(actor);
    if (user.globalRole !== "consultant" && user.globalRole !== "admin") {
      throw new DomainError("FORBIDDEN", "Staff helpdesk access is limited to active staff");
    }
    const cases = await new CasesRepository(this.database).listStaffCasesForUser(user.id);
    return Promise.all(cases.map(async (record) => {
      const identity = await this.clientIdentity(record);
      const escalation = await new EscalationsRepository(this.database).findLatestForCase(record.id);
      const assignment = await new CasesRepository(this.database).findActiveStaffMembership(record.id);
      return {
        caseId: record.id,
        caseReference: record.caseReference,
        clientName: identity.clientName,
        title: record.title,
        status: helpdeskStatus(record.status),
        riskLevel: record.riskLevel,
        updatedAt: record.updatedAt,
        escalationSeverity: escalation?.severity ?? null,
        assignedToCurrentStaff: assignment?.userId === user.id,
      };
    }));
  }

  async get(actor: Actor, caseId: string) {
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const access = await policy.requireCaseAccess(actor, caseId);
    if (!policy.isStaffCaseRole(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "Staff helpdesk detail requires an assigned staff role");
    }
    const { caseRecord } = access;
    const conversations = new ConversationsRepository(this.database);
    const conversation = await conversations.findConversationByChannel(caseRecord.id, "client");
    if (!conversation) throw new DomainError("INVALID_STATE", "Client conversation is missing");
    const escalation = await new EscalationsRepository(this.database).findLatestForCase(caseRecord.id);
    if (!escalation) throw new DomainError("NOT_FOUND", "No escalation was found for this case");
    const identity = await this.clientIdentity(caseRecord);
    const messages = await this.safeMessages(await conversations.listMessages(conversation.id));
    const assigned = await new CasesRepository(this.database).findActiveStaffMembership(caseRecord.id);
    const assignedUser = assigned
      ? await new UsersRepository(this.database).findById(assigned.userId)
      : null;

    return {
      id: caseRecord.id,
      caseId: caseRecord.id,
      caseReference: caseRecord.caseReference,
      clientName: identity.clientName,
      companyName: identity.companyName,
      email: identity.email,
      title: caseRecord.title,
      practiceArea: "Tax & business advisory",
      primaryJurisdiction: caseRecord.primaryJurisdiction,
      status: helpdeskStatus(caseRecord.status),
      riskLevel: caseRecord.riskLevel,
      receivedAt: caseRecord.receivedAt,
      updatedAt: caseRecord.updatedAt,
      rowVersion: caseRecord.rowVersion,
      intakeSummary: intakeSummary(escalation),
      conversationState: conversationState(caseRecord.status),
      conversationId: conversation.id,
      assignedConsultant: assignedUser
        ? { name: assignedUser.displayName, title: "Meridian Tax Consultant" }
        : undefined,
      messages,
      handoffBrief: handoffBrief(escalation, caseRecord),
    };
  }

  private async clientIdentity(caseRecord: CaseRecord) {
    const users = new UsersRepository(this.database);
    const clients = new ClientsRepository(this.database);
    const client = caseRecord.createdByUserId ? await users.findById(caseRecord.createdByUserId) : null;
    const account = caseRecord.clientAccountId
      ? await clients.findAccountById(caseRecord.clientAccountId)
      : null;
    return {
      clientName: client?.displayName ?? "Verified client",
      email: client?.emailNormalized ?? "",
      companyName: account?.displayName ?? client?.displayName ?? "Verified client",
    };
  }

  private async safeMessages(messages: Awaited<ReturnType<ConversationsRepository["listMessages"]>>) {
    const users = new UsersRepository(this.database);
    return Promise.all(messages.map(async (message): Promise<ChatMessage> => {
      if (message.authorType === "ai") {
        return {
          id: message.id,
          sender: "ai",
          body: message.bodyMarkdown,
          timestamp: message.createdAt,
        };
      }
      if (message.authorType === "system") {
        return {
          id: message.id,
          sender: "system",
          body: message.bodyMarkdown,
          timestamp: message.createdAt,
        };
      }
      const author = message.authorUserId ? await users.findById(message.authorUserId) : null;
      const staff = author?.globalRole === "consultant" || author?.globalRole === "admin";
      return {
        id: message.id,
        sender: staff ? "consultant" : "client",
        ...(staff ? { authorName: author?.displayName ?? "Meridian Expert" } : {}),
        ...(staff ? { authorTitle: "Meridian Tax Consultant" } : {}),
        body: message.bodyMarkdown,
        timestamp: message.createdAt,
      };
    }));
  }
}
