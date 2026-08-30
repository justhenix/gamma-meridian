import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { AuthTokenService } from "../../src/server/auth/auth-token";
import type { Actor } from "../../src/server/auth/actor";
import { DevelopmentEmailVerificationProvider } from "../../src/server/auth/verification-provider";
import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import type { AiRuntimeConfig } from "../../src/server/config/ai";
import { ConsultationsDal } from "../../src/server/dal/consultations";
import { StaffHelpdeskDal } from "../../src/server/dal/staff-helpdesk";
import { CasesRepository } from "../../src/server/db/repositories/cases";
import { ConversationsService } from "../../src/server/domain/conversations/service";
import { AssistantSessionService } from "../../src/server/domain/assistant/session-service";
import { AuthService } from "../../src/server/domain/auth/service";
import { StaffHelpdeskService } from "../../src/server/domain/helpdesk/service";
import { createTestDatabase, hasDomainError } from "../helpers/database";
import { createUser } from "../helpers/fixtures";

const guestSecret = "test-only-guest-token-pepper-minimum-32-bytes";
const authSecret = "test-only-auth-token-pepper-minimum-32-bytes";
const runtimeConfig: AiRuntimeConfig = {
  safeTopics: ["synthetic_safe_general"],
  expertEscalationFree: false,
};

function anonymousActor(label: string): Actor {
  return { kind: "anonymous", requestId: `request-anonymous-${label}` };
}

async function createEscalatedClaimedCase(context: TestContext, label: string) {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  const assistant = new AssistantSessionService(database, guestTokens, runtimeConfig.safeTopics);
  const opened = await assistant.open(anonymousActor(label), { locale: "en" });
  assert.ok(opened.guestToken);
  const guestActor: Actor = {
    kind: "guest",
    intakeSessionId: opened.intakeSessionId,
    token: opened.guestToken,
    requestId: `request-guest-${label}`,
  };
  const guestMessage = await new ConversationsService(database, guestTokens).sendMessage(
    guestActor,
    {
      conversationId: opened.conversationId,
      bodyMarkdown: "I need a foreign-owned company setup reviewed by a Meridian expert.",
      language: "en",
      clientRequestId: `guest-story-${label}-01`,
    },
  );

  const auth = new AuthService(
    database,
    guestTokens,
    new AuthTokenService(authSecret),
    new DevelopmentEmailVerificationProvider(true),
    runtimeConfig,
  );
  const challenge = await auth.startVerification(guestActor, {
    purpose: "claim",
    email: `${label}@example.test`,
    fullName: `Client ${label}`,
    companyName: `Company ${label}`,
  });
  const verified = await auth.verify(guestActor, {
    challengeId: challenge.challengeId,
    code: challenge.developmentCode!,
  });
  assert.ok(verified.claim);

  return {
    database,
    guestTokens,
    opened,
    guestMessage,
    clientActor: createSyntheticUserActor(verified.user.id),
  };
}

test("staff queue exposes only unassigned escalations or the current staff member's assigned cases", async (context) => {
  const setup = await createEscalatedClaimedCase(context, "queue");
  const first = await createUser(setup.database, "consultant", "queue-first");
  const second = await createUser(setup.database, "consultant", "queue-second");
  const firstActor = createSyntheticUserActor(first.id);
  const secondActor = createSyntheticUserActor(second.id);
  const dal = new StaffHelpdeskDal(setup.database, setup.guestTokens);
  const service = new StaffHelpdeskService(setup.database, setup.guestTokens);

  const before = await dal.list(firstActor);
  assert.equal(before.length, 1);
  assert.equal(before[0]?.caseId, setup.opened.caseId);
  assert.equal(before[0]?.status, "needs_expert");

  const firstClaim = await service.claimCase(firstActor, { caseId: setup.opened.caseId });
  const replayClaim = await service.claimCase(firstActor, { caseId: setup.opened.caseId });
  assert.equal(firstClaim.id, replayClaim.id);
  assert.equal(firstClaim.caseRole, "lead_consultant");

  const membershipCount = await setup.database.execute({
    sql: `SELECT count(*) AS count FROM case_members WHERE case_id = ? AND user_id = ?`,
    args: [setup.opened.caseId, first.id],
  });
  assert.equal(Number(membershipCount.rows[0]?.count), 1);

  const firstQueue = await dal.list(firstActor);
  const secondQueue = await dal.list(secondActor);
  assert.equal(firstQueue.some((item) => item.caseId === setup.opened.caseId), true);
  assert.equal(secondQueue.some((item) => item.caseId === setup.opened.caseId), false);
  await assert.rejects(
    service.claimCase(secondActor, { caseId: setup.opened.caseId }),
    hasDomainError("CONFLICT"),
  );
});

test("staff detail requires assignment and omits raw AI run or conversation snapshot metadata", async (context) => {
  const setup = await createEscalatedClaimedCase(context, "detail");
  const consultant = await createUser(setup.database, "consultant", "detail-consultant");
  const outsider = await createUser(setup.database, "consultant", "detail-outsider");
  const consultantActor = createSyntheticUserActor(consultant.id);
  const outsiderActor = createSyntheticUserActor(outsider.id);
  const dal = new StaffHelpdeskDal(setup.database, setup.guestTokens);
  const service = new StaffHelpdeskService(setup.database, setup.guestTokens);

  await assert.rejects(
    dal.get(consultantActor, setup.opened.caseId),
    hasDomainError("FORBIDDEN"),
  );
  await service.claimCase(consultantActor, { caseId: setup.opened.caseId });
  const detail = await dal.get(consultantActor, setup.opened.caseId);
  assert.equal(detail.conversationId, setup.opened.conversationId);
  assert.equal(detail.messages.some((message) => message.id === setup.guestMessage.id), true);
  assert.equal(detail.handoffBrief.clientIntent.includes("foreign-owned company"), true);
  assert.equal(detail.handoffBrief.escalationTrigger.length > 0, true);
  const serialized = JSON.stringify(detail);
  assert.equal(serialized.includes('"aiRunId"'), false);
  assert.equal(serialized.includes('"conversation"'), false);
  assert.equal(serialized.includes('"authorUserId"'), false);

  await assert.rejects(
    dal.get(outsiderActor, setup.opened.caseId),
    hasDomainError("FORBIDDEN"),
  );
  await assert.rejects(
    dal.list(setup.clientActor),
    hasDomainError("FORBIDDEN"),
  );
});

test("consultant reply stays in the claimed client conversation and waiting/resolved actions use case transitions", async (context) => {
  const setup = await createEscalatedClaimedCase(context, "reply");
  const consultant = await createUser(setup.database, "consultant", "reply-consultant");
  const consultantActor = createSyntheticUserActor(consultant.id);
  const service = new StaffHelpdeskService(setup.database, setup.guestTokens);
  const consultations = new ConsultationsDal(setup.database, setup.guestTokens);

  await service.claimCase(consultantActor, { caseId: setup.opened.caseId });
  const reply = await service.sendReply(consultantActor, {
    caseId: setup.opened.caseId,
    bodyMarkdown: "I reviewed the earlier conversation. I can continue from the facts already provided.",
    language: "en",
    clientRequestId: "consultant-reply-same-thread-01",
  });
  const replay = await service.sendReply(consultantActor, {
    caseId: setup.opened.caseId,
    bodyMarkdown: "I reviewed the earlier conversation. I can continue from the facts already provided.",
    language: "en",
    clientRequestId: "consultant-reply-same-thread-01",
  });
  assert.equal(reply.message.id, replay.message.id);
  assert.equal(reply.message.conversationId, setup.opened.conversationId);
  assert.equal(reply.caseRecord.status, "consultant_working");

  const clientDetail = await consultations.get(setup.clientActor, setup.opened.caseId);
  assert.equal(clientDetail.conversationId, setup.opened.conversationId);
  assert.equal(
    clientDetail.messages.some(
      (message) => message.id === reply.message.id && message.sender === "staff",
    ),
    true,
  );

  const waiting = await service.markWaiting(consultantActor, { caseId: setup.opened.caseId });
  assert.equal(waiting.status, "waiting_for_client");
  const resumed = await service.sendReply(consultantActor, {
    caseId: setup.opened.caseId,
    bodyMarkdown: "Thanks. I have enough to finish the review now.",
    language: "en",
    clientRequestId: "consultant-reply-resume-01",
  });
  assert.equal(resumed.caseRecord.status, "consultant_working");
  const resolved = await service.markResolved(consultantActor, {
    caseId: setup.opened.caseId,
    resolutionNote: "Human review completed in the shared thread.",
  });
  assert.equal(resolved.status, "resolved");

  const stored = await new CasesRepository(setup.database).findCaseById(setup.opened.caseId);
  assert.equal(stored?.status, "resolved");
});
