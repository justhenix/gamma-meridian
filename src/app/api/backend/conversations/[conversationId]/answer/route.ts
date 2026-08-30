import { z } from "zod";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { getDatabaseClient } from "@/server/db/client";
import { AnswerCaseQuestionService } from "@/server/domain/ai/answerCaseQuestion";
import { getBaiAiProvider } from "@/server/integrations/ai/bai";
import {
  jsonResponse,
  readJsonBody,
  requireDevelopmentActor,
  routeError,
} from "../../../../_lib/backend";

export const runtime = "nodejs";

const bodySchema = z.object({
  caseId: z.uuid(),
  userMessageId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
  relevantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ conversationId: string }> },
) {
  try {
    const actor = requireDevelopmentActor(request);
    const { conversationId } = await context.params;
    const body = bodySchema.parse(await readJsonBody(request));
    const result = await new AnswerCaseQuestionService(
      getDatabaseClient(),
      getGuestTokenService(),
      getBaiAiProvider(),
      getAiRuntimeConfig(),
    ).answerCaseQuestion(actor, { conversationId, ...body });
    return jsonResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
