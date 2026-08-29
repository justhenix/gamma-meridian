import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { z } from "zod";

const tokenSecretSchema = z.string().min(32);

export interface IssuedGuestToken {
  token: string;
  hash: string;
}

export class GuestTokenService {
  private readonly secret: string;

  constructor(secret: string) {
    this.secret = tokenSecretSchema.parse(secret);
  }

  issue(): IssuedGuestToken {
    const token = randomBytes(32).toString("base64url");
    return { token, hash: this.hash(token) };
  }

  hash(token: string): string {
    return createHmac("sha256", this.secret).update(token).digest("hex");
  }
}

let guestTokenService: GuestTokenService | undefined;

export function getGuestTokenService(): GuestTokenService {
  if (guestTokenService) {
    return guestTokenService;
  }

  const secret = process.env.INTAKE_TOKEN_PEPPER;
  if (!secret) {
    throw new Error("INTAKE_TOKEN_PEPPER is required");
  }

  guestTokenService = new GuestTokenService(secret);
  return guestTokenService;
}
