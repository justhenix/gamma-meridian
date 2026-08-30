import { z } from "zod";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { getDatabaseClient } from "@/server/db/client";
import { EscalationsService } from "@/server/domain/escalations/escalateConversation";
import {
  jsonResponse,
  readJsonBody,
  requireDevelopmentActor,
  routeError,
} from "../../../../_lib/backend";

export const runtime = "nodejs";

const bodySchema = z.object({
  caseId: z.uuid(),
  reason: z.string().trim().min(3).max(2000),
  reasonCodes: z.array(z.string().trim().min(1).max(120)).max(24).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = requireDevelopmentActor(request);
    const { conversationId } = await context.params;
    const body = bodySchema.parse(await readJsonBody(request));
    const result = await new EscalationsService(
      getDatabaseClient(),
      getGuestTokenService(),
      getAiRuntimeConfig(),
    ).escalateConversation(actor, { conversationId, ...body });
    return jsonResponse({
      id: result.id,
      caseId: result.caseId,
      conversationId: result.conversationId,
      status: result.status,
      severity: result.severity,
      reasonCodes: result.reasonCodes,
    }, 201);
  } catch (error) {
    return routeError(error);
  }
}
