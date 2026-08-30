import { cookies } from "next/headers";
import { z } from "zod";

import { getAuthTokenService } from "@/server/auth/auth-token";
import { AUTH_COOKIE_NAME } from "@/server/auth/request";
import { AuthRepository } from "@/server/db/repositories/auth";
import { UsersRepository } from "@/server/db/repositories/users";
import { getDatabaseClient } from "@/server/db/client";
import { DomainError } from "@/server/domain/shared/errors";
import { jsonResponse, readJsonBody, routeError } from "../../../_lib/backend";

export const runtime = "nodejs";

const bodySchema = z.object({
  email: z.email().trim().transform((value) => value.toLowerCase()),
});
const allowedSubjects = new Set([
  "synthetic:development-partner",
  "synthetic:development-consultant",
]);
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.MERIDIAN_ENABLE_SYNTHETIC_API !== "true"
    ) {
      throw new DomainError("NOT_FOUND", "Development staff sessions are disabled");
    }
    const data = bodySchema.parse(await readJsonBody(request));
    const database = getDatabaseClient();
    const user = await new UsersRepository(database).findByEmail(data.email);
    if (
      !user ||
      user.status !== "active" ||
      !["consultant", "admin"].includes(user.globalRole) ||
      !allowedSubjects.has(user.authSubject)
    ) {
      throw new DomainError("FORBIDDEN", "This development identity is not an eligible staff user");
    }

    const issued = getAuthTokenService().issue();
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await new AuthRepository(database).createSession({
      tokenHash: issued.hash,
      userId: user.id,
      expiresAt: expiresAt.toISOString(),
    });
    const cookieStore = await cookies();
    cookieStore.set(AUTH_COOKIE_NAME, issued.token, {
      httpOnly: true,
      secure: false,
      sameSite: "lax",
      path: "/",
      expires: expiresAt,
    });
    return jsonResponse({
      user: {
        displayName: user.displayName,
        email: user.emailNormalized,
        role: user.globalRole,
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
