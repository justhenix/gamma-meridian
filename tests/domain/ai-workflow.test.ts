import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import type { AiRuntimeConfig } from "../../src/server/config/ai";
import { ConversationsDal } from "../../src/server/dal/conversations";
import { AiRunsRepository } from "../../src/server/db/repositories/ai-runs";
import { CasesRepository } from "../../src/server/db/repositories/cases";
import { AnswerCaseQuestionService } from "../../src/server/domain/ai/answerCaseQuestion";
import { CasesService } from "../../src/server/domain/cases/service";
import { ConversationsService } from "../../src/server/domain/conversations/service";
import { EscalationsService } from "../../src/server/domain/escalations/escalateConversation";
import { AiProviderError } from "../../src/server/integrations/ai/provider";
import { FakeAiProvider, ingestSyntheticSource } from "../helpers/ai";
import { createTestDatabase, hasDomainError } from "../helpers/database";
import { createClientAccountWithOwner, createUser } from "../helpers/fixtures";
import { createSubmittedClientCase } from "../helpers/workflow";

const tokenSecret = "test-only-ai-workflow-token-pepper-minimum-32";
const runtimeConfig: AiRuntimeConfig = {
  safeTopics: ["synthetic_safe_general"],
  expertEscalationFree: false,
};

async function createAiCase(context: TestContext, question: string) {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const owner = await createUser(database, "client", "ai-owner");
  const admin = await createUser(database, "admin", "ai-admin");
  const account = await createClientAccountWithOwner(database, owner);
  const submitted = await createSubmittedClientCase(
    database,
    guestTokens,
    owner,
    account,
    ["synthetic_safe_general"],
  );
  const actor = createSyntheticUserActor(owner.id);
  const message = await new ConversationsService(database, guestTokens).sendMessage(actor, {
    conversationId: submitted.clientConversationId,
    bodyMarkdown: question,
    language: "en",
    clientRequestId: `question-${crypto.randomUUID()}`,
  });
  return { database, guestTokens, owner, admin, account, submitted, actor, message };
}

function validOutput(sourceSectionId: string) {
  const answer =
    "The synthetic filing acknowledgement is issued within 3 synthetic business days.";
  return {
    classification: "simple",
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

test("AI publishes a concise answer only with an approved effective supplied source", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  const source = await ingestSyntheticSource(
    setup.database,
    setup.guestTokens,
    setup.admin,
  );
  const provider = new FakeAiProvider(() => validOutput(source.sections[0]!.id));
  const service = new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  );

  const result = await service.answerCaseQuestion(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "valid-grounded-answer-01",
    relevantDate: "2026-08-30",
  });

  assert.equal(result.status, "answered");
  assert.equal(result.needsHuman, false);
  assert.equal(result.citations[0]?.sourceSectionId, source.sections[0]!.id);
  assert.equal(result.citations[0]?.canonicalUrl, source.source.canonicalUrl);
  assert.ok(result.recommendationVersionId);
  assert.equal(provider.calls, 1);

  const clientConversation = await new ConversationsDal(
    setup.database,
    setup.guestTokens,
  ).getMessages(setup.actor, setup.submitted.clientConversationId);
  assert.deepEqual(
    clientConversation.messages.map((message) => message.authorType),
    ["user", "ai"],
  );
  const serialized = JSON.stringify(clientConversation);
  assert.equal(serialized.includes("inputSnapshot"), false);
  assert.equal(serialized.includes("sourceSectionIds"), false);
  assert.equal(serialized.includes("providerRequestId"), false);
});

test("nonexistent citations invalidate the run and never expose the unsupported answer", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  await ingestSyntheticSource(setup.database, setup.guestTokens, setup.admin);
  const unsupportedAnswer = "A fabricated source proves an unsupported legal result.";
  const provider = new FakeAiProvider(() => ({
    ...validOutput(crypto.randomUUID()),
    answer: unsupportedAnswer,
    citations: [{ sourceSectionId: crypto.randomUUID(), claim: unsupportedAnswer }],
  }));
  const result = await new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  ).answerCaseQuestion(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "invalid-citation-answer-01",
    relevantDate: "2026-08-30",
  });

  assert.equal(result.status, "needs_human");
  assert.equal(result.answer.includes(unsupportedAnswer), false);
  assert.ok(result.reasonCodes.includes("citation_not_supplied"));
  const run = await new AiRunsRepository(setup.database).findById(result.aiRunId);
  assert.equal(run?.status, "invalid");
  assert.equal(JSON.stringify(run?.output).includes(unsupportedAnswer), true);
});

test("unsupported numerical legal claims are withheld even when the citation exists", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  const source = await ingestSyntheticSource(
    setup.database,
    setup.guestTokens,
    setup.admin,
  );
  const unsupportedAnswer =
    "The synthetic filing acknowledgement is issued within 4 synthetic business days.";
  const provider = new FakeAiProvider(() => ({
    ...validOutput(source.sections[0]!.id),
    answer: unsupportedAnswer,
    citations: [{ sourceSectionId: source.sections[0]!.id, claim: unsupportedAnswer }],
  }));
  const result = await new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  ).answerCaseQuestion(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "unsupported-number-answer-01",
    relevantDate: "2026-08-30",
  });

  assert.equal(result.status, "needs_human");
  assert.ok(result.reasonCodes.includes("unsupported_numerical_claim"));
  assert.equal(result.answer.includes("4 synthetic business days"), false);
});

for (const scenario of ["unapproved", "outdated", "missing"] as const) {
  test(`sources fail closed before provider: ${scenario}`, async (context) => {
    const setup = await createAiCase(
      context,
      "What does the synthetic filing acknowledgement say about timing?",
    );
    if (scenario === "unapproved") {
      await ingestSyntheticSource(setup.database, setup.guestTokens, setup.admin, {
        versionLabel: "unapproved-v1",
        approve: false,
      });
    } else if (scenario === "outdated") {
      await ingestSyntheticSource(setup.database, setup.guestTokens, setup.admin, {
        versionLabel: "outdated-v1",
        effectiveFrom: "2025-01-01",
        effectiveTo: "2025-12-31",
      });
    }
    const provider = new FakeAiProvider(() => {
      throw new Error("Provider must not be called without an effective approved source");
    });
    const result = await new AnswerCaseQuestionService(
      setup.database,
      setup.guestTokens,
      provider,
      runtimeConfig,
    ).answerCaseQuestion(setup.actor, {
      caseId: setup.submitted.id,
      conversationId: setup.submitted.clientConversationId,
      userMessageId: setup.message.id,
      idempotencyKey: `missing-source-${scenario}-01`,
      relevantDate: "2026-08-30",
    });
    assert.equal(result.status, "needs_human");
    assert.ok(result.reasonCodes.includes("missing_approved_source"));
    assert.equal(provider.calls, 0);
  });
}

test("hard-risk questions bypass the model and preserve the same conversation through escalation", async (context) => {
  const setup = await createAiCase(
    context,
    "Please provide a formal transfer pricing opinion for our cross-border transaction.",
  );
  const provider = new FakeAiProvider(() => {
    throw new Error("Hard-risk questions must not reach the model");
  });
  const answer = await new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  ).answerCaseQuestion(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "complex-risk-route-01",
  });
  assert.equal(answer.status, "needs_human");
  assert.ok(answer.reasonCodes.includes("transfer_pricing"));
  assert.equal(provider.calls, 0);

  const escalations = new EscalationsService(
    setup.database,
    setup.guestTokens,
    runtimeConfig,
  );
  const escalation = await escalations.escalateConversation(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    reason: "Please bring an expert into this conversation.",
    reasonCodes: answer.reasonCodes,
  });
  assert.equal(escalation.conversationId, setup.submitted.clientConversationId);
  assert.equal(
    (await new CasesRepository(setup.database).findCaseById(setup.submitted.id))?.status,
    "human_review_required",
  );
  const messages = await new ConversationsDal(
    setup.database,
    setup.guestTokens,
  ).getMessages(setup.actor, setup.submitted.clientConversationId);
  assert.equal(messages.messages[0]?.bodyMarkdown, setup.message.bodyMarkdown);
  assert.deepEqual(
    messages.messages.map((message) => message.authorType),
    ["user", "ai", "system"],
  );

  const lead = await createUser(setup.database, "consultant", "handoff-lead");
  await new CasesService(setup.database, setup.guestTokens).assignMember(
    createSyntheticUserActor(setup.admin.id),
    {
      caseId: setup.submitted.id,
      userId: lead.id,
      caseRole: "lead_consultant",
      reason: "Assigned to the escalated case",
    },
  );
  const handoff = await escalations.getActiveEscalationContext(
    createSyntheticUserActor(lead.id),
    setup.submitted.id,
  );
  assert.equal(handoff.id, escalation.id);
  assert.equal(
    JSON.stringify(handoff.handoffSummary).includes(setup.message.bodyMarkdown),
    true,
  );
  await assert.rejects(
    escalations.getActiveEscalationContext(setup.actor, setup.submitted.id),
    hasDomainError("FORBIDDEN"),
  );
});

test("provider failure becomes a safe human recommendation", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  await ingestSyntheticSource(setup.database, setup.guestTokens, setup.admin);
  const provider = new FakeAiProvider(() => {
    throw new AiProviderError("upstream_unavailable", "synthetic failure", true);
  });
  const result = await new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  ).answerCaseQuestion(setup.actor, {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "provider-failure-answer-01",
    relevantDate: "2026-08-30",
  });
  assert.equal(result.status, "needs_human");
  assert.ok(result.reasonCodes.includes("ai_provider_failure"));
  assert.equal(
    (await new AiRunsRepository(setup.database).findById(result.aiRunId))?.errorCode,
    "upstream_unavailable",
  );
});

test("duplicate AI requests replay one durable result without a second provider call", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  const source = await ingestSyntheticSource(
    setup.database,
    setup.guestTokens,
    setup.admin,
  );
  const provider = new FakeAiProvider(() => validOutput(source.sections[0]!.id));
  const service = new AnswerCaseQuestionService(
    setup.database,
    setup.guestTokens,
    provider,
    runtimeConfig,
  );
  const input = {
    caseId: setup.submitted.id,
    conversationId: setup.submitted.clientConversationId,
    userMessageId: setup.message.id,
    idempotencyKey: "duplicate-ai-answer-01",
    relevantDate: "2026-08-30",
  };
  const first = await service.answerCaseQuestion(setup.actor, input);
  const replay = await service.answerCaseQuestion(setup.actor, input);
  assert.equal(replay.aiRunId, first.aiRunId);
  assert.equal(replay.messageId, first.messageId);
  assert.equal(provider.calls, 1);
});

test("AI answer service rejects cross-client IDOR attempts before model access", async (context) => {
  const setup = await createAiCase(
    context,
    "What does the synthetic filing acknowledgement say about timing?",
  );
  const outsider = await createUser(setup.database, "client", "ai-outsider");
  const outsiderAccount = await createClientAccountWithOwner(setup.database, outsider);
  assert.notEqual(outsiderAccount.id, setup.account.id);
  const provider = new FakeAiProvider(() => ({}));
  await assert.rejects(
    new AnswerCaseQuestionService(
      setup.database,
      setup.guestTokens,
      provider,
      runtimeConfig,
    ).answerCaseQuestion(createSyntheticUserActor(outsider.id), {
      caseId: setup.submitted.id,
      conversationId: setup.submitted.clientConversationId,
      userMessageId: setup.message.id,
      idempotencyKey: "cross-client-idor-01",
    }),
    hasDomainError("FORBIDDEN"),
  );
  assert.equal(provider.calls, 0);
});
