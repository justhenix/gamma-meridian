import assert from "node:assert/strict";
import test from "node:test";

test("SumoPod provider sends an OTP email without exposing a development code", async () => {
  const providerModule = await import("../../src/server/auth/verification-provider");
  assert.equal(
    typeof providerModule.SumoPodEmailVerificationProvider,
    "function",
    "SumoPod verification provider must exist",
  );

  const sent: Array<Record<string, unknown>> = [];
  const provider = new providerModule.SumoPodEmailVerificationProvider(
    {
      async sendMail(message: Record<string, unknown>) {
        sent.push(message);
        return { messageId: "test-message" };
      },
    },
    {
      fromName: "Meridian Tax",
      fromEmail: "verify@meridian.test",
    },
  );

  const result = await provider.deliverCode({
    email: "client@example.com",
    code: "123456",
    purpose: "claim",
  });

  assert.deepEqual(result, {});
  assert.equal(sent.length, 1);
  assert.equal(sent[0]?.to, "client@example.com");
  assert.equal(sent[0]?.from, '"Meridian Tax" <verify@meridian.test>');
  assert.match(String(sent[0]?.subject), /verification code/i);
  assert.match(String(sent[0]?.text), /123456/);
  assert.match(String(sent[0]?.html), /123456/);
});

test("SumoPod provider labels staff OTP email as staff sign-in", async () => {
  const providerModule = await import("../../src/server/auth/verification-provider");
  assert.equal(typeof providerModule.SumoPodEmailVerificationProvider, "function");

  const sent: Array<Record<string, unknown>> = [];
  const provider = new providerModule.SumoPodEmailVerificationProvider(
    {
      async sendMail(message: Record<string, unknown>) {
        sent.push(message);
        return { messageId: "test-message" };
      },
    },
    { fromName: "Meridian Tax", fromEmail: "verify@meridian.test" },
  );

  await provider.deliverCode({
    email: "staff@example.com",
    code: "654321",
    purpose: "staff_login",
  });

  assert.match(String(sent[0]?.subject), /staff sign-in/i);
});

test("development OTP exposure is limited to explicit local development", async () => {
  const providerModule = await import("../../src/server/auth/verification-provider");

  assert.equal(
    providerModule.canExposeDevelopmentCode({
      NODE_ENV: "development",
      MERIDIAN_ENABLE_DEV_OTP: "true",
    }),
    true,
  );
  assert.equal(
    providerModule.canExposeDevelopmentCode({
      NODE_ENV: "production",
      MERIDIAN_ENABLE_DEV_OTP: "true",
    }),
    false,
  );
  assert.equal(
    providerModule.canExposeDevelopmentCode({
      NODE_ENV: "development",
      VERCEL_ENV: "preview",
      MERIDIAN_ENABLE_DEV_OTP: "true",
    }),
    false,
  );
  assert.equal(
    providerModule.canExposeDevelopmentCode({
      NODE_ENV: "development",
      MERIDIAN_ENABLE_DEV_OTP: "false",
    }),
    false,
  );
});

test("public verification response strips development code outside local development", async () => {
  const providerModule = await import("../../src/server/auth/verification-provider");
  const result = {
    challengeId: "challenge-id",
    expiresAt: "2026-08-30T13:00:00.000Z",
    developmentCode: "123456",
  };

  assert.deepEqual(
    providerModule.toPublicVerificationResult(result, {
      NODE_ENV: "production",
      MERIDIAN_ENABLE_DEV_OTP: "true",
    }),
    {
      challengeId: "challenge-id",
      expiresAt: "2026-08-30T13:00:00.000Z",
    },
  );
  assert.deepEqual(
    providerModule.toPublicVerificationResult(result, {
      NODE_ENV: "development",
      MERIDIAN_ENABLE_DEV_OTP: "true",
    }),
    result,
  );
});
