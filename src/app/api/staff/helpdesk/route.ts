import { getGuestTokenService } from "@/server/auth/guest-token";
import { resolveRequestActor } from "@/server/auth/request";
import { StaffHelpdeskDal } from "@/server/dal/staff-helpdesk";
import { getDatabaseClient } from "@/server/db/client";
import { jsonResponse, routeError } from "../../_lib/backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const result = await new StaffHelpdeskDal(
      getDatabaseClient(),
      getGuestTokenService(),
    ).list(await resolveRequestActor(request));
    return jsonResponse({ cases: result });
  } catch (error) {
    return routeError(error);
  }
}
