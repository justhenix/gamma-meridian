import assert from "node:assert/strict";
import test from "node:test";

import { AuthTokenService } from "../../src/server/auth/auth-token";
import { AuthRepository } from "../../src/server/db/repositories/auth";
import { UsersRepository } from "../../src/server/db/repositories/users";
import { createTestDatabase, hasDomainError } from "../helpers/database";

test("allowed staff email receives a staff OTP and creates a consultant session", async (context) => {
  const staffModule = await import("../../src/server/domain/auth/staff-service").catch(() => null);
  assert.ok(staffModule, "staff email auth service must exist");

  const database = await createTestDatabase(context);
  const authTokens = new AuthTokenService("staff-auth-test-secret-that-is-at-least-thirty-two-bytes");
  const deliveries: Array<{ email: string; code: string; purpose: string }> = [];
  const provider = {
    async deliverCode(input: { email: string; code: string; purpose: string }) {
      deliveries.push(input);
      return {};
    },
  };
  const service = new staffModule.StaffAuthService(
    database,
    authTokens,
    provider,
    new Set(["gammaafar@gmail.com"]),
  );

  const started = await service.startVerification({ email: " GammaAfar@gmail.com " });
  assert.match(started.challengeId, /^[0-9a-f-]{36}$/i);
  assert.equal(deliveries.length, 1);
  assert.deepEqual(
    { email: deliveries[0]?.email, purpose: deliveries[0]?.purpose },
    { email: "gammaafar@gmail.com", purpose: "staff_login" },
  );
  assert.match(deliveries[0]?.code ?? "", /^\d{6}$/);

  const verified = await service.verify({
    challengeId: started.challengeId,
    code: deliveries[0]!.code,
  });
  assert.equal(verified.user.email, "gammaafar@gmail.com");
  assert.equal(verified.user.role, "consultant");
  assert.ok(verified.sessionToken.length >= 32);

  const user = await new UsersRepository(database).findByEmail("gammaafar@gmail.com");
  assert.equal(user?.globalRole, "consultant");
  assert.ok(user?.emailVerifiedAt);

  const session = await new AuthRepository(database).findSessionByTokenHash(
    authTokens.hash(verified.sessionToken),
  );
  assert.equal(session?.userId, user?.id);
});

test("staff OTP start rejects emails outside the configured allowlist without sending", async (context) => {
  const staffModule = await import("../../src/server/domain/auth/staff-service").catch(() => null);
  assert.ok(staffModule, "staff email auth service must exist");

  const database = await createTestDatabase(context);
  const authTokens = new AuthTokenService("staff-auth-test-secret-that-is-at-least-thirty-two-bytes");
  let deliveries = 0;
  const service = new staffModule.StaffAuthService(
    database,
    authTokens,
    {
      async deliverCode() {
        deliveries += 1;
        return {};
      },
    },
    new Set(["gammaafar@gmail.com"]),
  );

  await assert.rejects(
    service.startVerification({ email: "someone@example.com" }),
    hasDomainError("FORBIDDEN"),
  );
  assert.equal(deliveries, 0);
});

test("consumed staff OTP cannot be replayed to mint another session", async (context) => {
  const staffModule = await import("../../src/server/domain/auth/staff-service").catch(() => null);
  assert.ok(staffModule, "staff email auth service must exist");

  const database = await createTestDatabase(context);
  const authTokens = new AuthTokenService("staff-auth-test-secret-that-is-at-least-thirty-two-bytes");
  let deliveredCode = "";
  const service = new staffModule.StaffAuthService(
    database,
    authTokens,
    {
      async deliverCode(input: { code: string }) {
        deliveredCode = input.code;
        return {};
      },
    },
    new Set(["gammaafar@gmail.com"]),
  );

  const started = await service.startVerification({ email: "gammaafar@gmail.com" });
  await service.verify({ challengeId: started.challengeId, code: deliveredCode });
  await assert.rejects(
    service.verify({ challengeId: started.challengeId, code: deliveredCode }),
    hasDomainError("UNAUTHENTICATED"),
  );
});
