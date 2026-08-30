import { getGuestTokenService } from "@/server/auth/guest-token";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { getDatabaseClient } from "@/server/db/client";
import { EscalationsService } from "@/server/domain/escalations/escalateConversation";
import {
  jsonResponse,
  requireDevelopmentActor,
  routeError,
} from "../../../../_lib/backend";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const actor = requireDevelopmentActor(request);
    const { caseId } = await context.params;
    const result = await new EscalationsService(
      getDatabaseClient(),
      getGuestTokenService(),
      getAiRuntimeConfig(),
    ).getActiveEscalationContext(actor, caseId);
    return jsonResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
