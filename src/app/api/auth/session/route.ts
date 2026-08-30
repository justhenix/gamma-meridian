import { cookies } from "next/headers";

import { getAuthTokenService } from "@/server/auth/auth-token";
import { AUTH_COOKIE_NAME, resolveRequestActor } from "@/server/auth/request";
import { AuthRepository } from "@/server/db/repositories/auth";
import { UsersRepository } from "@/server/db/repositories/users";
import { getDatabaseClient } from "@/server/db/client";
import { DomainError } from "@/server/domain/shared/errors";
import { jsonResponse, routeError } from "../../_lib/backend";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const actor = await resolveRequestActor(request);
    if (actor.kind !== "user") {
      throw new DomainError("UNAUTHENTICATED", "An authenticated session is required");
    }
    const user = await new UsersRepository(getDatabaseClient()).findById(actor.userId);
    if (!user || user.status !== "active") {
      throw new DomainError("UNAUTHENTICATED", "The user session is not active");
    }
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

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    if (token) {
      await new AuthRepository(getDatabaseClient()).revokeSessionByTokenHash(
        getAuthTokenService().hash(token),
      );
    }
    cookieStore.delete(AUTH_COOKIE_NAME);
    return jsonResponse({ ok: true });
  } catch (error) {
    return routeError(error);
  }
}
