import "server-only";

import type { Row } from "@libsql/client";

import { createId, nowIso } from "../../domain/shared/ids";
import type {
  ConversationChannel,
  ConversationRecord,
  Locale,
  MessageRecord,
} from "../../domain/shared/types";
import { optionalString, requiredString } from "../row";
import type { SqlExecutor } from "../types";

function mapConversation(row: Row): ConversationRecord {
  return {
    id: requiredString(row, "id"),
    caseId: requiredString(row, "case_id"),
    channel: requiredString(row, "channel") as ConversationChannel,
    status: requiredString(row, "status") as "open" | "closed",
    createdByUserId: optionalString(row, "created_by_user_id"),
    createdAt: requiredString(row, "created_at"),
    closedAt: optionalString(row, "closed_at"),
  };
}

function mapMessage(row: Row): MessageRecord {
  return {
    id: requiredString(row, "id"),
    conversationId: requiredString(row, "conversation_id"),
    authorType: requiredString(row, "author_type") as "user" | "ai" | "system",
    authorUserId: optionalString(row, "author_user_id"),
    authorGuestSessionId: optionalString(row, "author_guest_session_id"),
    aiRunId: optionalString(row, "ai_run_id"),
    bodyMarkdown: requiredString(row, "body_markdown"),
    language: requiredString(row, "language") as Locale,
    clientRequestId: requiredString(row, "client_request_id"),
    createdAt: requiredString(row, "created_at"),
  };
}

export class ConversationsRepository {
  constructor(private readonly database: SqlExecutor) {}

  async createConversation(input: {
    caseId: string;
    channel: ConversationChannel;
    createdByUserId: string | null;
  }): Promise<ConversationRecord> {
    const id = createId();
    await this.database.execute({
      sql: `
        INSERT INTO conversations (
          id, case_id, channel, status, created_by_user_id, created_at, closed_at
        ) VALUES (?, ?, ?, 'open', ?, ?, NULL)
      `,
      args: [id, input.caseId, input.channel, input.createdByUserId, nowIso()],
    });
    return (await this.findConversationById(id))!;
  }

  async findConversationById(id: string): Promise<ConversationRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, channel, status, created_by_user_id, created_at, closed_at
        FROM conversations
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async findConversationByChannel(
    caseId: string,
    channel: ConversationChannel,
  ): Promise<ConversationRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, case_id, channel, status, created_by_user_id, created_at, closed_at
        FROM conversations
        WHERE case_id = ? AND channel = ?
      `,
      args: [caseId, channel],
    });
    return result.rows[0] ? mapConversation(result.rows[0]) : null;
  }

  async createMessage(input: {
    conversationId: string;
    authorType: "user" | "ai" | "system";
    authorUserId: string | null;
    authorGuestSessionId?: string | null;
    aiRunId?: string | null;
    bodyMarkdown: string;
    language: Locale;
    clientRequestId: string;
  }): Promise<MessageRecord> {
    const id = createId();
    const createdAt = nowIso();
    const result = await this.database.execute({
      sql: `
        INSERT OR IGNORE INTO messages (
          id, conversation_id, author_type, author_user_id, author_guest_session_id, ai_run_id,
          body_markdown, language, client_request_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        id,
        input.conversationId,
        input.authorType,
        input.authorUserId,
        input.authorGuestSessionId ?? null,
        input.aiRunId ?? null,
        input.bodyMarkdown,
        input.language,
        input.clientRequestId,
        createdAt,
      ],
    });
    if (result.rowsAffected !== 1) {
      const existing = await this.findMessageByRequestId(input.conversationId, input.clientRequestId);
      if (!existing) throw new Error("Failed to create or recover conversation message");
      return existing;
    }
    return {
      id,
      conversationId: input.conversationId,
      authorType: input.authorType,
      authorUserId: input.authorUserId,
      authorGuestSessionId: input.authorGuestSessionId ?? null,
      aiRunId: input.aiRunId ?? null,
      bodyMarkdown: input.bodyMarkdown,
      language: input.language,
      clientRequestId: input.clientRequestId,
      createdAt,
    };
  }

  async findMessageById(id: string): Promise<MessageRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, conversation_id, author_type, author_user_id, author_guest_session_id, ai_run_id,
               body_markdown, language, client_request_id, created_at
        FROM messages
        WHERE id = ?
      `,
      args: [id],
    });
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  }

  async findMessageByRequestId(
    conversationId: string,
    clientRequestId: string,
  ): Promise<MessageRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, conversation_id, author_type, author_user_id, author_guest_session_id, ai_run_id,
               body_markdown, language, client_request_id, created_at
        FROM messages
        WHERE conversation_id = ? AND client_request_id = ?
      `,
      args: [conversationId, clientRequestId],
    });
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  }

  async findMessageByAiRun(aiRunId: string): Promise<MessageRecord | null> {
    const result = await this.database.execute({
      sql: `
        SELECT id, conversation_id, author_type, author_user_id, author_guest_session_id, ai_run_id,
               body_markdown, language, client_request_id, created_at
        FROM messages
        WHERE ai_run_id = ?
        LIMIT 1
      `,
      args: [aiRunId],
    });
    return result.rows[0] ? mapMessage(result.rows[0]) : null;
  }

  async listMessages(conversationId: string): Promise<MessageRecord[]> {
    const result = await this.database.execute({
      sql: `
        SELECT id, conversation_id, author_type, author_user_id, author_guest_session_id, ai_run_id,
               body_markdown, language, client_request_id, created_at
        FROM messages
        WHERE conversation_id = ?
        ORDER BY created_at, id
      `,
      args: [conversationId],
    });
    return result.rows.map(mapMessage);
  }

  async hasStaffMessageInClientConversation(caseId: string): Promise<boolean> {
    const result = await this.database.execute({
      sql: `
        SELECT 1
        FROM messages AS message
        JOIN conversations AS conversation ON conversation.id = message.conversation_id
        JOIN users AS author ON author.id = message.author_user_id
        WHERE conversation.case_id = ?
          AND conversation.channel = 'client'
          AND message.author_type = 'user'
          AND author.global_role IN ('consultant', 'admin')
        LIMIT 1
      `,
      args: [caseId],
    });
    return result.rows.length === 1;
  }
}
