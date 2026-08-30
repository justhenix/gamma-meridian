import { getAuthTokenService } from "@/server/auth/auth-token";
import { getStaffEmailAllowlist } from "@/server/auth/staff-allowlist";
import { getEmailVerificationProvider } from "@/server/auth/verification-provider";
import { getDatabaseClient } from "@/server/db/client";
import { StaffAuthService } from "@/server/domain/auth/staff-service";
import { jsonResponse, readJsonBody, routeError } from "../../../../_lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await new StaffAuthService(
      getDatabaseClient(),
      getAuthTokenService(),
      getEmailVerificationProvider(),
      getStaffEmailAllowlist(),
    ).startVerification(await readJsonBody(request));
    return jsonResponse(result, 201);
  } catch (error) {
    return routeError(error);
  }
}
