import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../auth/actor";
import { GuestTokenService } from "../auth/guest-token";
import { AuthorizationPolicy } from "../auth/policy";
import { ConversationsRepository } from "../db/repositories/conversations";
import { withWriteTransaction } from "../db/transaction";
import { AuditService } from "../domain/audit/service";
import { DomainError } from "../domain/shared/errors";
import type { ConversationChannel, Locale } from "../domain/shared/types";
import { parseInput } from "../validation/parse";
import { idSchema } from "../validation/schemas";

export interface MessageDto {
  id: string;
  authorType: "user" | "ai" | "system";
  authorUserId: string | null;
  bodyMarkdown: string;
  language: Locale;
  createdAt: string;
}

export interface ConversationMessagesDto {
  id: string;
  caseId: string;
  channel: ConversationChannel;
  status: "open" | "closed";
  messages: MessageDto[];
}

export class ConversationsDal {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async getMessages(actor: Actor, conversationId: string): Promise<ConversationMessagesDto> {
    const parsedConversationId = parseInput(idSchema, conversationId);
    return withWriteTransaction(this.database, async (transaction) => {
      const conversations = new ConversationsRepository(transaction);
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const audit = new AuditService(transaction);
      const conversation = await conversations.findConversationById(parsedConversationId);
      if (!conversation) {
        throw new DomainError("NOT_FOUND", "Conversation was not found");
      }
      await policy.requireConversationAccess(actor, conversation.caseId, conversation.channel);
      const messages = await conversations.listMessages(conversation.id);
      await audit.write(actor, {
        caseId: conversation.caseId,
        eventType: "conversation.viewed",
        targetType: "conversation",
        targetId: conversation.id,
        metadata: { channel: conversation.channel },
      });
      return {
        id: conversation.id,
        caseId: conversation.caseId,
        channel: conversation.channel,
        status: conversation.status,
        messages: messages.map((message) => ({
          id: message.id,
          authorType: message.authorType,
          authorUserId: message.authorUserId,
          bodyMarkdown: message.bodyMarkdown,
          language: message.language,
          createdAt: message.createdAt,
        })),
      };
    });
  }
}
