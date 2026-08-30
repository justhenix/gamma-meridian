import { resolveRequestActor } from "@/server/auth/request";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { getDatabaseClient } from "@/server/db/client";
import { AssistantMessageService } from "@/server/domain/assistant/message-service";
import { getBaiAiProvider } from "@/server/integrations/ai/bai";
import { jsonResponse, readJsonBody, routeError } from "../../_lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const result = await new AssistantMessageService(
      getDatabaseClient(),
      getGuestTokenService(),
      getBaiAiProvider(),
      getAiRuntimeConfig(),
    ).sendAndAnswer(actor, await readJsonBody(request));
    return jsonResponse({
      userMessage: {
        id: result.userMessage.id,
        conversationId: result.userMessage.conversationId,
        bodyMarkdown: result.userMessage.bodyMarkdown,
        language: result.userMessage.language,
        createdAt: result.userMessage.createdAt,
      },
      answer: result.answer,
    }, 201);
  } catch (error) {
    return routeError(error);
  }
}
