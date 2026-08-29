import "server-only";

import type { Actor } from "../../auth/actor";
import { AuditRepository } from "../../db/repositories/audit";
import type { SqlExecutor } from "../../db/types";
import type { AuditEventRecord, JsonValue } from "../shared/types";

export interface WriteAuditEventInput {
  caseId?: string | null;
  actorReferenceId?: string | null;
  eventType: string;
  targetType: string;
  targetId: string;
  reasonCode?: string | null;
  changedFields?: string[];
  metadata?: Record<string, JsonValue>;
}

export class AuditService {
  private readonly events: AuditRepository;

  constructor(database: SqlExecutor) {
    this.events = new AuditRepository(database);
  }

  async write(actor: Actor, input: WriteAuditEventInput): Promise<AuditEventRecord> {
    const actorType =
      actor.kind === "user"
        ? "user"
        : actor.kind === "system"
          ? "system"
          : "guest";
    const actorReferenceId =
      input.actorReferenceId ??
      (actor.kind === "guest"
        ? actor.intakeSessionId
        : actor.kind === "system"
          ? actor.service
          : null);

    return this.events.append({
      caseId: input.caseId ?? null,
      actorType,
      actorUserId: actor.kind === "user" ? actor.userId : null,
      actorReferenceId,
      eventType: input.eventType,
      targetType: input.targetType,
      targetId: input.targetId,
      requestId: actor.requestId,
      reasonCode: input.reasonCode,
      changedFields: input.changedFields,
      metadata: input.metadata,
    });
  }
}
