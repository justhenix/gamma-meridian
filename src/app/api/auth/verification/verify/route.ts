import { cookies } from "next/headers";

import { getAuthTokenService } from "@/server/auth/auth-token";
import { getGuestTokenService } from "@/server/auth/guest-token";
import {
  AUTH_COOKIE_NAME,
  GUEST_COOKIE_NAME,
  resolveRequestActor,
} from "@/server/auth/request";
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
    ).verify(await resolveRequestActor(request), await readJsonBody(request));
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(result.sessionExpiresAt),
    });
    if (result.claim) cookieStore.delete(GUEST_COOKIE_NAME);
    return jsonResponse({
      user: {
        displayName: result.user.displayName,
        email: result.user.email,
      },
      ...(result.claim ? { claim: result.claim } : {}),
    });
  } catch (error) {
    return routeError(error);
  }
}
