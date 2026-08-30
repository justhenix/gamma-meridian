import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../../auth/actor";
import { GuestTokenService } from "../../auth/guest-token";
import { AuthorizationPolicy } from "../../auth/policy";
import { CasesRepository } from "../../db/repositories/cases";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { withWriteTransaction } from "../../db/transaction";
import { parseInput } from "../../validation/parse";
import {
  assignCaseMemberSchema,
  transitionCaseSchema,
} from "../../validation/schemas";
import { AuditService } from "../audit/service";
import { DomainError } from "../shared/errors";
import { nowIso } from "../shared/ids";
import type {
  CaseMemberRecord,
  CaseRecord,
  CaseRole,
  CaseStatus,
} from "../shared/types";

const transitions: Record<CaseStatus, CaseStatus[]> = {
  received: ["human_review_required", "consultant_working"],
  human_review_required: ["consultant_working"],
  consultant_working: ["human_review_required", "waiting_for_client", "resolved"],
  waiting_for_client: ["human_review_required", "consultant_working"],
  resolved: ["human_review_required", "closed", "consultant_working"],
  closed: ["consultant_working"],
};

function isLeadOrAdmin(role: CaseRole, globalRole: string): boolean {
  return role === "lead_consultant" || globalRole === "admin";
}

export class CasesService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async assignMember(actor: Actor, input: unknown): Promise<CaseMemberRecord> {
    const data = parseInput(assignCaseMemberSchema, input);

    return withWriteTransaction(this.database, async (transaction) => {
      const cases = new CasesRepository(transaction);
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const audit = new AuditService(transaction);
      const caseRecord = await cases.findCaseById(data.caseId);
      if (!caseRecord) {
        throw new DomainError("NOT_FOUND", "Case was not found");
      }

      const { actorUser } = await policy.requireAssignableTarget(
        actor,
        caseRecord,
        data.userId,
        data.caseRole,
      );
      const member = await cases.upsertMember({
        caseId: caseRecord.id,
        userId: data.userId,
        caseRole: data.caseRole,
        addedByUserId: actorUser.id,
        reason: data.reason,
      });
      await audit.write(actor, {
        caseId: caseRecord.id,
        eventType: "case.member_assigned",
        targetType: "case_member",
        targetId: member.id,
        reasonCode: "member_assignment",
        changedFields: ["case_role", "removed_at"],
        metadata: { caseRole: data.caseRole, assignedUserId: data.userId },
      });
      return member;
    });
  }

  async transitionCase(actor: Actor, input: unknown): Promise<CaseRecord> {
    const data = parseInput(transitionCaseSchema, input);

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const cases = new CasesRepository(transaction);
      const conversations = new ConversationsRepository(transaction);
      const audit = new AuditService(transaction);
      const access = await policy.requireCaseAccess(actor, data.caseId);
      const { caseRecord, membership, user } = access;

      if (!policy.isStaffCaseRole(membership.caseRole)) {
        throw new DomainError("FORBIDDEN", "Only assigned staff can change case state");
      }
      if (caseRecord.rowVersion !== data.expectedVersion) {
        throw new DomainError("CONFLICT", "The case was changed by another request");
      }
      if (!transitions[caseRecord.status].includes(data.toStatus)) {
        throw new DomainError(
          "INVALID_STATE",
          `Cannot transition from ${caseRecord.status} to ${data.toStatus}`,
        );
      }

      const reopening =
        (caseRecord.status === "resolved" || caseRecord.status === "closed") &&
        data.toStatus === "consultant_working";
      if (
        (data.toStatus === "closed" || reopening) &&
        !isLeadOrAdmin(membership.caseRole, user.globalRole)
      ) {
        throw new DomainError("FORBIDDEN", "Only a lead or admin may close or reopen a case");
      }

      if (data.toStatus === "resolved") {
        const mayResolve =
          membership.caseRole === "lead_consultant" ||
          membership.caseRole === "reviewer" ||
          user.globalRole === "admin";
        if (!mayResolve) {
          throw new DomainError("FORBIDDEN", "This case role cannot resolve a case");
        }
        if (!data.resolutionCode) {
          throw new DomainError("VALIDATION_ERROR", "Resolution code is required");
        }
        if (!(await conversations.hasStaffMessageInClientConversation(caseRecord.id))) {
          throw new DomainError(
            "INVALID_STATE",
            "A staff-authored client message is required before resolution",
          );
        }
      }

      const timestamp = nowIso();
      const resolvedAt =
        data.toStatus === "resolved"
          ? timestamp
          : reopening
            ? null
            : caseRecord.resolvedAt;
      const closedAt =
        data.toStatus === "closed" ? timestamp : reopening ? null : caseRecord.closedAt;
      const resolutionCode =
        data.toStatus === "resolved"
          ? data.resolutionCode!
          : reopening
            ? null
            : caseRecord.resolutionCode;
      const resolutionNote =
        data.toStatus === "resolved"
          ? (data.resolutionNote ?? null)
          : reopening
            ? null
            : caseRecord.resolutionNote;

      const updated = await cases.updateStatus({
        id: caseRecord.id,
        expectedVersion: data.expectedVersion,
        toStatus: data.toStatus,
        resolutionCode,
        resolutionNote,
        resolvedAt,
        closedAt,
      });
      if (!updated) {
        throw new DomainError("CONFLICT", "The case was changed by another request");
      }

      await audit.write(actor, {
        caseId: caseRecord.id,
        eventType: "case.status_changed",
        targetType: "case",
        targetId: caseRecord.id,
        reasonCode: data.reason,
        changedFields: [
          "status",
          "row_version",
          ...(data.toStatus === "resolved" ? ["resolution_code", "resolved_at"] : []),
          ...(data.toStatus === "closed" ? ["closed_at"] : []),
        ],
        metadata: { fromStatus: caseRecord.status, toStatus: data.toStatus },
      });

      return (await cases.findCaseById(caseRecord.id))!;
    });
  }
}
