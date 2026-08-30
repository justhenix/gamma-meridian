import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../auth/actor";
import type { GuestTokenService } from "../auth/guest-token";
import { AuthorizationPolicy } from "../auth/policy";
import { CasesRepository } from "../db/repositories/cases";
import { ConversationsRepository } from "../db/repositories/conversations";
import { UsersRepository } from "../db/repositories/users";
import { DomainError } from "../domain/shared/errors";
import type { CaseRecord, CaseStatus } from "../domain/shared/types";
import { parseInput } from "../validation/parse";
import { idSchema } from "../validation/schemas";

export type ClientConsultationStatus =
  | "Under review"
  | "Expert reviewing"
  | "Action needed"
  | "Completed";

function clientStatus(status: CaseStatus): ClientConsultationStatus {
  switch (status) {
    case "human_review_required":
    case "consultant_working":
      return "Expert reviewing";
    case "waiting_for_client":
      return "Action needed";
    case "resolved":
    case "closed":
      return "Completed";
    case "received":
    default:
      return "Under review";
  }
}

function toListItem(record: CaseRecord) {
  return {
    caseId: record.id,
    caseReference: record.caseReference,
    title: record.title,
    clientStatus: clientStatus(record.status),
    updatedAt: record.updatedAt,
  };
}

export class ConsultationsDal {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async list(actor: Actor) {
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const user = await policy.requireActiveUser(actor);
    if (user.globalRole !== "client") {
      throw new DomainError("FORBIDDEN", "Client consultations are available to client users only");
    }
    const records = await new CasesRepository(this.database).listClientCasesForUser(user.id);
    return records.map(toListItem);
  }

  async get(actor: Actor, caseId: string) {
    const parsedCaseId = parseInput(idSchema, caseId);
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const access = await policy.requireCaseAccess(actor, parsedCaseId);
    if (!['client_owner', 'client_collaborator'].includes(access.membership.caseRole)) {
      throw new DomainError("FORBIDDEN", "This endpoint is limited to client case members");
    }
    const conversations = new ConversationsRepository(this.database);
    const conversation = await conversations.findConversationByChannel(parsedCaseId, "client");
    if (!conversation) throw new DomainError("INVALID_STATE", "Client conversation is missing");
    const messages = await conversations.listMessages(conversation.id);
    const users = new UsersRepository(this.database);
    const safeMessages = await Promise.all(messages.map(async (message) => {
      if (message.authorType === "ai") {
        return {
          id: message.id,
          sender: "ai" as const,
          bodyMarkdown: message.bodyMarkdown,
          language: message.language,
          createdAt: message.createdAt,
          authorName: null,
        };
      }
      if (message.authorType === "system") {
        return {
          id: message.id,
          sender: "system" as const,
          bodyMarkdown: message.bodyMarkdown,
          language: message.language,
          createdAt: message.createdAt,
          authorName: null,
        };
      }
      const author = message.authorUserId ? await users.findById(message.authorUserId) : null;
      const staff = author?.globalRole === "consultant" || author?.globalRole === "admin";
      return {
        id: message.id,
        sender: staff ? "staff" as const : "client" as const,
        bodyMarkdown: message.bodyMarkdown,
        language: message.language,
        createdAt: message.createdAt,
        authorName: staff ? author?.displayName ?? null : null,
      };
    }));
    return {
      ...toListItem(access.caseRecord),
      conversationId: conversation.id,
      messages: safeMessages,
    };
  }
}
