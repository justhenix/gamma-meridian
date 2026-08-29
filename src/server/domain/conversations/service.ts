import "server-only";

import type { Client } from "@libsql/client";

import type { Actor } from "../../auth/actor";
import { GuestTokenService } from "../../auth/guest-token";
import { AuthorizationPolicy } from "../../auth/policy";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { withWriteTransaction } from "../../db/transaction";
import { parseInput } from "../../validation/parse";
import { sendMessageSchema } from "../../validation/schemas";
import { AuditService } from "../audit/service";
import { DomainError } from "../shared/errors";
import type { MessageRecord } from "../shared/types";

export class ConversationsService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
  ) {}

  async sendMessage(actor: Actor, input: unknown): Promise<MessageRecord> {
    const data = parseInput(sendMessageSchema, input);

    return withWriteTransaction(this.database, async (transaction) => {
      const conversations = new ConversationsRepository(transaction);
      const policy = new AuthorizationPolicy(transaction, this.guestTokens);
      const audit = new AuditService(transaction);
      const conversation = await conversations.findConversationById(data.conversationId);
      if (!conversation) {
        throw new DomainError("NOT_FOUND", "Conversation was not found");
      }
      if (conversation.status !== "open") {
        throw new DomainError("INVALID_STATE", "Conversation is closed");
      }

      const access = await policy.requireConversationAccess(
        actor,
        conversation.caseId,
        conversation.channel,
      );
      const existing = await conversations.findMessageByRequestId(
        conversation.id,
        data.clientRequestId,
      );
      if (existing) {
        if (
          existing.authorUserId !== access.user.id ||
          existing.bodyMarkdown !== data.bodyMarkdown ||
          existing.language !== data.language
        ) {
          throw new DomainError(
            "CONFLICT",
            "Message idempotency key was already used with different content",
          );
        }
        return existing;
      }

      const message = await conversations.createMessage({
        conversationId: conversation.id,
        authorType: "user",
        authorUserId: access.user.id,
        bodyMarkdown: data.bodyMarkdown,
        language: data.language,
        clientRequestId: data.clientRequestId,
      });
      await audit.write(actor, {
        caseId: conversation.caseId,
        eventType: "message.sent",
        targetType: "message",
        targetId: message.id,
        changedFields: ["body_markdown", "language"],
        metadata: { channel: conversation.channel },
      });
      return message;
    });
  }
}
