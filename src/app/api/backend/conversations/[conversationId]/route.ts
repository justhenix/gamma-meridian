import { getGuestTokenService } from "@/server/auth/guest-token";
import { ConversationsDal } from "@/server/dal/conversations";
import { getDatabaseClient } from "@/server/db/client";
import {
  jsonResponse,
  resolveBackendActor,
  routeError,
} from "../../../_lib/backend";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = await resolveBackendActor(request);
    const { conversationId } = await context.params;
    const result = await new ConversationsDal(
      getDatabaseClient(),
      getGuestTokenService(),
    ).getMessages(actor, conversationId);
    return jsonResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
