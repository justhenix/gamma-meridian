import "server-only";

import type { RetrievedRegulatorySection } from "../regulations/types";
import { canonicalJson } from "../shared/hash";

export const ANSWER_PROMPT_KEY = "meridian_grounded_case_answer";
export const ANSWER_PROMPT_VERSION = "2";

const MAX_SOURCE_BODY_CHARS = 3200;
const MAX_CONVERSATION_MESSAGES = 8;
const MAX_CONVERSATION_BODY_CHARS = 2500;

const excerptStopWords = new Set([
  "yang", "dan", "atau", "untuk", "dari", "dengan", "pada", "dalam",
  "apa", "bagaimana", "apakah", "saya", "kami", "the", "and", "for",
  "from", "with", "what", "how", "does", "should", "first", "indonesia",
  "indonesian", "pajak", "tax",
]);

function relevantSourceExcerpt(bodyText: string, question: string): string {
  if (bodyText.length <= MAX_SOURCE_BODY_CHARS) return bodyText;
  const terms = [...new Set(
    question
      .toLocaleLowerCase("id")
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]{4,}/gu)
      ?.filter((term) => !excerptStopWords.has(term)) ?? [],
  )].sort((left, right) => right.length - left.length);
  const normalizedBody = bodyText.toLocaleLowerCase("id").normalize("NFKC");
  let matchIndex = -1;
  for (const term of terms) {
    matchIndex = normalizedBody.indexOf(term);
    if (matchIndex >= 0) break;
  }
  if (matchIndex < 0) return bodyText.slice(0, MAX_SOURCE_BODY_CHARS);
  const halfWindow = Math.floor(MAX_SOURCE_BODY_CHARS / 2);
  const start = Math.max(0, Math.min(matchIndex - halfWindow, bodyText.length - MAX_SOURCE_BODY_CHARS));
  return bodyText.slice(start, start + MAX_SOURCE_BODY_CHARS);
}

function compactConversation(conversation: unknown): unknown {
  if (!Array.isArray(conversation)) return conversation;
  return conversation.slice(-MAX_CONVERSATION_MESSAGES).map((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return entry;
    const record = entry as Record<string, unknown>;
    return typeof record.body === "string"
      ? { ...record, body: record.body.slice(0, MAX_CONVERSATION_BODY_CHARS) }
      : record;
  });
}

export function buildGroundedAnswerPrompt(input: {
  locale: "id" | "en";
  question: string;
  jurisdiction: string;
  relevantDate: string;
  taxTopics: string[];
  conversation: unknown;
  intakeFacts: unknown;
  sources: RetrievedRegulatorySection[];
}): { systemPrompt: string; userPrompt: string } {
  const systemPrompt = [
    "You are Meridian's first-line Indonesian tax information assistant.",
    "Return only the requested JSON object. Do not include markdown fences or hidden reasoning.",
    "Legal hallucination is unacceptable. Treat the supplied approved source sections as the only authority for legal claims.",
    "Do not use pretrained memory, web knowledge, or invented identifiers as legal authority.",
    "The request reached you only after Meridian's deterministic risk router classified it as suitable for a first-line AI answer.",
    "Keep classification='simple', canAnswerWithAI=true, and needsHuman=false when the supplied sources support a general informational answer.",
    "Do not require a tax year, transaction value, entity detail, or other case-specific fact when the user only asked for a general overview or preparation checklist and the sources support one.",
    "If the sources do not support the answer, set canAnswerWithAI=false, needsHuman=true, and do not provide an unsupported answer.",
    "Every material legal or numerical claim in answer must appear verbatim in a citation.claim and cite a supplied sourceSectionId.",
    "Keep the answer concise, distinguish known facts from assumptions, and request at most one useful missing fact.",
    "Never promise guaranteed compliance, legality, tax-free treatment, or official approval.",
  ].join("\n");

  const userPrompt = canonicalJson({
    responseLanguage: input.locale,
    case: {
      jurisdiction: input.jurisdiction,
      relevantDate: input.relevantDate,
      taxTopics: input.taxTopics,
    },
    question: input.question,
    intakeFacts: input.intakeFacts,
    conversation: compactConversation(input.conversation),
    approvedSources: input.sources.map((source) => ({
      sourceSectionId: source.id,
      authority: source.source.authority,
      officialIdentifier: source.source.officialIdentifier,
      title: source.source.title,
      jurisdiction: source.source.jurisdiction,
      canonicalUrl: source.source.canonicalUrl,
      version: source.version.versionLabel,
      publicationDate: source.version.publicationDate,
      effectiveFrom: source.version.effectiveFrom,
      effectiveTo: source.version.effectiveTo,
      locator: source.locator,
      heading: source.heading,
      bodyText: relevantSourceExcerpt(source.bodyText, input.question),
    })),
  });
  return { systemPrompt, userPrompt };
}
