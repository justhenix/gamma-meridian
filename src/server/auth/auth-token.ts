import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

const tokenSecretSchema = z.string().min(32);

export interface IssuedAuthToken {
  token: string;
  hash: string;
}

export class AuthTokenService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = tokenSecretSchema.parse(secret);
  }

  issue(): IssuedAuthToken {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  hash(value: string): string {
    return createHmac("sha256", this.secret).update(value).digest("hex");
  }
}

let authTokenService: AuthTokenService | undefined;

export function getAuthTokenService(): AuthTokenService {
  if (authTokenService) return authTokenService;
  const secret = process.env.AUTH_TOKEN_PEPPER;
  if (!secret) throw new Error("AUTH_TOKEN_PEPPER is required");
  authTokenService = new AuthTokenService(secret);
  return authTokenService;
}
