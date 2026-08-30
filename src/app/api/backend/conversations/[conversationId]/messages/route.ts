import { z } from "zod";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getDatabaseClient } from "@/server/db/client";
import { ConversationsService } from "@/server/domain/conversations/service";
import {
  jsonResponse,
  readJsonBody,
  resolveBackendActor,
  routeError,
} from "../../../../_lib/backend";

export const runtime = "nodejs";

const bodySchema = z.object({
  bodyMarkdown: z.string().trim().min(1).max(20000),
  language: z.enum(["id", "en"]),
  clientRequestId: z.string().trim().min(8).max(160),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = await resolveBackendActor(request);
    const { conversationId } = await context.params;
    const body = bodySchema.parse(await readJsonBody(request));
    const result = await new ConversationsService(
      getDatabaseClient(),
      getGuestTokenService(),
    ).sendMessage(actor, { conversationId, ...body });
    return jsonResponse({
      id: result.id,
      conversationId: result.conversationId,
      authorType: result.authorType,
      bodyMarkdown: result.bodyMarkdown,
      language: result.language,
      createdAt: result.createdAt,
    }, 201);
  } catch (error) {
    return routeError(error);
  }
}
