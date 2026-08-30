import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";

import type { Actor } from "../../auth/actor";
import { AuthorizationPolicy } from "../../auth/policy";
import type { GuestTokenService } from "../../auth/guest-token";
import type { AiRuntimeConfig } from "../../config/ai";
import { AiRunsRepository } from "../../db/repositories/ai-runs";
import { ConversationsRepository } from "../../db/repositories/conversations";
import { IntakeRepository } from "../../db/repositories/intake";
import { RecommendationsRepository } from "../../db/repositories/recommendations";
import { RegulationsRepository } from "../../db/repositories/regulations";
import { withWriteTransaction } from "../../db/transaction";
import {
  AiProviderError,
  type AiProvider,
  type AiProviderResult,
} from "../../integrations/ai/provider";
import { AuditService } from "../audit/service";
import type { RetrievedRegulatorySection } from "../regulations/types";
import { retrieveApprovedSources } from "../regulations/retrieveSources";
import { DomainError } from "../shared/errors";
import { canonicalJson, sha256 } from "../shared/hash";
import {
  aiAnswerContractSchema,
  aiAnswerJsonSchema,
  type AiAnswerContract,
} from "./contract";
import { classifyRisk } from "./classifyRisk";
import {
  ANSWER_PROMPT_KEY,
  ANSWER_PROMPT_VERSION,
  buildGroundedAnswerPrompt,
} from "./prompt";
import { humanRecommendationMessage, unavailableSourceMessage } from "./safeResponse";
import { sanitizeForAi } from "./sanitize";
import type { AiRunRecord, AnswerCaseQuestionResult } from "./types";
import { validateAiResult } from "./validateAIResult";

const answerQuestionSchema = z.object({
  caseId: z.uuid(),
  conversationId: z.uuid(),
  userMessageId: z.uuid(),
  idempotencyKey: z.string().trim().min(8).max(160),
  relevantDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function safetyContract(input: {
  classification: AiAnswerContract["classification"];
  reasonCodes: string[];
  missingFacts?: string[];
  answer: string;
}): AiAnswerContract {
  return {
    classification: input.classification,
    canAnswerWithAI: false,
    needsHuman: true,
    reasonCodes: [...new Set(input.reasonCodes)],
    missingFacts: input.missingFacts ?? [],
    answer: input.answer,
    citations: [],
    assumptions: [],
    humanHandoffSummary: input.answer,
  };
}

export class AnswerCaseQuestionService {
  constructor(
    private readonly database: Client,
    private readonly guestTokens: GuestTokenService,
    private readonly provider: AiProvider,
    private readonly runtimeConfig: AiRuntimeConfig,
  ) {}

  async answerCaseQuestion(
    actor: Actor,
    input: unknown,
  ): Promise<AnswerCaseQuestionResult> {
    const data = answerQuestionSchema.parse(input);
    const policy = new AuthorizationPolicy(this.database, this.guestTokens);
    const access = await policy.requireCaseAccess(actor, data.caseId);
    const conversations = new ConversationsRepository(this.database);
    const conversation = await conversations.findConversationById(data.conversationId);
    if (!conversation || conversation.caseId !== access.caseRecord.id) {
      throw new DomainError("NOT_FOUND", "Conversation was not found for this case");
    }
    if (conversation.channel !== "client" || conversation.status !== "open") {
      throw new DomainError("INVALID_STATE", "AI answers require an open client conversation");
    }
    await policy.requireConversationAccess(actor, conversation.caseId, conversation.channel);

    const userMessage = await conversations.findMessageById(data.userMessageId);
    if (
      !userMessage ||
      userMessage.conversationId !== conversation.id ||
      userMessage.authorType !== "user" ||
      userMessage.authorUserId !== access.user.id
    ) {
      throw new DomainError("FORBIDDEN", "The triggering user message is not accessible");
    }

    const existing = await new AiRunsRepository(this.database).findByIdempotency(
      conversation.id,
      data.idempotencyKey,
    );
    if (existing) return this.replay(existing);

    const relevantDate =
      data.relevantDate ?? access.caseRecord.taxPeriodEnd ?? new Date().toISOString().slice(0, 10);
    const messageHistory = await conversations.listMessages(conversation.id);
    const intakeAnswers = await new IntakeRepository(this.database).listAnswers(
      access.caseRecord.intakeSessionId,
    );
    const risk = classifyRisk({
      question: userMessage.bodyMarkdown,
      jurisdiction: access.caseRecord.primaryJurisdiction,
      taxTopics: access.caseRecord.taxTopics,
      safeTopicAllowlist: this.runtimeConfig.safeTopics,
      requiredFactsAvailable: userMessage.bodyMarkdown.trim().length >= 12,
    });

    let sources: RetrievedRegulatorySection[] = [];
    if (risk.canAttemptAiAnswer) {
      sources = await retrieveApprovedSources(this.database, {
        query: userMessage.bodyMarkdown,
        jurisdiction: access.caseRecord.primaryJurisdiction,
        taxTopics: access.caseRecord.taxTopics,
        effectiveAt: relevantDate,
        limit: 6,
      });
    }

    const sanitizedConversation = sanitizeForAi(
      messageHistory.map((message) => ({
        id: message.id,
        authorType: message.authorType,
        body: message.bodyMarkdown,
        language: message.language,
      })),
    );
    const sanitizedIntake = sanitizeForAi(
      intakeAnswers.map((answer) => ({
        questionKey: answer.questionKey,
        answer: answer.answer,
      })),
    );
    const inputSnapshot = sanitizeForAi({
      caseId: access.caseRecord.id,
      conversationId: conversation.id,
      userMessageId: userMessage.id,
      jurisdiction: access.caseRecord.primaryJurisdiction,
      taxTopics: access.caseRecord.taxTopics,
      relevantDate,
      risk,
      conversation: sanitizedConversation,
      intakeFacts: sanitizedIntake,
      sourceSectionIds: sources.map((source) => source.id),
    });
    const inputSnapshotJson = canonicalJson(inputSnapshot);

    const claimed = await withWriteTransaction(this.database, async (transaction) => {
      const runs = new AiRunsRepository(transaction);
      const result = await runs.claim({
        caseId: access.caseRecord.id,
        conversationId: conversation.id,
        triggerType: "user_message",
        triggerId: userMessage.id,
        requestedByUserId: access.user.id,
        provider: this.provider.providerName,
        model: this.provider.model,
        promptKey: ANSWER_PROMPT_KEY,
        promptVersion: ANSWER_PROMPT_VERSION,
        rulesetVersion: risk.rulesetVersion,
        inputSnapshotJson,
        inputSha256: sha256(inputSnapshotJson),
        idempotencyKey: data.idempotencyKey,
      });
      if (result.created) {
        await runs.attachSources(result.run.id, sources);
        await new AuditService(transaction).write(actor, {
          caseId: access.caseRecord.id,
          eventType: "ai.run_started",
          targetType: "ai_run",
          targetId: result.run.id,
          metadata: { sourceCount: sources.length, purpose: "answer_case_question" },
        });
      }
      return result;
    });
    if (!claimed.created) return this.replay(claimed.run);

    if (!risk.canAttemptAiAnswer) {
      const contract = safetyContract({
        classification: risk.classification,
        reasonCodes: risk.reasonCodes,
        missingFacts: risk.missingFacts,
        answer: humanRecommendationMessage(
          userMessage.language,
          this.runtimeConfig.expertEscalationFree,
        ),
      });
      return this.persistWithheld(actor, claimed.run, contract, "escalated", null);
    }

    if (sources.length === 0) {
      const contract = safetyContract({
        classification: "complex",
        reasonCodes: ["missing_approved_source"],
        answer: unavailableSourceMessage(userMessage.language),
      });
      return this.persistWithheld(actor, claimed.run, contract, "escalated", null);
    }

    const prompt = buildGroundedAnswerPrompt({
      locale: userMessage.language,
      question: String(sanitizeForAi(userMessage.bodyMarkdown)),
      jurisdiction: access.caseRecord.primaryJurisdiction,
      relevantDate,
      taxTopics: access.caseRecord.taxTopics,
      conversation: sanitizedConversation,
      intakeFacts: sanitizedIntake,
      sources,
    });

    let providerResult: AiProviderResult;
    try {
      providerResult = await this.provider.generateStructuredAnswer({
        ...prompt,
        jsonSchema: aiAnswerJsonSchema as unknown as Record<string, unknown>,
        idempotencyKey: data.idempotencyKey,
      });
    } catch (error) {
      const code = error instanceof AiProviderError ? error.code : "provider_failure";
      const providerRequestId = error instanceof AiProviderError
        ? error.providerRequestId
        : null;
      const contract = safetyContract({
        classification: "complex",
        reasonCodes: ["ai_provider_failure"],
        answer: unavailableSourceMessage(userMessage.language),
      });
      return this.persistWithheld(
        actor,
        claimed.run,
        contract,
        "failed",
        code,
        providerRequestId,
      );
    }

    const validation = validateAiResult({
      output: providerResult.output,
      suppliedSources: sources,
      jurisdiction: access.caseRecord.primaryJurisdiction,
      effectiveAt: relevantDate,
    });
    const validatedContract = validation.contract;
    if (!validation.canPublish || !validatedContract) {
      const contract = safetyContract({
        classification: "complex",
        reasonCodes: ["ai_output_validation_failed", ...validation.issues],
        answer: unavailableSourceMessage(userMessage.language),
      });
      return this.persistWithheld(
        actor,
        claimed.run,
        contract,
        "invalid",
        "output_validation_failed",
        providerResult.providerRequestId,
        providerResult,
        providerResult.output,
      );
    }

    return withWriteTransaction(this.database, async (transaction) => {
      const outputJson = canonicalJson(validatedContract);
      const runs = new AiRunsRepository(transaction);
      await runs.finalize({
        id: claimed.run.id,
        status: "succeeded",
        providerRequestId: providerResult.providerRequestId,
        outputJson,
        outputSha256: sha256(outputJson),
        inputTokens: providerResult.inputTokens,
        outputTokens: providerResult.outputTokens,
        latencyMs: providerResult.latencyMs,
      });
      const recommendation = await new RecommendationsRepository(
        transaction,
      ).createPublishedAiRecommendation({
        caseId: access.caseRecord.id,
        conversationId: conversation.id,
        aiRunId: claimed.run.id,
        language: userMessage.language,
        content: validatedContract,
        contentJson: outputJson,
        contentSha256: sha256(outputJson),
        sources,
      });
      const message = await new ConversationsRepository(transaction).createMessage({
        conversationId: conversation.id,
        authorType: "ai",
        authorUserId: null,
        aiRunId: claimed.run.id,
        bodyMarkdown: validatedContract.answer,
        language: userMessage.language,
        clientRequestId: `ai-answer:${claimed.run.id}`,
      });
      await new AuditService(transaction).write(actor, {
        caseId: access.caseRecord.id,
        eventType: "ai.answer_published",
        targetType: "recommendation_version",
        targetId: recommendation.id,
        changedFields: ["status", "content_sha256"],
        metadata: { aiRunId: claimed.run.id, citationCount: validatedContract.citations.length },
      });
      return this.toResult(
        claimed.run.id,
        "answered",
        validatedContract,
        message.id,
        recommendation.id,
        sources,
      );
    });
  }

  private async persistWithheld(
    actor: Actor,
    run: AiRunRecord,
    contract: AiAnswerContract,
    status: "failed" | "invalid" | "escalated",
    errorCode: string | null,
    providerRequestId: string | null = null,
    providerResult?: AiProviderResult,
    storedOutput: unknown = contract,
  ): Promise<AnswerCaseQuestionResult> {
    return withWriteTransaction(this.database, async (transaction) => {
      const outputJson = canonicalJson(storedOutput);
      await new AiRunsRepository(transaction).finalize({
        id: run.id,
        status,
        providerRequestId,
        outputJson,
        outputSha256: sha256(outputJson),
        inputTokens: providerResult?.inputTokens ?? null,
        outputTokens: providerResult?.outputTokens ?? null,
        latencyMs: providerResult?.latencyMs ?? null,
        errorCode,
      });
      const message = await new ConversationsRepository(transaction).createMessage({
        conversationId: run.conversationId,
        authorType: "ai",
        authorUserId: null,
        aiRunId: run.id,
        bodyMarkdown: contract.answer,
        language: this.languageFromSnapshot(run),
        clientRequestId: `ai-withheld:${run.id}`,
      });
      await new AuditService(transaction).write(actor, {
        caseId: run.caseId,
        eventType: "ai.answer_withheld",
        targetType: "ai_run",
        targetId: run.id,
        reasonCode: errorCode ?? contract.reasonCodes[0] ?? "human_review_required",
        metadata: { status, reasonCodes: contract.reasonCodes },
      });
      return this.toResult(run.id, "needs_human", contract, message.id, null, []);
    });
  }

  private languageFromSnapshot(run: AiRunRecord): "id" | "en" {
    const snapshot = run.inputSnapshot as { conversation?: Array<{ language?: unknown }> };
    const language = snapshot.conversation?.at(-1)?.language;
    return language === "en" ? "en" : "id";
  }

  private async replay(run: AiRunRecord): Promise<AnswerCaseQuestionResult> {
    if (run.status === "running" || run.status === "pending") {
      throw new DomainError("CONFLICT", "This AI request is already in progress");
    }
    const conversations = new ConversationsRepository(this.database);
    const message = await conversations.findMessageByAiRun(run.id);
    if (!message) throw new DomainError("INVALID_STATE", "AI run client message is missing");
    const parsedOutput = aiAnswerContractSchema.safeParse(run.output);
    const contract = run.status === "succeeded" && parsedOutput.success
      ? parsedOutput.data
      : safetyContract({
          classification: "complex",
          reasonCodes: [run.errorCode ?? `ai_run_${run.status}`],
          answer: message.bodyMarkdown,
        });
    const recommendation = await new RecommendationsRepository(this.database).findByAiRun(run.id);
    const sourceIds = await new AiRunsRepository(this.database).listSourceSectionIds(run.id);
    const regulations = new RegulationsRepository(this.database);
    const sources = (await Promise.all(
      sourceIds.map((id) => regulations.findRetrievedSectionById(id)),
    )).filter((source): source is RetrievedRegulatorySection => source !== null);
    return this.toResult(
      run.id,
      run.status === "succeeded" ? "answered" : "needs_human",
      contract,
      message.id,
      recommendation?.id ?? null,
      sources,
    );
  }

  private toResult(
    aiRunId: string,
    status: "answered" | "needs_human",
    contract: AiAnswerContract,
    messageId: string,
    recommendationVersionId: string | null,
    sources: RetrievedRegulatorySection[],
  ): AnswerCaseQuestionResult {
    const sourceById = new Map(sources.map((source) => [source.id, source]));
    return {
      aiRunId,
      status,
      needsHuman: status === "needs_human",
      reasonCodes: contract.reasonCodes,
      messageId,
      recommendationVersionId,
      answer: contract.answer,
      citations: contract.citations.flatMap((citation) => {
        const source = sourceById.get(citation.sourceSectionId);
        return source
          ? [{
              sourceSectionId: source.id,
              officialIdentifier: source.source.officialIdentifier,
              title: source.source.title,
              authority: source.source.authority,
              canonicalUrl: source.source.canonicalUrl,
              locator: source.locator,
            }]
          : [];
      }),
    };
  }
}
