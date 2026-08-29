import assert from "node:assert/strict";
import test from "node:test";

import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { AuditRepository } from "../../src/server/db/repositories/audit";
import { CasesService } from "../../src/server/domain/cases/service";
import { ConversationsService } from "../../src/server/domain/conversations/service";
import { createClientAccountWithOwner, createUser } from "../helpers/fixtures";
import { createTestDatabase, hasDomainError } from "../helpers/database";
import { createSubmittedClientCase } from "../helpers/workflow";

const tokenSecret = "test-only-case-token-pepper-at-least-32-bytes";

test("human-led case transitions use optimistic locking and require client communication", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const owner = await createUser(database, "client", "owner");
  const admin = await createUser(database, "admin", "admin");
  const lead = await createUser(database, "consultant", "lead");
  const account = await createClientAccountWithOwner(database, owner);
  const submitted = await createSubmittedClientCase(database, guestTokens, owner, account);
  const cases = new CasesService(database, guestTokens);
  const conversations = new ConversationsService(database, guestTokens);

  await cases.assignMember(createSyntheticUserActor(admin.id), {
    caseId: submitted.id,
    userId: lead.id,
    caseRole: "lead_consultant",
    reason: "Assigned as lead",
  });
  await assert.rejects(
    cases.transitionCase(createSyntheticUserActor(owner.id), {
      caseId: submitted.id,
      expectedVersion: 1,
      toStatus: "consultant_working",
      reason: "work_started",
    }),
    hasDomainError("FORBIDDEN"),
  );
  const working = await cases.transitionCase(createSyntheticUserActor(lead.id), {
    caseId: submitted.id,
    expectedVersion: 1,
    toStatus: "consultant_working",
    reason: "work_started",
  });
  assert.equal(working.rowVersion, 2);

  await assert.rejects(
    cases.transitionCase(createSyntheticUserActor(lead.id), {
      caseId: submitted.id,
      expectedVersion: 1,
      toStatus: "waiting_for_client",
      reason: "facts_requested",
    }),
    hasDomainError("CONFLICT"),
  );
  await assert.rejects(
    cases.transitionCase(createSyntheticUserActor(lead.id), {
      caseId: submitted.id,
      expectedVersion: 2,
      toStatus: "resolved",
      reason: "advice_delivered",
      resolutionCode: "answered",
    }),
    hasDomainError("INVALID_STATE"),
  );

  const messageInput = {
    conversationId: submitted.clientConversationId,
    bodyMarkdown: "We reviewed your enquiry and provided the human-led response.",
    language: "en" as const,
    clientRequestId: "staff-client-message-01",
  };
  const message = await conversations.sendMessage(
    createSyntheticUserActor(lead.id),
    messageInput,
  );
  const replay = await conversations.sendMessage(
    createSyntheticUserActor(lead.id),
    messageInput,
  );
  assert.equal(replay.id, message.id);
  await assert.rejects(
    conversations.sendMessage(createSyntheticUserActor(lead.id), {
      ...messageInput,
      bodyMarkdown: "Different content with reused idempotency key.",
    }),
    hasDomainError("CONFLICT"),
  );

  const resolved = await cases.transitionCase(createSyntheticUserActor(lead.id), {
    caseId: submitted.id,
    expectedVersion: 2,
    toStatus: "resolved",
    reason: "advice_delivered",
    resolutionCode: "answered",
    resolutionNote: "Human response sent in the client conversation.",
  });
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.rowVersion, 3);

  const closed = await cases.transitionCase(createSyntheticUserActor(lead.id), {
    caseId: submitted.id,
    expectedVersion: 3,
    toStatus: "closed",
    reason: "engagement_complete",
  });
  assert.equal(closed.status, "closed");
  assert.equal(closed.rowVersion, 4);
});

test("messages and audit events are append-only at the database boundary", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const owner = await createUser(database, "client", "owner");
  const account = await createClientAccountWithOwner(database, owner);
  const submitted = await createSubmittedClientCase(database, guestTokens, owner, account);
  const message = await new ConversationsService(database, guestTokens).sendMessage(
    createSyntheticUserActor(owner.id),
    {
      conversationId: submitted.clientConversationId,
      bodyMarkdown: "An immutable client message.",
      language: "en",
      clientRequestId: "immutable-message-01",
    },
  );
  const auditEvent = (await new AuditRepository(database).listByCase(submitted.id))[0];
  assert.ok(auditEvent);

  await assert.rejects(
    database.execute({
      sql: "UPDATE messages SET body_markdown = ? WHERE id = ?",
      args: ["tampered", message.id],
    }),
  );
  await assert.rejects(
    database.execute({
      sql: "DELETE FROM messages WHERE id = ?",
      args: [message.id],
    }),
  );
  await assert.rejects(
    database.execute({
      sql: "UPDATE audit_events SET event_type = ? WHERE id = ?",
      args: ["tampered", auditEvent.id],
    }),
  );
  await assert.rejects(
    database.execute({
      sql: "DELETE FROM audit_events WHERE id = ?",
      args: [auditEvent.id],
    }),
  );
});
