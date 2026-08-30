import "server-only";

import { randomUUID } from "node:crypto";

import type { Actor } from "./actor";
import { getAuthTokenService } from "./auth-token";
import { getGuestTokenService } from "./guest-token";
import { AuthRepository } from "../db/repositories/auth";
import { IntakeRepository } from "../db/repositories/intake";
import { UsersRepository } from "../db/repositories/users";
import { getDatabaseClient } from "../db/client";

export const AUTH_COOKIE_NAME = "meridian_session";
export const GUEST_COOKIE_NAME = "meridian_guest";
export const GUEST_HEADER_NAME = "x-meridian-guest-token";

function requestId(request: Request): string {
  const supplied = request.headers.get("x-request-id")?.trim();
  return supplied && supplied.length >= 8 && supplied.length <= 160
    ? supplied
    : randomUUID();
}

function cookieValue(request: Request, name: string): string | null {
  const raw = request.headers.get("cookie");
  if (!raw) return null;
  for (const item of raw.split(";")) {
    const separator = item.indexOf("=");
    if (separator < 0) continue;
    const key = item.slice(0, separator).trim();
    if (key !== name) continue;
    try {
      return decodeURIComponent(item.slice(separator + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

export async function resolveRequestActor(request: Request): Promise<Actor> {
  const id = requestId(request);
  const database = getDatabaseClient();
  const authToken = cookieValue(request, AUTH_COOKIE_NAME);
  if (authToken) {
    const session = await new AuthRepository(database).findSessionByTokenHash(
      getAuthTokenService().hash(authToken),
    );
    if (
      session &&
      session.revokedAt === null &&
      new Date(session.expiresAt).getTime() > Date.now()
    ) {
      const user = await new UsersRepository(database).findById(session.userId);
      if (user?.status === "active") {
        return { kind: "user", userId: user.id, requestId: id };
      }
    }
  }

  const guestToken =
    cookieValue(request, GUEST_COOKIE_NAME) ?? request.headers.get(GUEST_HEADER_NAME)?.trim() ?? null;
  if (guestToken) {
    const session = await new IntakeRepository(database).findSessionByGuestTokenHash(
      getGuestTokenService().hash(guestToken),
    );
    if (session) {
      return {
        kind: "guest",
        intakeSessionId: session.id,
        token: guestToken,
        requestId: id,
      };
    }
  }

  return { kind: "anonymous", requestId: id };
}
