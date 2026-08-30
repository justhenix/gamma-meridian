import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor, UserActor } from "../../auth/actor";
import type { GuestTokenService } from "../../auth/guest-token";
import { AuthorizationPolicy } from "../../auth/policy";
import { GENERAL_ASSISTANT_TOPIC } from "../../config/ai";
import { CasesRepository } from "../../db/repositories/cases";
import { ClientsRepository } from "../../db/repositories/clients";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { UsersRepository } from "../../db/repositories/users";
import { DomainError } from "../shared/errors";
import { createCaseReference, createId, nowIso } from "../shared/ids";

const openSchema = z.object({
  locale: z.enum(["id", "en"]).default("en"),
  reset: z.boolean().optional(),
});

const GUEST_ASSISTANT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface AssistantSessionDto {
  intakeSessionId: string;
  caseId: string;
  caseReference: string;
  conversationId: string;
  status: string;
  guestToken?: string;
}

export class AssistantSessionService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
    private readonly safeTopics: string[],
  ) {}

  async open(actor: Actor, input: unknown): Promise<AssistantSessionDto> {
    const data = openSchema.parse(input);

    if (actor.kind === "user") {
      const policy = new AuthorizationPolicy(this.database, this.guestTokens);
      await policy.requireActiveUser(actor);
      if (!data.reset) {
        try {
          return await this.restore(actor);
        } catch (error) {
          if (!(error instanceof DomainError && error.code === "NOT_FOUND")) {
            throw error;
          }
        }
      }
      return this.openForUser(actor, data.locale);
    }

    if (actor.kind === "guest" && !data.reset) {
      try {
        return await this.restore(actor);
      } catch (error) {
        if (
          !(
            error instanceof DomainError &&
            (error.code === "NOT_FOUND" || error.code === "FORBIDDEN")
          )
        ) {
          throw error;
        }
      }
    }

    if (actor.kind !== "anonymous" && actor.kind !== "guest") {
      throw new DomainError("FORBIDDEN", "This actor cannot open the assistant");
    }

    const issuedToken = this.guestTokens.issue();
    const intakeSessionId = createId();
    const answerId = createId();
    const caseId = createId();
    const caseReference = createCaseReference();
    const clientConversationId = createId();
    const internalConversationId = createId();
    const createdAt = nowIso();
    const expiresAt = new Date(Date.now() + GUEST_ASSISTANT_TTL_MS).toISOString();
    const taxTopics = this.safeTopics.includes(GENERAL_ASSISTANT_TOPIC)
      ? [GENERAL_ASSISTANT_TOPIC]
      : this.safeTopics.length > 0
        ? this.safeTopics
        : [GENERAL_ASSISTANT_TOPIC];

    await this.database.batch([
      {
        sql: `
          INSERT INTO intake_sessions (
            id, owner_user_id, guest_token_hash, intake_schema_version, locale,
            status, expires_at, submitted_at, row_version, created_at, updated_at
          ) VALUES (?, NULL, ?, 'v1', ?, 'draft', ?, NULL, 1, ?, ?)
        `,
        args: [
          intakeSessionId,
          issuedToken.hash,
          data.locale,
          expiresAt,
          createdAt,
          createdAt,
        ],
      },
      {
        sql: `
          UPDATE intake_sessions
          SET row_version = 2, updated_at = ?
          WHERE id = ? AND status = 'draft' AND row_version = 1
        `,
        args: [createdAt, intakeSessionId],
      },
      {
        sql: `
          INSERT INTO intake_answers (
            id, intake_session_id, question_key, question_version, answer_json,
            data_classification, created_at, updated_at
          ) VALUES (?, ?, 'summary', '1', ?, 'confidential', ?, ?)
        `,
        args: [
          answerId,
          intakeSessionId,
          JSON.stringify("Meridian Assistant guest consultation"),
          createdAt,
          createdAt,
        ],
      },
      {
        sql: `
          UPDATE intake_sessions
          SET status = 'submitted', submitted_at = ?, row_version = 3, updated_at = ?
          WHERE id = ? AND status = 'draft' AND row_version = 2
        `,
        args: [createdAt, createdAt, intakeSessionId],
      },
      {
        sql: `
          INSERT INTO cases (
            id, case_reference, intake_session_id, client_account_id,
            created_by_user_id, submission_idempotency_key, title,
            primary_jurisdiction, tax_topics_json, tax_period_start,
            tax_period_end, status, risk_level, resolution_code, resolution_note,
            row_version, received_at, resolved_at, closed_at, created_at, updated_at
          ) VALUES (?, ?, ?, NULL, NULL, ?, 'Meridian Assistant consultation',
                    'ID', ?, NULL, NULL, 'received', 'unknown', NULL, NULL,
                    1, ?, NULL, NULL, ?, ?)
        `,
        args: [
          caseId,
          caseReference,
          intakeSessionId,
          `assistant-session:${intakeSessionId}`,
          JSON.stringify([...new Set(taxTopics)]),
          createdAt,
          createdAt,
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO conversations (
            id, case_id, channel, status, created_by_user_id, created_at, closed_at
          ) VALUES (?, ?, 'client', 'open', NULL, ?, NULL)
        `,
        args: [clientConversationId, caseId, createdAt],
      },
      {
        sql: `
          INSERT INTO conversations (
            id, case_id, channel, status, created_by_user_id, created_at, closed_at
          ) VALUES (?, ?, 'internal', 'open', NULL, ?, NULL)
        `,
        args: [internalConversationId, caseId, createdAt],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, NULL, 'guest', NULL, ?, 'intake.created', 'intake_session',
                    ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          intakeSessionId,
          intakeSessionId,
          actor.requestId,
          JSON.stringify(["status", "intake_schema_version", "locale"]),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, NULL, 'guest', NULL, ?, 'intake.answer_saved', 'intake_answer',
                    ?, ?, NULL, ?, ?, ?)
        `,
        args: [
          createId(),
          intakeSessionId,
          answerId,
          actor.requestId,
          JSON.stringify(["question_version", "answer_json", "data_classification"]),
          JSON.stringify({ questionKey: "summary" }),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'guest', NULL, ?, 'intake.submitted', 'intake_session',
                    ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          intakeSessionId,
          intakeSessionId,
          actor.requestId,
          JSON.stringify(["status", "submitted_at", "row_version"]),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'guest', NULL, ?, 'case.created', 'case', ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          intakeSessionId,
          caseId,
          actor.requestId,
          JSON.stringify(["status", "client_account_id", "primary_jurisdiction"]),
          createdAt,
        ],
      },
    ], "write");

    return {
      intakeSessionId,
      caseId,
      caseReference,
      conversationId: clientConversationId,
      status: "received",
      guestToken: issuedToken.token,
    };
  }

  async restore(actor: Actor): Promise<AssistantSessionDto> {
    const cases = new CasesRepository(this.database);
    const conversations = new ConversationsRepository(this.database);
    if (actor.kind === "guest") {
      const result = await this.database.execute({
        sql: `
          SELECT
            intake.id AS intake_session_id,
            intake.guest_token_hash,
            intake.expires_at,
            intake.status AS intake_status,
            case_record.id AS case_id,
            case_record.case_reference,
            case_record.status AS case_status,
            conversation.id AS conversation_id
          FROM intake_sessions AS intake
          LEFT JOIN cases AS case_record
            ON case_record.intake_session_id = intake.id
          LEFT JOIN conversations AS conversation
            ON conversation.case_id = case_record.id
           AND conversation.channel = 'client'
          WHERE intake.id = ?
          LIMIT 1
        `,
        args: [actor.intakeSessionId],
      });
      const row = result.rows[0];
      if (!row) throw new DomainError("NOT_FOUND", "Intake session was not found");

      const guestTokenHash = row.guest_token_hash === null ? null : String(row.guest_token_hash);
      const expiresAt = row.expires_at === null ? null : String(row.expires_at);
      const intakeStatus = String(row.intake_status);
      const validToken = guestTokenHash === this.guestTokens.hash(actor.token);
      const expired = expiresAt !== null && new Date(expiresAt).getTime() <= Date.now();
      if (!validToken || expired || intakeStatus === "expired") {
        throw new DomainError("FORBIDDEN", "The guest intake credential is invalid");
      }

      if (row.case_id === null) {
        throw new DomainError("NOT_FOUND", "Guest assistant case was not found");
      }
      if (row.conversation_id === null) {
        throw new DomainError("INVALID_STATE", "Client conversation is missing");
      }
      return {
        intakeSessionId: String(row.intake_session_id),
        caseId: String(row.case_id),
        caseReference: String(row.case_reference),
        conversationId: String(row.conversation_id),
        status: String(row.case_status),
      };
    }

    if (actor.kind === "user") {
      const policy = new AuthorizationPolicy(this.database, this.guestTokens);
      await policy.requireActiveUser(actor);
      const [caseRecord] = await cases.listClientCasesForUser(actor.userId);
      if (!caseRecord) throw new DomainError("NOT_FOUND", "No consultation was found");
      const conversation = await conversations.findConversationByChannel(caseRecord.id, "client");
      if (!conversation) throw new DomainError("INVALID_STATE", "Client conversation is missing");
      return {
        intakeSessionId: caseRecord.intakeSessionId,
        caseId: caseRecord.id,
        caseReference: caseRecord.caseReference,
        conversationId: conversation.id,
        status: caseRecord.status,
      };
    }

    throw new DomainError("UNAUTHENTICATED", "No assistant session credential was supplied");
  }

  private async openForUser(actor: UserActor, locale: "id" | "en"): Promise<AssistantSessionDto> {
    const users = new UsersRepository(this.database);
    const user = await users.findById(actor.userId);
    if (!user) throw new DomainError("UNAUTHENTICATED", "User was not found");

    const clientAccountResult = await this.database.execute({
      sql: `
        SELECT ca.id
        FROM client_accounts AS ca
        JOIN client_account_members AS cam ON cam.client_account_id = ca.id
        WHERE cam.user_id = ? AND cam.status = 'active' AND ca.status = 'active'
        ORDER BY ca.created_at ASC
        LIMIT 1
      `,
      args: [actor.userId],
    });

    let clientAccountId = clientAccountResult.rows[0]?.id ? String(clientAccountResult.rows[0].id) : undefined;
    if (!clientAccountId) {
      const clients = new ClientsRepository(this.database);
      const account = await clients.createAccount({
        accountType: "individual",
        legalName: user.displayName,
        displayName: user.displayName,
        countryCode: "ID",
        preferredLocale: locale,
        createdByUserId: user.id,
      });
      await clients.addMember({
        clientAccountId: account.id,
        userId: user.id,
        membershipRole: "owner",
        invitedByUserId: user.id,
      });
      clientAccountId = account.id;
    }

    const intakeSessionId = createId();
    const answerId = createId();
    const caseId = createId();
    const caseReference = createCaseReference();
    const clientConversationId = createId();
    const internalConversationId = createId();
    const caseMemberId = createId();
    const createdAt = nowIso();
    const taxTopics = this.safeTopics.includes(GENERAL_ASSISTANT_TOPIC)
      ? [GENERAL_ASSISTANT_TOPIC]
      : this.safeTopics.length > 0
        ? this.safeTopics
        : [GENERAL_ASSISTANT_TOPIC];

    await this.database.batch([
      {
        sql: `
          INSERT INTO intake_sessions (
            id, owner_user_id, guest_token_hash, intake_schema_version, locale,
            status, expires_at, submitted_at, row_version, created_at, updated_at
          ) VALUES (?, ?, NULL, 'v1', ?, 'draft', NULL, NULL, 1, ?, ?)
        `,
        args: [intakeSessionId, actor.userId, locale, createdAt, createdAt],
      },
      {
        sql: `
          UPDATE intake_sessions
          SET row_version = 2, updated_at = ?
          WHERE id = ? AND status = 'draft' AND row_version = 1
        `,
        args: [createdAt, intakeSessionId],
      },
      {
        sql: `
          INSERT INTO intake_answers (
            id, intake_session_id, question_key, question_version, answer_json,
            data_classification, created_at, updated_at
          ) VALUES (?, ?, 'summary', '1', ?, 'confidential', ?, ?)
        `,
        args: [
          answerId,
          intakeSessionId,
          JSON.stringify("Meridian Assistant consultation"),
          createdAt,
          createdAt,
        ],
      },
      {
        sql: `
          UPDATE intake_sessions
          SET status = 'submitted', submitted_at = ?, row_version = 3, updated_at = ?
          WHERE id = ? AND status = 'draft' AND row_version = 2
        `,
        args: [createdAt, createdAt, intakeSessionId],
      },
      {
        sql: `
          INSERT INTO cases (
            id, case_reference, intake_session_id, client_account_id,
            created_by_user_id, submission_idempotency_key, title,
            primary_jurisdiction, tax_topics_json, tax_period_start,
            tax_period_end, status, risk_level, resolution_code, resolution_note,
            row_version, received_at, resolved_at, closed_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'Meridian Assistant consultation',
                    'ID', ?, NULL, NULL, 'received', 'unknown', NULL, NULL,
                    1, ?, NULL, NULL, ?, ?)
        `,
        args: [
          caseId,
          caseReference,
          intakeSessionId,
          clientAccountId,
          actor.userId,
          `assistant-session:${intakeSessionId}`,
          JSON.stringify([...new Set(taxTopics)]),
          createdAt,
          createdAt,
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO case_members (
            id, case_id, user_id, case_role, added_by_user_id, reason,
            created_at, removed_at
          ) VALUES (?, ?, ?, 'client_owner', ?, 'assistant_intake', ?, NULL)
        `,
        args: [caseMemberId, caseId, actor.userId, actor.userId, createdAt],
      },
      {
        sql: `
          INSERT INTO conversations (
            id, case_id, channel, status, created_by_user_id, created_at, closed_at
          ) VALUES (?, ?, 'client', 'open', ?, ?, NULL)
        `,
        args: [clientConversationId, caseId, actor.userId, createdAt],
      },
      {
        sql: `
          INSERT INTO conversations (
            id, case_id, channel, status, created_by_user_id, created_at, closed_at
          ) VALUES (?, ?, 'internal', 'open', ?, ?, NULL)
        `,
        args: [internalConversationId, caseId, actor.userId, createdAt],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'user', ?, ?, 'intake.created', 'intake_session',
                    ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          actor.userId,
          actor.userId,
          intakeSessionId,
          actor.requestId,
          JSON.stringify(["status", "intake_schema_version", "locale"]),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'user', ?, ?, 'intake.submitted', 'intake_session',
                    ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          actor.userId,
          actor.userId,
          intakeSessionId,
          actor.requestId,
          JSON.stringify(["status", "submitted_at"]),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'user', ?, ?, 'case.created', 'case', ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          actor.userId,
          actor.userId,
          caseId,
          actor.requestId,
          JSON.stringify(["status", "client_account_id", "primary_jurisdiction"]),
          createdAt,
        ],
      },
      {
        sql: `
          INSERT INTO audit_events (
            id, case_id, actor_type, actor_user_id, actor_reference_id,
            event_type, target_type, target_id, request_id, reason_code,
            changed_fields_json, metadata_json, created_at
          ) VALUES (?, ?, 'user', ?, ?, 'case.member_assigned', 'case_member', ?, ?, NULL, ?, '{}', ?)
        `,
        args: [
          createId(),
          caseId,
          actor.userId,
          actor.userId,
          caseMemberId,
          actor.requestId,
          JSON.stringify(["case_role"]),
          createdAt,
        ],
      },
    ], "write");

    return {
      intakeSessionId,
      caseId,
      caseReference,
      conversationId: clientConversationId,
      status: "received",
    };
  }
}
