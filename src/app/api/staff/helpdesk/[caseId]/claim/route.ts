import { getGuestTokenService } from "@/server/auth/guest-token";
import { resolveRequestActor } from "@/server/auth/request";
import { getDatabaseClient } from "@/server/db/client";
import { StaffHelpdeskService } from "@/server/domain/helpdesk/service";
import { jsonResponse, routeError } from "../../../../_lib/backend";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ caseId: string }> },
) {
  try {
    const { caseId } = await context.params;
    const result = await new StaffHelpdeskService(
      getDatabaseClient(),
      getGuestTokenService(),
    ).claimCase(await resolveRequestActor(request), { caseId });
    return jsonResponse({ caseId: result.caseId, caseRole: result.caseRole });
  } catch (error) {
    return routeError(error);
  }
}
