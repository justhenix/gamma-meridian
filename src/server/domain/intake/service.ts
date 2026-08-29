import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../../auth/actor";
import { AuthorizationPolicy } from "../../auth/policy";
import { GuestTokenService } from "../../auth/guest-token";
import { CasesRepository } from "../../db/repositories/cases";
import { ClientsRepository } from "../../db/repositories/clients";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { IntakeRepository } from "../../db/repositories/intake";
import { withWriteTransaction } from "../../db/transaction";
import { parseInput } from "../../validation/parse";
import {
  createIntakeSchema,
  idSchema,
  saveDraftAnswerSchema,
  submitIntakeSchema,
} from "../../validation/schemas";
import { AuditService } from "../audit/service";
import { DomainError } from "../shared/errors";
import { createCaseReference } from "../shared/ids";
import type {
  CaseRecord,
  IntakeAnswerRecord,
  IntakeSessionRecord,
  JsonValue,
} from "../shared/types";
import { getIntakeDefinition } from "./definitions";

const GUEST_INTAKE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface IntakeDto {
  id: string;
  intakeSchemaVersion: string;
  locale: "id" | "en";
  status: "draft" | "submitted" | "claimed" | "expired";
  expiresAt: string | null;
  rowVersion: number;
  answers: Array<{
    questionKey: string;
    questionVersion: string;
    answer: JsonValue;
  }>;
}

export interface CreatedIntakeDto {
  intake: IntakeDto;
  guestToken?: string;
}

export interface SubmittedCaseDto {
  id: string;
  caseReference: string;
  status: CaseRecord["status"];
  rowVersion: number;
  clientConversationId: string;
  internalConversationId: string;
}

function toIntakeDto(
  session: IntakeSessionRecord,
  answers: IntakeAnswerRecord[],
): IntakeDto {
  return {
    id: session.id,
    intakeSchemaVersion: session.intakeSchemaVersion,
    locale: session.locale,
    status: session.status,
    expiresAt: session.expiresAt,
    rowVersion: session.rowVersion,
    answers: answers.map((answer) => ({
      questionKey: answer.questionKey,
      questionVersion: answer.questionVersion,
      answer: answer.answer,
    })),
  };
}

function answerHasValue(value: JsonValue): boolean {
  if (value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value).length > 0;
  return true;
}

export class IntakeService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async createIntake(actor: Actor, input: unknown): Promise<CreatedIntakeDto> {
    const data = parseInput(createIntakeSchema, input);
    const definition = getIntakeDefinition(data.intakeSchemaVersion);
    if (!definition) {
      throw new DomainError("VALIDATION_ERROR", "Unsupported intake schema version");
    }
    if (actor.kind !== "anonymous" && actor.kind !== "user") {
      throw new DomainError("FORBIDDEN", "This actor cannot create an intake");
    }

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const repository = new IntakeRepository(transaction);
      const audit = new AuditService(transaction);

      if (actor.kind === "user") {
        await policy.requireActiveUser(actor);
      }

      const issuedToken = actor.kind === "anonymous" ? this.guestTokens.issue() : null;
      const expiresAt = issuedToken
        ? new Date(Date.now() + GUEST_INTAKE_TTL_MS).toISOString()
        : null;
      const session = await repository.createSession({
        ownerUserId: actor.kind === "user" ? actor.userId : null,
        guestTokenHash: issuedToken?.hash ?? null,
        intakeSchemaVersion: data.intakeSchemaVersion,
        locale: data.locale,
        expiresAt,
      });

      await audit.write(actor, {
        actorReferenceId: actor.kind === "anonymous" ? session.id : null,
        eventType: "intake.created",
        targetType: "intake_session",
        targetId: session.id,
        changedFields: ["status", "intake_schema_version", "locale"],
      });

      return {
        intake: toIntakeDto(session, []),
        ...(issuedToken ? { guestToken: issuedToken.token } : {}),
      };
    });
  }

  async resumeIntake(actor: Actor, intakeSessionId: string): Promise<IntakeDto> {
    if (actor.kind !== "guest" && actor.kind !== "user") {
      throw new DomainError("FORBIDDEN", "This actor cannot resume an intake");
    }

    const parsedIntakeSessionId = parseInput(idSchema, intakeSessionId);
    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const repository = new IntakeRepository(transaction);
      const audit = new AuditService(transaction);
      const session = await policy.requireIntakeAccess(actor, parsedIntakeSessionId);
      const canReadAnswers = actor.kind === "user" || session.status === "draft";
      const answers = canReadAnswers ? await repository.listAnswers(session.id) : [];

      await audit.write(actor, {
        eventType: "intake.resumed",
        targetType: "intake_session",
        targetId: session.id,
      });
      return toIntakeDto(session, answers);
    });
  }

  async saveDraftAnswer(actor: Actor, input: unknown): Promise<IntakeDto> {
    const data = parseInput(saveDraftAnswerSchema, input);

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const repository = new IntakeRepository(transaction);
      const audit = new AuditService(transaction);
      const session = await policy.requireIntakeAccess(actor, data.intakeSessionId);
      const definition = getIntakeDefinition(session.intakeSchemaVersion);
      const question = definition?.questions[data.questionKey];

      if (!question || question.version !== data.questionVersion) {
        throw new DomainError("VALIDATION_ERROR", "Unknown intake question or version");
      }
      if (session.status !== "draft") {
        throw new DomainError("INVALID_STATE", "Submitted intake answers are immutable");
      }
      if (session.rowVersion !== data.expectedVersion) {
        throw new DomainError("CONFLICT", "The intake was changed by another request");
      }

      const advanced = await repository.advanceDraftVersion(
        session.id,
        data.expectedVersion,
      );
      if (!advanced) {
        throw new DomainError("CONFLICT", "The intake was changed by another request");
      }
      const answer = await repository.saveAnswer({
        intakeSessionId: session.id,
        questionKey: data.questionKey,
        questionVersion: data.questionVersion,
        answer: data.answer,
        dataClassification: data.dataClassification,
      });
      await audit.write(actor, {
        eventType: "intake.answer_saved",
        targetType: "intake_answer",
        targetId: answer.id,
        changedFields: ["question_version", "answer_json", "data_classification"],
        metadata: { questionKey: data.questionKey },
      });

      const updatedSession = (await repository.findSessionById(session.id))!;
      return toIntakeDto(updatedSession, await repository.listAnswers(session.id));
    });
  }

  async submitIntake(actor: Actor, input: unknown): Promise<SubmittedCaseDto> {
    const data = parseInput(submitIntakeSchema, input);

    return withWriteTransaction(this.database, async (transaction) => {
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const intakes = new IntakeRepository(transaction);
      const cases = new CasesRepository(transaction);
      const clients = new ClientsRepository(transaction);
      const conversations = new ConversationsRepository(transaction);
      const audit = new AuditService(transaction);
      const session = await policy.requireIntakeAccess(actor, data.intakeSessionId);

      const existingCase = await cases.findCaseByIntakeSession(session.id);
      if (existingCase) {
        if (existingCase.submissionIdempotencyKey !== data.idempotencyKey) {
          throw new DomainError("CONFLICT", "The intake was already submitted");
        }
        return this.toSubmittedCaseDto(existingCase, conversations);
      }

      if (session.status !== "draft") {
        throw new DomainError("INVALID_STATE", "Only a draft intake can be submitted");
      }
      if (session.rowVersion !== data.expectedVersion) {
        throw new DomainError("CONFLICT", "The intake was changed by another request");
      }

      const definition = getIntakeDefinition(session.intakeSchemaVersion)!;
      const answers = await intakes.listAnswers(session.id);
      const answersByKey = new Map(answers.map((answer) => [answer.questionKey, answer]));
      for (const [key, question] of Object.entries(definition.questions)) {
        if (question.required && !answerHasValue(answersByKey.get(key)?.answer ?? null)) {
          throw new DomainError("VALIDATION_ERROR", `Required intake answer is missing: ${key}`);
        }
      }

      let createdByUserId: string | null = null;
      let initialCaseRole: "client_owner" | "lead_consultant" | null = null;
      if (actor.kind === "user") {
        const user = await policy.requireActiveUser(actor);
        createdByUserId = user.id;
        if (user.globalRole === "client") {
          if (!data.clientAccountId) {
            throw new DomainError("VALIDATION_ERROR", "Client account is required");
          }
          await policy.requireActiveClientMembership(user.id, data.clientAccountId);
          initialCaseRole = "client_owner";
        } else if (user.globalRole === "consultant") {
          if (data.clientAccountId) {
            throw new DomainError(
              "FORBIDDEN",
              "Consultants need an admin assignment before accessing a client account case",
            );
          }
          initialCaseRole = "lead_consultant";
        }
      } else if (data.clientAccountId) {
        throw new DomainError("FORBIDDEN", "Guests cannot bind an intake to a client account");
      }

      if (data.clientAccountId) {
        const account = await clients.findAccountById(data.clientAccountId);
        if (!account || account.status !== "active") {
          throw new DomainError("NOT_FOUND", "Client account was not found");
        }
      }

      const submitted = await intakes.markSubmitted(session.id, data.expectedVersion);
      if (!submitted) {
        throw new DomainError("CONFLICT", "The intake was changed by another request");
      }

      const caseRecord = await cases.createCase({
        caseReference: createCaseReference(),
        intakeSessionId: session.id,
        clientAccountId: data.clientAccountId ?? null,
        createdByUserId,
        submissionIdempotencyKey: data.idempotencyKey,
        title: data.title,
        primaryJurisdiction: data.primaryJurisdiction,
        taxTopics: [...new Set(data.taxTopics)],
        taxPeriodStart: data.taxPeriodStart ?? null,
        taxPeriodEnd: data.taxPeriodEnd ?? null,
      });

      if (createdByUserId && initialCaseRole) {
        const member = await cases.upsertMember({
          caseId: caseRecord.id,
          userId: createdByUserId,
          caseRole: initialCaseRole,
          addedByUserId: createdByUserId,
          reason: "case_creator",
        });
        await audit.write(actor, {
          caseId: caseRecord.id,
          eventType: "case.member_assigned",
          targetType: "case_member",
          targetId: member.id,
          reasonCode: "case_creator",
          changedFields: ["case_role"],
          metadata: { caseRole: initialCaseRole },
        });
      }

      const clientConversation = await conversations.createConversation({
        caseId: caseRecord.id,
        channel: "client",
        createdByUserId,
      });
      const internalConversation = await conversations.createConversation({
        caseId: caseRecord.id,
        channel: "internal",
        createdByUserId,
      });

      await audit.write(actor, {
        caseId: caseRecord.id,
        eventType: "intake.submitted",
        targetType: "intake_session",
        targetId: session.id,
        changedFields: ["status", "submitted_at", "row_version"],
      });
      await audit.write(actor, {
        caseId: caseRecord.id,
        eventType: "case.created",
        targetType: "case",
        targetId: caseRecord.id,
        changedFields: ["status", "client_account_id", "primary_jurisdiction"],
      });

      return {
        id: caseRecord.id,
        caseReference: caseRecord.caseReference,
        status: caseRecord.status,
        rowVersion: caseRecord.rowVersion,
        clientConversationId: clientConversation.id,
        internalConversationId: internalConversation.id,
      };
    });
  }

  private async toSubmittedCaseDto(
    caseRecord: CaseRecord,
    conversations: ConversationsRepository,
  ): Promise<SubmittedCaseDto> {
    const client = await conversations.findConversationByChannel(caseRecord.id, "client");
    const internal = await conversations.findConversationByChannel(caseRecord.id, "internal");
    if (!client || !internal) {
      throw new DomainError("INVALID_STATE", "Case conversations are missing");
    }
    return {
      id: caseRecord.id,
      caseReference: caseRecord.caseReference,
      status: caseRecord.status,
      rowVersion: caseRecord.rowVersion,
      clientConversationId: client.id,
      internalConversationId: internal.id,
    };
  }
}
