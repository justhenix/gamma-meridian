import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { Client } from "@libsql/client";

import { AuthTokenService } from "../../src/server/auth/auth-token";
import type { Actor } from "../../src/server/auth/actor";
import { DevelopmentEmailVerificationProvider } from "../../src/server/auth/verification-provider";
import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import type { AiRuntimeConfig } from "../../src/server/config/ai";
import { ConsultationsDal } from "../../src/server/dal/consultations";
import { ConversationsDal } from "../../src/server/dal/conversations";
import { CasesRepository } from "../../src/server/db/repositories/cases";
import { IntakeRepository } from "../../src/server/db/repositories/intake";
import { AnswerCaseQuestionService } from "../../src/server/domain/ai/answerCaseQuestion";
import { AssistantMessageService } from "../../src/server/domain/assistant/message-service";
import { AssistantSessionService } from "../../src/server/domain/assistant/session-service";
import { AuthService } from "../../src/server/domain/auth/service";
import { CasesService } from "../../src/server/domain/cases/service";
import { ConversationsService } from "../../src/server/domain/conversations/service";
import { FakeAiProvider, ingestSyntheticSource } from "../helpers/ai";
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

function guestActor(input: {
  intakeSessionId: string;
  guestToken: string;
  label: string;
}): Actor {
  return {
    kind: "guest",
    intakeSessionId: input.intakeSessionId,
    token: input.guestToken,
    requestId: `request-guest-${input.label}`,
  };
}

function validOutput(sourceSectionId: string) {
  const answer =
    "The synthetic filing acknowledgement is issued within 3 synthetic business days.";
  return {
    classification: "simple" as const,
    canAnswerWithAI: true,
    needsHuman: false,
    reasonCodes: [],
    missingFacts: [],
    answer,
    citations: [{ sourceSectionId, claim: answer }],
    assumptions: ["The synthetic development fixture applies."],
    humanHandoffSummary: null,
  };
}

async function openGuestAssistant(context: TestContext, label: string) {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  const assistant = new AssistantSessionService(database, guestTokens, runtimeConfig.safeTopics);
  const opened = await assistant.open(anonymousActor(label), { locale: "en" });
  assert.ok(opened.guestToken);
  return {
    database,
    guestTokens,
    assistant,
    opened,
    actor: guestActor({
      intakeSessionId: opened.intakeSessionId,
      guestToken: opened.guestToken,
      label,
    }),
  };
}

test("guest assistant bootstrap uses one batch and no interactive transactions", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  let batchCalls = 0;
  let transactionCalls = 0;
  const instrumented = new Proxy(database, {
    get(target, property, receiver) {
      if (property === "batch") {
        return (...args: Parameters<Client["batch"]>) => {
          batchCalls += 1;
          return target.batch(...args);
        };
      }
      if (property === "transaction") {
        return (...args: Parameters<Client["transaction"]>) => {
          transactionCalls += 1;
          return target.transaction(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Client;

  const opened = await new AssistantSessionService(
    instrumented,
    guestTokens,
    runtimeConfig.safeTopics,
  ).open(anonymousActor("batched-bootstrap"), { locale: "en" });

  assert.ok(opened.guestToken);
  assert.equal(batchCalls, 1);
  assert.equal(transactionCalls, 0);
});

test("guest assistant restore uses one database lookup", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  const assistant = new AssistantSessionService(database, guestTokens, runtimeConfig.safeTopics);
  const opened = await assistant.open(anonymousActor("restore-query"), { locale: "en" });
  assert.ok(opened.guestToken);

  let executeCalls = 0;
  const instrumented = new Proxy(database, {
    get(target, property, receiver) {
      if (property === "execute") {
        return (...args: Parameters<Client["execute"]>) => {
          executeCalls += 1;
          return target.execute(...args);
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Client;

  const restored = await new AssistantSessionService(
    instrumented,
    guestTokens,
    runtimeConfig.safeTopics,
  ).restore(guestActor({
    intakeSessionId: opened.intakeSessionId,
    guestToken: opened.guestToken,
    label: "restore-query",
  }));

  assert.equal(restored.caseId, opened.caseId);
  assert.equal(restored.conversationId, opened.conversationId);
  assert.equal(executeCalls, 1);
});

test("guest assistant owns one opaque temporary conversation and cannot read another guest thread", async (context) => {
  const first = await openGuestAssistant(context, "first");
  const second = await first.assistant.open(anonymousActor("second"), { locale: "en" });
  assert.ok(second.guestToken);
  const secondActor = guestActor({
    intakeSessionId: second.intakeSessionId,
    guestToken: second.guestToken,
    label: "second",
  });

  const sent = await new ConversationsService(first.database, first.guestTokens).sendMessage(
    first.actor,
    {
      conversationId: first.opened.conversationId,
      bodyMarkdown: "What does the synthetic filing acknowledgement say about timing?",
      language: "en",
      clientRequestId: "guest-message-first-01",
    },
  );
  assert.equal(sent.authorUserId, null);
  assert.equal(sent.authorGuestSessionId, first.opened.intakeSessionId);

  const restored = await new ConversationsDal(first.database, first.guestTokens).getMessages(
    first.actor,
    first.opened.conversationId,
  );
  assert.equal(restored.messages.length, 1);
  assert.equal(restored.messages[0]?.bodyMarkdown, sent.bodyMarkdown);

  await assert.rejects(
    new ConversationsDal(first.database, first.guestTokens).getMessages(
      secondActor,
      first.opened.conversationId,
    ),
    hasDomainError("FORBIDDEN"),
  );
});

test("guest can receive a grounded AI answer in the same submitted conversation", async (context) => {
  const setup = await openGuestAssistant(context, "ai");
  const admin = await createUser(setup.database, "admin", "guest-ai-admin");
  const source = await ingestSyntheticSource(
    setup.database,
    setup.guestTokens,
    admin,
  );
  const question = await new ConversationsService(setup.database, setup.guestTokens).sendMessage(
    setup.actor,
    {
      conversationId: setup.opened.conversationId,
      bodyMarkdown: "What does the synthetic filing acknowledgement say about timing?",
      language: "en",
      clientRequestId: "guest-ai-question-01",
    },
  );
  const provider = new FakeAiProvider(() => validOutput(source.sections[0]!.id));

  const result = await new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  ).answerCaseQuestion(setup.actor, {
    caseId: setup.opened.caseId,
    conversationId: setup.opened.conversationId,
    userMessageId: question.id,
    idempotencyKey: "guest-ai-answer-01",
    relevantDate: "2026-08-30",
  });

  assert.equal(result.status, "answered");
  assert.equal(provider.calls, 1);
  const restored = await new ConversationsDal(setup.database, setup.guestTokens).getMessages(
    setup.actor,
    setup.opened.conversationId,
  );
  assert.deepEqual(
    restored.messages.map((message) => message.authorType),
    ["user", "ai"],
  );
});

test("guest assistant sends and answers in one idempotent service call", async (context) => {
  const setup = await openGuestAssistant(context, "combined-ai");
  const admin = await createUser(setup.database, "admin", "combined-ai-admin");
  const source = await ingestSyntheticSource(
    setup.database,
    setup.guestTokens,
    admin,
  );
  const provider = new FakeAiProvider(() => validOutput(source.sections[0]!.id));
  const service = new AssistantMessageService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  );
  const input = {
    conversationId: setup.opened.conversationId,
    bodyMarkdown: "What does the synthetic filing acknowledgement say about timing?",
    language: "en" as const,
    clientRequestId: "combined-assistant-message-01",
  };

  const first = await service.sendAndAnswer(setup.actor, input);
  const replay = await service.sendAndAnswer(setup.actor, input);

  assert.equal(first.answer.status, "answered");
  assert.equal(replay.userMessage.id, first.userMessage.id);
  assert.equal(replay.answer.aiRunId, first.answer.aiRunId);
  assert.equal(provider.calls, 1);
});

test("email verification claims the existing guest case idempotently and invalidates guest access", async (context) => {
  const setup = await openGuestAssistant(context, "claim");
  const conversationService = new ConversationsService(setup.database, setup.guestTokens);
  const original = await conversationService.sendMessage(setup.actor, {
    conversationId: setup.opened.conversationId,
    bodyMarkdown: "Please keep this exact story when I ask for an expert.",
    language: "en",
    clientRequestId: "guest-claim-story-01",
  });
  const auth = new AuthService(
    setup.database,
    setup.guestTokens,
    new AuthTokenService(authSecret),
    new DevelopmentEmailVerificationProvider(true),
    runtimeConfig,
  );
  const started = await auth.startVerification(setup.actor, {
    purpose: "claim",
    email: "founder@example.test",
    fullName: "Guest Founder",
    companyName: "Example Ventures",
  });
  assert.ok(started.developmentCode);

  const first = await auth.verify(setup.actor, {
    challengeId: started.challengeId,
    code: started.developmentCode,
  });
  assert.equal(first.claim?.caseId, setup.opened.caseId);
  assert.equal(first.claim?.conversationId, setup.opened.conversationId);

  await assert.rejects(
    auth.verify(anonymousActor("consumed-otp-replay"), {
      challengeId: started.challengeId,
      code: started.developmentCode,
    }),
    hasDomainError("UNAUTHENTICATED"),
  );

  const userActor: Actor = {
    kind: "user",
    userId: first.user.id,
    requestId: "request-verified-replay",
  };
  const replay = await auth.verify(userActor, {
    challengeId: started.challengeId,
    code: started.developmentCode,
  });
  assert.equal(replay.user.id, first.user.id);
  assert.equal(replay.claim?.caseId, first.claim?.caseId);
  assert.equal(replay.claim?.conversationId, first.claim?.conversationId);

  const counts = await setup.database.execute({
    sql: `
      SELECT
        (SELECT count(*) FROM users WHERE email_normalized = ?) AS users_count,
        (SELECT count(*) FROM client_accounts) AS accounts_count,
        (SELECT count(*) FROM case_members WHERE case_id = ? AND user_id = ?) AS memberships_count
    `,
    args: ["founder@example.test", setup.opened.caseId, first.user.id],
  });
  assert.equal(Number(counts.rows[0]?.users_count), 1);
  assert.equal(Number(counts.rows[0]?.accounts_count), 1);
  assert.equal(Number(counts.rows[0]?.memberships_count), 1);

  const claimedSession = await new IntakeRepository(setup.database).findSessionById(
    setup.opened.intakeSessionId,
  );
  assert.equal(claimedSession?.status, "claimed");
  assert.equal(claimedSession?.ownerUserId, first.user.id);
  assert.equal(claimedSession?.guestTokenHash, null);
  await assert.rejects(
    new ConversationsDal(setup.database, setup.guestTokens).getMessages(
      setup.actor,
      setup.opened.conversationId,
    ),
    hasDomainError("FORBIDDEN"),
  );

  const owned = await new ConversationsDal(setup.database, setup.guestTokens).getMessages(
    userActor,
    setup.opened.conversationId,
  );
  assert.equal(owned.messages[0]?.id, original.id);
  assert.equal(owned.messages[0]?.bodyMarkdown, original.bodyMarkdown);
  assert.equal(owned.messages.some((message) => message.authorType === "system"), true);
});

test("returning client sees only own consultations and consultant continues the claimed thread", async (context) => {
  const setup = await openGuestAssistant(context, "returning");
  const auth = new AuthService(
    setup.database,
    setup.guestTokens,
    new AuthTokenService(authSecret),
    new DevelopmentEmailVerificationProvider(true),
    runtimeConfig,
  );
  const challenge = await auth.startVerification(setup.actor, {
    purpose: "claim",
    email: "returning@example.test",
    fullName: "Returning Client",
  });
  const verified = await auth.verify(setup.actor, {
    challengeId: challenge.challengeId,
    code: challenge.developmentCode!,
  });
  const clientActor = createSyntheticUserActor(verified.user.id);
  const consultations = new ConsultationsDal(setup.database, setup.guestTokens);
  const list = await consultations.list(clientActor);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.caseReference, setup.opened.caseReference);
  assert.equal(list[0]?.clientStatus, "Expert reviewing");

  const outsider = await createUser(setup.database, "client", "returning-outsider");
  await assert.rejects(
    consultations.get( createSyntheticUserActor(outsider.id), setup.opened.caseId),
    hasDomainError("FORBIDDEN"),
  );

  const admin = await createUser(setup.database, "admin", "returning-admin");
  const consultant = await createUser(setup.database, "consultant", "returning-consultant");
  await new CasesService(setup.database, setup.guestTokens).assignMember(
    createSyntheticUserActor(admin.id),
    {
      caseId: setup.opened.caseId,
      userId: consultant.id,
      caseRole: "lead_consultant",
      reason: "same_thread_handoff",
    },
  );
  const consultantMessage = await new ConversationsService(
    setup.database,
    setup.guestTokens,
  ).sendMessage(createSyntheticUserActor(consultant.id), {
    conversationId: setup.opened.conversationId,
    bodyMarkdown: "I have joined this existing consultation and reviewed the earlier messages.",
    language: "en",
    clientRequestId: "consultant-same-thread-01",
  });
  assert.equal(consultantMessage.conversationId, setup.opened.conversationId);

  const detail = await consultations.get(clientActor, setup.opened.caseId);
  assert.equal(detail.conversationId, setup.opened.conversationId);
  assert.equal(
    detail.messages.some((message) => message.id === consultantMessage.id),
    true,
  );
  assert.equal(detail.messages.some((message) => message.sender === "staff"), true);

  const caseRecord = await new CasesRepository(setup.database).findCaseById(setup.opened.caseId);
  assert.equal(caseRecord?.createdByUserId, verified.user.id);
  assert.ok(caseRecord?.clientAccountId);
});

test("authenticated user without consultations opens assistant and creates active consultation", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  const user = await createUser(database, "client", "new-client");
  const userActor = createSyntheticUserActor(user.id);

  const assistant = new AssistantSessionService(database, guestTokens, runtimeConfig.safeTopics);
  const opened = await assistant.open(userActor, { locale: "en" });

  assert.ok(opened.caseId);
  assert.ok(opened.conversationId);
  assert.equal(opened.status, "received");

  const consultations = new ConsultationsDal(database, guestTokens);
  const detail = await consultations.get(userActor, opened.caseId);
  assert.equal(detail.caseId, opened.caseId);
  assert.equal(detail.conversationId, opened.conversationId);

  const list = await consultations.list(userActor);
  assert.equal(list.length, 1);
  assert.equal(list[0]?.caseId, opened.caseId);
});

test("stale guest credential recovers cleanly when opening assistant", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(guestSecret);
  const assistant = new AssistantSessionService(database, guestTokens, runtimeConfig.safeTopics);

  const staleGuest: Actor = {
    kind: "guest",
    intakeSessionId: "00000000-0000-0000-0000-000000000000",
    token: "stale-guest-token",
    requestId: "request-stale-guest",
  };

  const recovered = await assistant.open(staleGuest, { locale: "en" });
  assert.ok(recovered.guestToken);
  assert.ok(recovered.caseId);
  assert.equal(recovered.status, "received");
});

