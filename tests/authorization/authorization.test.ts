import assert from "node:assert/strict";
import test from "node:test";

import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { CasesDal } from "../../src/server/dal/cases";
import { ConversationsDal } from "../../src/server/dal/conversations";
import { CasesService } from "../../src/server/domain/cases/service";
import { ConversationsService } from "../../src/server/domain/conversations/service";
import {
  addClientAccountMember,
  createClientAccountWithOwner,
  createUser,
} from "../helpers/fixtures";
import { createTestDatabase, hasDomainError } from "../helpers/database";
import { createSubmittedClientCase } from "../helpers/workflow";

const tokenSecret = "test-only-authorization-token-pepper-minimum-32";

test("case membership, not account membership or global admin, gates case data", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const owner = await createUser(database, "client", "owner");
  const collaborator = await createUser(database, "client", "collaborator");
  const admin = await createUser(database, "admin", "admin");
  const account = await createClientAccountWithOwner(database, owner);
  await addClientAccountMember(database, account, collaborator);
  const submitted = await createSubmittedClientCase(database, guestTokens, owner, account);
  const casesDal = new CasesDal(database, guestTokens);
  const casesService = new CasesService(database, guestTokens);

  await assert.rejects(
    casesDal.getCase(createSyntheticUserActor(collaborator.id), submitted.id),
    hasDomainError("FORBIDDEN"),
  );
  await assert.rejects(
    casesDal.getCase(createSyntheticUserActor(admin.id), submitted.id),
    hasDomainError("FORBIDDEN"),
  );

  await casesService.assignMember(createSyntheticUserActor(owner.id), {
    caseId: submitted.id,
    userId: collaborator.id,
    caseRole: "client_collaborator",
    reason: "Client owner shared this case",
  });
  const visible = await casesDal.getCase(
    createSyntheticUserActor(collaborator.id),
    submitted.id,
  );
  assert.equal(visible.memberRole, "client_collaborator");
  await database.execute({
    sql: "UPDATE users SET status = 'suspended', updated_at = ? WHERE id = ?",
    args: [new Date().toISOString(), collaborator.id],
  });
  await assert.rejects(
    casesDal.getCase(createSyntheticUserActor(collaborator.id), submitted.id),
    hasDomainError("UNAUTHENTICATED"),
  );

  await casesService.assignMember(createSyntheticUserActor(admin.id), {
    caseId: submitted.id,
    userId: admin.id,
    caseRole: "consultant",
    reason: "Audited operational access",
  });
  assert.equal(
    (await casesDal.getCase(createSyntheticUserActor(admin.id), submitted.id)).memberRole,
    "consultant",
  );
});

test("client users cannot access internal conversations and unassigned staff cannot access cases", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const owner = await createUser(database, "client", "owner");
  const admin = await createUser(database, "admin", "admin");
  const assigned = await createUser(database, "consultant", "assigned");
  const unassigned = await createUser(database, "consultant", "unassigned");
  const account = await createClientAccountWithOwner(database, owner);
  const submitted = await createSubmittedClientCase(database, guestTokens, owner, account);
  const casesService = new CasesService(database, guestTokens);
  const conversationsService = new ConversationsService(database, guestTokens);
  const conversationsDal = new ConversationsDal(database, guestTokens);

  await casesService.assignMember(createSyntheticUserActor(admin.id), {
    caseId: submitted.id,
    userId: assigned.id,
    caseRole: "lead_consultant",
    reason: "Initial consultant assignment",
  });

  await assert.rejects(
    conversationsDal.getMessages(
      createSyntheticUserActor(owner.id),
      submitted.internalConversationId,
    ),
    hasDomainError("FORBIDDEN"),
  );
  await assert.rejects(
    conversationsService.sendMessage(createSyntheticUserActor(owner.id), {
      conversationId: submitted.internalConversationId,
      bodyMarkdown: "This must not be accepted.",
      language: "en",
      clientRequestId: "client-internal-01",
    }),
    hasDomainError("FORBIDDEN"),
  );
  await assert.rejects(
    conversationsDal.getMessages(
      createSyntheticUserActor(unassigned.id),
      submitted.clientConversationId,
    ),
    hasDomainError("FORBIDDEN"),
  );

  const internalMessage = await conversationsService.sendMessage(
    createSyntheticUserActor(assigned.id),
    {
      conversationId: submitted.internalConversationId,
      bodyMarkdown: "Assigned staff-only note.",
      language: "en",
      clientRequestId: "staff-internal-001",
    },
  );
  assert.equal(internalMessage.authorUserId, assigned.id);
});
