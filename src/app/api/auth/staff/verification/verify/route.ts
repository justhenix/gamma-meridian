import { cookies } from "next/headers";

import { getAuthTokenService } from "@/server/auth/auth-token";
import { AUTH_COOKIE_NAME } from "@/server/auth/request";
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
    ).verify(await readJsonBody(request));
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, result.sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      expires: new Date(result.sessionExpiresAt),
    });
    return jsonResponse({ user: result.user });
  } catch (error) {
    return routeError(error);
  }
}
