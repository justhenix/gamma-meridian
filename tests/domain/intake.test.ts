import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticAnonymousActor, createSyntheticGuestActor, createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { GuestTokenService } from "../../src/server/auth/guest-token";
import { AuditRepository } from "../../src/server/db/repositories/audit";
import { CasesRepository } from "../../src/server/db/repositories/cases";
import { IntakeRepository } from "../../src/server/db/repositories/intake";
import { IntakeService } from "../../src/server/domain/intake/service";
import { createClientAccountWithOwner, createUser } from "../helpers/fixtures";
import { createTestDatabase, hasDomainError } from "../helpers/database";

const tokenSecret = "test-only-intake-token-pepper-32-bytes-minimum";

test("guest intake creates one case idempotently and locks submitted answers", async (context) => {
  const database = await createTestDatabase(context);
  const service = new IntakeService(database, new GuestTokenService(tokenSecret));
  const created = await service.createIntake(createSyntheticAnonymousActor(), {
    intakeSchemaVersion: "v1",
    locale: "id",
  });
  assert.ok(created.guestToken);
  const guest = createSyntheticGuestActor(created.intake.id, created.guestToken);
  await assert.rejects(
    service.resumeIntake(
      createSyntheticGuestActor(created.intake.id, "invalid-guest-token"),
      created.intake.id,
    ),
    hasDomainError("FORBIDDEN"),
  );

  const draft = await service.saveDraftAnswer(guest, {
    intakeSessionId: created.intake.id,
    expectedVersion: 1,
    questionKey: "summary",
    questionVersion: "1",
    answer: "Need help understanding a corporate tax notice.",
  });
  assert.equal(draft.rowVersion, 2);

  const submission = {
    intakeSessionId: created.intake.id,
    expectedVersion: 2,
    idempotencyKey: "submit-guest-0001",
    title: "Corporate tax notice",
    primaryJurisdiction: "ID",
    taxTopics: ["corporate_income_tax"],
  };
  const first = await service.submitIntake(guest, submission);
  const replay = await service.submitIntake(guest, submission);
  assert.equal(replay.id, first.id);
  assert.equal(replay.clientConversationId, first.clientConversationId);

  await assert.rejects(
    service.submitIntake(guest, { ...submission, idempotencyKey: "submit-guest-other" }),
    hasDomainError("CONFLICT"),
  );
  await assert.rejects(
    service.saveDraftAnswer(guest, {
      intakeSessionId: created.intake.id,
      expectedVersion: 3,
      questionKey: "summary",
      questionVersion: "1",
      answer: "Changed after submission",
    }),
    hasDomainError("INVALID_STATE"),
  );
  const storedAnswer = (
    await new IntakeRepository(database).listAnswers(created.intake.id)
  )[0];
  assert.ok(storedAnswer);
  await assert.rejects(
    database.execute({
      sql: "UPDATE intake_answers SET answer_json = ? WHERE id = ?",
      args: [JSON.stringify("tampered"), storedAnswer.id],
    }),
  );

  const receipt = await service.resumeIntake(guest, created.intake.id);
  assert.equal(receipt.status, "submitted");
  assert.deepEqual(receipt.answers, []);

  const storedSession = await new IntakeRepository(database).findSessionById(created.intake.id);
  assert.notEqual(storedSession?.guestTokenHash, created.guestToken);
  assert.equal((await new CasesRepository(database).findCaseByIntakeSession(created.intake.id))?.id, first.id);
  const caseEvents = await new AuditRepository(database).listByCase(first.id);
  assert.ok(caseEvents.some((event) => event.eventType === "case.created"));
  assert.ok(caseEvents.every((event) => JSON.stringify(event.metadata).includes(created.guestToken!) === false));
});

test("authenticated client submission creates explicit client case membership", async (context) => {
  const database = await createTestDatabase(context);
  const service = new IntakeService(database, new GuestTokenService(tokenSecret));
  const client = await createUser(database, "client", "owner");
  const account = await createClientAccountWithOwner(database, client);
  const actor = createSyntheticUserActor(client.id);
  const created = await service.createIntake(actor, {
    intakeSchemaVersion: "v1",
    locale: "en",
  });
  const draft = await service.saveDraftAnswer(actor, {
    intakeSessionId: created.intake.id,
    expectedVersion: 1,
    questionKey: "summary",
    questionVersion: "1",
    answer: "Question about withholding tax.",
  });
  const submitted = await service.submitIntake(actor, {
    intakeSessionId: created.intake.id,
    expectedVersion: draft.rowVersion,
    idempotencyKey: "submit-client-0001",
    clientAccountId: account.id,
    title: "Withholding tax question",
    primaryJurisdiction: "ID",
    taxTopics: ["withholding_tax"],
  });

  const membership = await new CasesRepository(database).findActiveMembership(
    submitted.id,
    client.id,
  );
  assert.equal(membership?.caseRole, "client_owner");
});

test("intake submission rejects missing required answers and stale versions", async (context) => {
  const database = await createTestDatabase(context);
  const service = new IntakeService(database, new GuestTokenService(tokenSecret));
  const created = await service.createIntake(createSyntheticAnonymousActor(), {
    intakeSchemaVersion: "v1",
  });
  const guest = createSyntheticGuestActor(created.intake.id, created.guestToken!);

  await assert.rejects(
    service.submitIntake(guest, {
      intakeSessionId: created.intake.id,
      expectedVersion: 1,
      idempotencyKey: "missing-answer-01",
      title: "Incomplete",
      primaryJurisdiction: "ID",
      taxTopics: ["corporate_income_tax"],
    }),
    hasDomainError("VALIDATION_ERROR"),
  );

  await service.saveDraftAnswer(guest, {
    intakeSessionId: created.intake.id,
    expectedVersion: 1,
    questionKey: "summary",
    questionVersion: "1",
    answer: "Complete now",
  });
  await assert.rejects(
    service.saveDraftAnswer(guest, {
      intakeSessionId: created.intake.id,
      expectedVersion: 1,
      questionKey: "urgency",
      questionVersion: "1",
      answer: "normal",
    }),
    hasDomainError("CONFLICT"),
  );
});
