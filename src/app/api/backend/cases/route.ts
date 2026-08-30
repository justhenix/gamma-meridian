import { getGuestTokenService } from "@/server/auth/guest-token";
import { getDatabaseClient } from "@/server/db/client";
import { createCaseConversation } from "@/server/domain/cases/createCaseConversation";
import {
  jsonResponse,
  readJsonBody,
  requireDevelopmentActor,
  routeError,
} from "../../_lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const actor = requireDevelopmentActor(request);
    const result = await createCaseConversation(
      getDatabaseClient(),
      getGuestTokenService(),
      actor,
      await readJsonBody(request),
    );
    return jsonResponse(result, 201);
  } catch (error) {
    return routeError(error);
  }
}
