import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor } from "../../auth/actor";
import { AuthorizationPolicy } from "../../auth/policy";
import type { GuestTokenService } from "../../auth/guest-token";
import type { AiRuntimeConfig } from "../../config/ai";
import { AiRunsRepository } from "../../db/repositories/ai-runs";
import { CasesRepository } from "../../db/repositories/cases";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { EscalationsRepository, type EscalationRecord } from "../../db/repositories/escalations";
import { IntakeRepository } from "../../db/repositories/intake";
import { RegulationsRepository } from "../../db/repositories/regulations";
import { withWriteTransaction } from "../../db/transaction";
import { AuditService } from "../audit/service";
import { DomainError } from "../shared/errors";
import type { JsonValue } from "../shared/types";

const escalationSchema = z.object({
  caseId: z.uuid(),
  conversationId: z.uuid(),
  reason: z.string().trim().min(3).max(2000),
  reasonCodes: z.array(z.string().trim().min(1).max(120)).max(24).default(["user_requested_human"]),
});

function severityFor(reasonCodes: string[]): EscalationRecord["severity"] {
  const highRisk = new Set([
    "audit_or_dispute",
    "sanction_or_deadline",
    "transfer_pricing",
    "formal_opinion",
    "filing_or_representation",
  ]);
  return reasonCodes.some((code) => highRisk.has(code)) ? "high" : "medium";
}

export class EscalationsService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
    private readonly runtimeConfig: AiRuntimeConfig,
  ) {}

  async escalateConversation(actor: Actor, input: unknown): Promise<EscalationRecord> {
    const data = escalationSchema.parse(input);

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const access = await policy.requireCaseAccess(actor, data.caseId);
      const conversations = new ConversationsRepository(transaction);
      const conversation = await conversations.findConversationById(data.conversationId);
      if (!conversation || conversation.caseId !== access.caseRecord.id) {
        throw new DomainError("NOT_FOUND", "Conversation was not found for this case");
      }
      if (conversation.channel !== "client") {
        throw new DomainError("FORBIDDEN", "Only the shared client conversation can be escalated");
      }
      if (access.caseRecord.status === "closed") {
        throw new DomainError("INVALID_STATE", "A closed case must be reopened by assigned staff");
      }

      const messages = await conversations.listMessages(conversation.id);
      const intakeAnswers = await new IntakeRepository(transaction).listAnswers(
        access.caseRecord.intakeSessionId,
      );
      const latestRun = await new AiRunsRepository(transaction).findLatestByCase(
        access.caseRecord.id,
      );
      const sourceIds = latestRun
        ? await new AiRunsRepository(transaction).listSourceSectionIds(latestRun.id)
        : [];
      const regulations = new RegulationsRepository(transaction);
      const sources = (await Promise.all(
        sourceIds.map((id) => regulations.findRetrievedSectionById(id)),
      )).filter((source) => source !== null);
      const originalQuestion = messages.find((message) => message.authorType === "user");
      const previousAiMessage = [...messages].reverse().find((message) => message.authorType === "ai");
      const latestOutput = latestRun?.output;
      const latestSnapshot = latestRun?.inputSnapshot as {
        risk?: { reasonCodes?: unknown; missingFacts?: unknown };
      } | undefined;
      const riskFlags = Array.isArray(latestSnapshot?.risk?.reasonCodes)
        ? latestSnapshot.risk.reasonCodes.filter((value): value is string => typeof value === "string")
        : [];
      const missingFacts =
        latestOutput && typeof latestOutput === "object" && "missingFacts" in latestOutput &&
        Array.isArray((latestOutput as { missingFacts?: unknown }).missingFacts)
          ? (latestOutput as { missingFacts: unknown[] }).missingFacts.filter(
              (value): value is string => typeof value === "string",
            )
          : Array.isArray(latestSnapshot?.risk?.missingFacts)
            ? latestSnapshot.risk.missingFacts.filter(
                (value): value is string => typeof value === "string",
              )
            : [];

      const handoffSummary: Record<string, JsonValue> = {
        summary: `Escalated shared conversation with ${messages.length} messages and ${sources.length} retrieved source sections.`,
        originalQuestion: originalQuestion?.bodyMarkdown ?? null,
        intakeFacts: intakeAnswers.map((answer) => ({
          questionKey: answer.questionKey,
          questionVersion: answer.questionVersion,
          answer: answer.answer,
        })),
        conversation: messages.map((message) => ({
          id: message.id,
          authorType: message.authorType,
          authorUserId: message.authorUserId,
          bodyMarkdown: message.bodyMarkdown,
          language: message.language,
          createdAt: message.createdAt,
        })),
        missingFacts,
        riskFlags: [...new Set([...riskFlags, ...data.reasonCodes])],
        retrievedRegulations: sources.map((source) => ({
          sourceSectionId: source.id,
          officialIdentifier: source.source.officialIdentifier,
          title: source.source.title,
          authority: source.source.authority,
          canonicalUrl: source.source.canonicalUrl,
          version: source.version.versionLabel,
          locator: source.locator,
          bodyText: source.bodyText,
        })),
        previousAiAnswer: previousAiMessage?.bodyMarkdown ?? null,
        aiRunId: latestRun?.id ?? null,
      };

      const escalation = await new EscalationsRepository(transaction).createOrUpdateActive({
        caseId: access.caseRecord.id,
        conversationId: conversation.id,
        aiRunId: latestRun?.id ?? null,
        triggerType: access.user.globalRole === "client" ? "client_request" : "consultant",
        reasonCodes: [...new Set([...riskFlags, ...data.reasonCodes])],
        reasonText: data.reason,
        handoffSummary,
        severity: severityFor([...riskFlags, ...data.reasonCodes]),
      });

      if (access.caseRecord.status !== "human_review_required") {
        const updated = await new CasesRepository(transaction).updateStatus({
          id: access.caseRecord.id,
          expectedVersion: access.caseRecord.rowVersion,
          toStatus: "human_review_required",
          resolutionCode: null,
          resolutionNote: null,
          resolvedAt: null,
          closedAt: null,
        });
        if (!updated) {
          throw new DomainError("CONFLICT", "The case was changed by another request");
        }
      }

      await conversations.createMessage({
        conversationId: conversation.id,
        authorType: "system",
        authorUserId: null,
        bodyMarkdown: access.caseRecord.status === "human_review_required"
          ? "The expert escalation remains active for this conversation."
          : this.runtimeConfig.expertEscalationFree
            ? "A Meridian expert has been requested for this conversation at no additional cost."
            : "A Meridian expert has been requested for this conversation.",
        language: messages.at(-1)?.language ?? "id",
        clientRequestId: `escalation:${escalation.id}`,
      });
      await new AuditService(transaction).write(actor, {
        caseId: access.caseRecord.id,
        eventType: "escalation.opened",
        targetType: "escalation",
        targetId: escalation.id,
        reasonCode: data.reasonCodes[0] ?? "user_requested_human",
        changedFields: ["status", "handoff_summary_json"],
        metadata: { conversationId: conversation.id, reasonCodes: data.reasonCodes },
      });
      return escalation;
    });
  }

  async getActiveEscalationContext(actor: Actor, caseId: string): Promise<EscalationRecord> {
    const parsedCaseId = z.uuid().parse(caseId);
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const access = await policy.requireCaseAccess(actor, parsedCaseId);
    if (!policy.isStaffCaseRole(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "Escalation handoff context is staff-only");
    }
    const escalation = await new EscalationsRepository(this.database).findActive(parsedCaseId);
    if (!escalation) throw new DomainError("NOT_FOUND", "No active escalation was found");
    return escalation;
  }
}
