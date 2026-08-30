import "server-only";

import type { RetrievedRegulatorySection } from "../regulations/types";
import { canonicalJson } from "../shared/hash";

export const ANSWER_PROMPT_KEY = "meridian_grounded_case_answer";
export const ANSWER_PROMPT_VERSION = "1";

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
    conversation: input.conversation,
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
      bodyText: source.bodyText,
    })),
  });
  return { systemPrompt, userPrompt };
}
