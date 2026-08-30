import { getGuestTokenService } from "@/server/auth/guest-token";
import { CasesDal } from "@/server/dal/cases";
import { getDatabaseClient } from "@/server/db/client";
import {
  jsonResponse,
  requireDevelopmentActor,
  routeError,
} from "../../../_lib/backend";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const actor = requireDevelopmentActor(request);
    const { caseId } = await context.params;
    const result = await new CasesDal(
      getDatabaseClient(),
      getGuestTokenService(),
    ).getCase(actor, caseId);
    return jsonResponse(result);
  } catch (error) {
    return routeError(error);
  }
}
