import "server-only";

import { z } from "zod";
import { createSyntheticUserActor } from "@/server/auth/synthetic";
import { resolveRequestActor } from "@/server/auth/request";
import { DomainError, isDomainError } from "@/server/domain/shared/errors";

const statusByCode: Record<DomainError["code"], number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INVALID_STATE: 409,
};

export function requireDevelopmentActor(request: Request) {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.MERIDIAN_ENABLE_SYNTHETIC_API !== "true"
  ) {
    throw new DomainError("NOT_FOUND", "Backend development API is disabled");
  }
  const userId = z.uuid().parse(request.headers.get("x-meridian-user-id"));
  return createSyntheticUserActor(userId);
}

export async function resolveBackendActor(request: Request) {
  const actor = await resolveRequestActor(request);
  if (actor.kind !== "anonymous") return actor;
  if (request.headers.get("x-meridian-user-id")) {
    return requireDevelopmentActor(request);
  }
  return actor;
}

export async function readJsonBody(request: Request): Promise<unknown> {
  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 65536) {
    throw new DomainError("VALIDATION_ERROR", "Request body is too large");
  }
  return request.json();
}

export function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export function routeError(error: unknown): Response {
  if (isDomainError(error)) {
    return jsonResponse(
      { error: { code: error.code, message: error.message } },
      statusByCode[error.code],
    );
  }
  if (error instanceof z.ZodError || error instanceof SyntaxError) {
    return jsonResponse(
      { error: { code: "VALIDATION_ERROR", message: "Request validation failed" } },
      400,
    );
  }
  return jsonResponse(
    { error: { code: "INTERNAL_ERROR", message: "The request could not be completed" } },
    500,
  );
}
