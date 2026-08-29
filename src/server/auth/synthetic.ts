import "server-only";

import { randomUUID } from "node:crypto";

import type {
  AnonymousActor,
  GuestActor,
  SystemActor,
  UserActor,
} from "./actor";

function ensureSyntheticActorsAllowed(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Synthetic actors are disabled in production");
  }
}

function requestId(prefix: string): string {
  return `${prefix}-${randomUUID()}`;
}

export function createSyntheticAnonymousActor(): AnonymousActor {
  ensureSyntheticActorsAllowed();
  return { kind: "anonymous", requestId: requestId("anonymous") };
}

export function createSyntheticGuestActor(
  intakeSessionId: string,
  token: string,
): GuestActor {
  ensureSyntheticActorsAllowed();
  return {
    kind: "guest",
    intakeSessionId,
    token,
    requestId: requestId("guest"),
  };
}

export function createSyntheticUserActor(userId: string): UserActor {
  ensureSyntheticActorsAllowed();
  return { kind: "user", userId, requestId: requestId("user") };
}

export function createSyntheticSystemActor(service: string): SystemActor {
  ensureSyntheticActorsAllowed();
  return { kind: "system", service, requestId: requestId("system") };
}
