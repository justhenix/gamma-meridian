import { getAuthTokenService } from "@/server/auth/auth-token";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { resolveRequestActor } from "@/server/auth/request";
import { getEmailVerificationProvider } from "@/server/auth/verification-provider";
import { getAiRuntimeConfig } from "@/server/config/ai";
import { getDatabaseClient } from "@/server/db/client";
import { AuthService } from "@/server/domain/auth/service";
import { jsonResponse, readJsonBody, routeError } from "../../../_lib/backend";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const result = await new AuthService(
      getDatabaseClient(),
      getGuestTokenService(),
      getAuthTokenService(),
      getEmailVerificationProvider(),
      getAiRuntimeConfig(),
    ).startVerification(await resolveRequestActor(request), await readJsonBody(request));
    return jsonResponse(result, 201);
  } catch (error) {
    return routeError(error);
  }
}
