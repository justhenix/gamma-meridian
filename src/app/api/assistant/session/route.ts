import { cookies } from "next/headers";

import { GUEST_COOKIE_NAME, resolveRequestActor } from "@/server/auth/request";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { ConsultationsDal } from "@/server/dal/consultations";
import { getDatabaseClient } from "@/server/db/client";
import { ConversationsRepository } from "@/server/db/repositories/conversations";
import { AssistantSessionService } from "@/server/domain/assistant/session-service";
import { jsonResponse, readJsonBody, routeError } from "../../_lib/backend";

export const runtime = "nodejs";

async function responseFor(actor: Awaited<ReturnType<typeof resolveRequestActor>>, session: {
  caseId: string;
  caseReference: string;
  conversationId: string;
  status: string;
}) {
  const database = getDatabaseClient();
  const guestTokens = getGuestTokenService();
  if (actor.kind === "user") {
    const detail = await new ConsultationsDal(database, guestTokens).get(actor, session.caseId);
    return {
      caseId: session.caseId,
      conversationId: session.conversationId,
      caseReference: session.caseReference,
      status: session.status,
      messages: detail.messages,
    };
  }
  const messages = await new ConversationsRepository(database).listMessages(session.conversationId);
  return {
    caseId: session.caseId,
    conversationId: session.conversationId,
    caseReference: session.caseReference,
    status: session.status,
    messages: messages.map((message) => ({
      id: message.id,
      sender: message.authorType === "ai" ? "ai" : message.authorType === "system" ? "system" : "client",
      bodyMarkdown: message.bodyMarkdown,
      language: message.language,
      createdAt: message.createdAt,
      authorName: null,
    })),
  };
}

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const service = new AssistantSessionService(
      getDatabaseClient(),
      getGuestTokenService(),
      getAiRuntimeConfig().safeTopics,
    );
    const session = await service.restore(actor);
    return jsonResponse(await responseFor(actor, session));
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    const body = request.headers.get("content-length") === "0"
      ? {}
      : await readJsonBody(request).catch(() => ({}));
    const service = new AssistantSessionService(
      getDatabaseClient(),
      getGuestTokenService(),
      getAiRuntimeConfig().safeTopics,
    );
    const session = await service.open(actor, body);
    if (session.guestToken) {
      const cookieStore = await cookies();
      cookieStore.set(GUEST_COOKIE_NAME, session.guestToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });
      return jsonResponse({
        caseId: session.caseId,
        conversationId: session.conversationId,
        caseReference: session.caseReference,
        status: session.status,
        messages: [],
      }, 201);
    }
    return jsonResponse(await responseFor(actor, session));
  } catch (error) {
    return routeError(error);
  }
}
