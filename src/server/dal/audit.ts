import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../auth/actor";
import { GuestTokenService } from "../auth/guest-token";
import { AuthorizationPolicy } from "../auth/policy";
import { AuditRepository } from "../db/repositories/audit";
import { withWriteTransaction } from "../db/transaction";
import { AuditService } from "../domain/audit/service";
import { DomainError } from "../domain/shared/errors";
import { parseInput } from "../validation/parse";
import { idSchema } from "../validation/schemas";

export interface AuditEventDto {
  id: string;
  actorType: "user" | "guest" | "system";
  actorUserId: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  reasonCode: string | null;
  changedFields: string[];
  createdAt: string;
}

export class AuditDal {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async listCaseEvents(actor: Actor, caseId: string): Promise<AuditEventDto[]> {
    const parsedCaseId = parseInput(idSchema, caseId);
    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const events = new AuditRepository(transaction);
      const audit = new AuditService(transaction);
      const access = await policy.requireCaseAccess(actor, parsedCaseId);
      if (!policy.isStaffCaseRole(access.membership.caseRole)) {
        throw new DomainError("FORBIDDEN", "The case audit trail is staff-only");
      }

      const records = await events.listByCase(parsedCaseId);
      await audit.write(actor, {
        caseId: parsedCaseId,
        eventType: "audit.viewed",
        targetType: "case",
        targetId: parsedCaseId,
      });
      return records.map((record) => ({
        id: record.id,
        actorType: record.actorType,
        actorUserId: record.actorUserId,
        eventType: record.eventType,
        targetType: record.targetType,
        targetId: record.targetId,
        reasonCode: record.reasonCode,
        changedFields: record.changedFields,
        createdAt: record.createdAt,
      }));
    });
  }
}
