import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../auth/actor";
import { GuestTokenService } from "../auth/guest-token";
import { AuthorizationPolicy } from "../auth/policy";
import { withWriteTransaction } from "../db/transaction";
import { AuditService } from "../domain/audit/service";
import type { CaseRole, CaseStatus, RiskLevel } from "../domain/shared/types";
import { parseInput } from "../validation/parse";
import { idSchema } from "../validation/schemas";

export interface CaseDto {
  id: string;
  caseReference: string;
  clientAccountId: string | null;
  title: string;
  primaryJurisdiction: string;
  taxTopics: string[];
  taxPeriodStart: string | null;
  taxPeriodEnd: string | null;
  status: CaseStatus;
  riskLevel: RiskLevel;
  resolutionCode: string | null;
  rowVersion: number;
  memberRole: CaseRole;
  receivedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
}

export class CasesDal {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async getCase(actor: Actor, caseId: string): Promise<CaseDto> {
    const parsedCaseId = parseInput(idSchema, caseId);
    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const audit = new AuditService(transaction);
      const access = await policy.requireCaseAccess(actor, parsedCaseId);
      const record = access.caseRecord;

      await audit.write(actor, {
        caseId: record.id,
        eventType: "case.viewed",
        targetType: "case",
        targetId: record.id,
      });
      return {
        id: record.id,
        caseReference: record.caseReference,
        clientAccountId: record.clientAccountId,
        title: record.title,
        primaryJurisdiction: record.primaryJurisdiction,
        taxTopics: record.taxTopics,
        taxPeriodStart: record.taxPeriodStart,
        taxPeriodEnd: record.taxPeriodEnd,
        status: record.status,
        riskLevel: record.riskLevel,
        resolutionCode: record.resolutionCode,
        rowVersion: record.rowVersion,
        memberRole: access.membership.caseRole,
        receivedAt: record.receivedAt,
        resolvedAt: record.resolvedAt,
        closedAt: record.closedAt,
      };
    });
  }
}
