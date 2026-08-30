import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor } from "../../auth/actor";
import type { GuestTokenService } from "../../auth/guest-token";
import type { AiRuntimeConfig } from "../../config/ai";
import type { AiProvider } from "../../integrations/ai/provider";
import { AnswerCaseQuestionService } from "../ai/answerCaseQuestion";
import { ConversationsService } from "../conversations/service";

const assistantMessageSchema = z.object({
  conversationId: z.uuid(),
  bodyMarkdown: z.string().trim().min(1).max(20000),
  language: z.enum(["id", "en"]),
  clientRequestId: z.string().trim().min(8).max(160),
});

export class AssistantMessageService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
    private readonly provider: AiProvider,
    private readonly runtimeConfig: AiRuntimeConfig,
  ) {}

  async sendAndAnswer(actor: Actor, input: unknown) {
    const data = assistantMessageSchema.parse(input);
    const userMessage = await new ConversationsService(this.database, this.guestTokens).sendMessage(
      actor,
      data,
    );
    const answer = await new AnswerCaseQuestionService(
      this.database,
      this.guestTokens,
      this.provider,
      this.runtimeConfig,
    ).answerCaseQuestion(actor, {
      caseId: userMessage.caseId,
      conversationId: data.conversationId,
      userMessageId: userMessage.id,
      idempotencyKey: `assistant-answer:${userMessage.id}`,
    });
    return { userMessage, answer };
  }
}
