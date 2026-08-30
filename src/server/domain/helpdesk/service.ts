import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor } from "../../auth/actor";
import type { GuestTokenService } from "../../auth/guest-token";
import { AuthorizationPolicy } from "../../auth/policy";
import { CasesRepository } from "../../db/repositories/cases";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { EscalationsRepository } from "../../db/repositories/escalations";
import { withWriteTransaction } from "../../db/transaction";
import { sendMessageSchema } from "../../validation/schemas";
import { AuditService } from "../audit/service";
import { CasesService } from "../cases/service";
import { ConversationsService } from "../conversations/service";
import { DomainError } from "../shared/errors";
import type { CaseMemberRecord, CaseRecord, Locale, MessageRecord } from "../shared/types";

const caseActionSchema = z.object({ caseId: z.uuid() });
const replySchema = sendMessageSchema.omit({ conversationId: true }).extend({ caseId: z.uuid() });
const resolveSchema = caseActionSchema.extend({
  resolutionNote: z.string().trim().max(2000).optional(),
});

export class StaffHelpdeskService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async claimCase(actor: Actor, input: unknown): Promise<CaseMemberRecord> {
    const data = caseActionSchema.parse(input);
    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const user = await policy.requireActiveUser(actor);
      if (user.globalRole !== "consultant" && user.globalRole !== "admin") {
        throw new DomainError("FORBIDDEN", "Staff helpdesk access is limited to active staff");
      }

      const cases = new CasesRepository(transaction);
      const caseRecord = await cases.findCaseById(data.caseId);
      if (!caseRecord) throw new DomainError("NOT_FOUND", "Case was not found");
      const ownMembership = await cases.findActiveMembership(caseRecord.id, user.id);
      if (ownMembership) {
        if (!policy.isStaffCaseRole(ownMembership.caseRole)) {
          throw new DomainError("FORBIDDEN", "The current membership is not a staff assignment");
        }
        const active = await new EscalationsRepository(transaction).findActive(caseRecord.id);
        if (active?.assignedToUserId && active.assignedToUserId !== user.id) {
          throw new DomainError("CONFLICT", "This escalation is already assigned to another staff member");
        }
        if (active?.status === "open") {
          await new EscalationsRepository(transaction).assignOpenToUser(caseRecord.id, user.id);
        }
        return ownMembership;
      }

      const assignedStaff = await cases.findActiveStaffMembership(caseRecord.id);
      if (assignedStaff && assignedStaff.userId !== user.id) {
        throw new DomainError("CONFLICT", "This case is already assigned to another staff member");
      }

      const escalations = new EscalationsRepository(transaction);
      const active = await escalations.findActive(caseRecord.id);
      if (!active) throw new DomainError("INVALID_STATE", "No active escalation is available to claim");
      if (active.assignedToUserId && active.assignedToUserId !== user.id) {
        throw new DomainError("CONFLICT", "This escalation is already assigned to another staff member");
      }
      const claimedEscalation = active.status === "open"
        ? await escalations.assignOpenToUser(caseRecord.id, user.id)
        : active;
      if (!claimedEscalation || claimedEscalation.assignedToUserId !== user.id) {
        throw new DomainError("CONFLICT", "This escalation was claimed by another staff member");
      }

      const member = await cases.upsertMember({
        caseId: caseRecord.id,
        userId: user.id,
        caseRole: "lead_consultant",
        addedByUserId: user.id,
        reason: "helpdesk_self_claim",
      });
      await new AuditService(transaction).write(actor, {
        caseId: caseRecord.id,
        eventType: "case.member_assigned",
        targetType: "case_member",
        targetId: member.id,
        reasonCode: "helpdesk_self_claim",
        changedFields: ["case_role", "assigned_to_user_id", "assigned_at"],
        metadata: { escalationId: claimedEscalation.id, caseRole: member.caseRole },
      });
      return member;
    });
  }

  async sendReply(
    actor: Actor,
    input: unknown,
  ): Promise<{ message: MessageRecord; caseRecord: CaseRecord }> {
    const data = replySchema.parse(input);
    const access = await new AuthorizationPolicy(this.database, this.guestTokens).requireCaseAccess(
      actor,
      data.caseId,
    );
    if (!new AuthorizationPolicy(this.database, this.guestTokens).isStaffCaseRole(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "Only assigned staff can reply from the helpdesk");
    }
    const conversation = await new ConversationsRepository(this.database).findConversationByChannel(
      data.caseId,
      "client",
    );
    if (!conversation) throw new DomainError("INVALID_STATE", "Client conversation is missing");

    const message = await new ConversationsService(this.database, this.guestTokens).sendMessage(actor, {
      conversationId: conversation.id,
      bodyMarkdown: data.bodyMarkdown,
      language: data.language satisfies Locale,
      clientRequestId: data.clientRequestId,
    });

    let caseRecord = (await new CasesRepository(this.database).findCaseById(data.caseId))!;
    if (["received", "human_review_required", "waiting_for_client"].includes(caseRecord.status)) {
      try {
        caseRecord = await new CasesService(this.database, this.guestTokens).transitionCase(actor, {
          caseId: caseRecord.id,
          expectedVersion: caseRecord.rowVersion,
          toStatus: "consultant_working",
          reason: "helpdesk_consultant_reply",
        });
      } catch (error) {
        if (!(error instanceof DomainError && error.code === "CONFLICT")) throw error;
        const current = await new CasesRepository(this.database).findCaseById(data.caseId);
        if (!current || current.status !== "consultant_working") throw error;
        caseRecord = current;
      }
    }

    return { message, caseRecord };
  }

  async markWaiting(actor: Actor, input: unknown): Promise<CaseRecord> {
    const data = caseActionSchema.parse(input);
    const caseRecord = await this.requireAssignedStaffCase(actor, data.caseId);
    if (caseRecord.status === "waiting_for_client") return caseRecord;
    return new CasesService(this.database, this.guestTokens).transitionCase(actor, {
      caseId: caseRecord.id,
      expectedVersion: caseRecord.rowVersion,
      toStatus: "waiting_for_client",
      reason: "helpdesk_waiting_for_client",
    });
  }

  async markResolved(actor: Actor, input: unknown): Promise<CaseRecord> {
    const data = resolveSchema.parse(input);
    const caseRecord = await this.requireAssignedStaffCase(actor, data.caseId);
    const resolved = caseRecord.status === "resolved"
      ? caseRecord
      : await new CasesService(this.database, this.guestTokens).transitionCase(actor, {
          caseId: caseRecord.id,
          expectedVersion: caseRecord.rowVersion,
          toStatus: "resolved",
          reason: "helpdesk_human_review_completed",
          resolutionCode: "human_review_completed",
          resolutionNote: data.resolutionNote,
        });
    if (actor.kind === "user") {
      await new EscalationsRepository(this.database).resolveAssignedForCase({
        caseId: resolved.id,
        userId: actor.userId,
        resolutionNote: data.resolutionNote ?? null,
      });
    }
    return resolved;
  }

  private async requireAssignedStaffCase(actor: Actor, caseId: string): Promise<CaseRecord> {
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const access = await policy.requireCaseAccess(actor, caseId);
    if (!policy.isStaffCaseRole(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "Only assigned staff can perform this helpdesk action");
    }
    return access.caseRecord;
  }
}
