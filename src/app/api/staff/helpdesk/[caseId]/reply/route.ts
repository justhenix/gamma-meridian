import { getGuestTokenService } from "@/server/auth/guest-token";
import { resolveRequestActor } from "@/server/auth/request";
import { getDatabaseClient } from "@/server/db/client";
import { StaffHelpdeskService } from "@/server/domain/helpdesk/service";
import { jsonResponse, readJsonBody, routeError } from "../../../../_lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const body = await readJsonBody(request) as Record<string, unknown>;
    const result = await new StaffHelpdeskService(
      getDatabaseClient(),
      getGuestTokenService(),
    ).sendReply(await resolveRequestActor(request), { ...body, caseId });
    return jsonResponse({
      message: result.message,
      status: result.caseRecord.status,
      updatedAt: result.caseRecord.updatedAt,
    });
  } catch (error) {
    return routeError(error);
  }
}
