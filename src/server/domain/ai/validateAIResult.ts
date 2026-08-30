import "server-only";

import { aiAnswerContractSchema, type AiAnswerContract } from "./contract";
import type { RetrievedRegulatorySection } from "../regulations/types";

export interface AiValidationResult {
  contract: AiAnswerContract | null;
  canPublish: boolean;
  issues: string[];
}

function normalize(value: string): string {
  return value.toLocaleLowerCase("id").normalize("NFKC").replace(/\s+/g, " ").trim();
}

function numericClaims(value: string): string[] {
  return [...new Set(value.match(/\b\d+(?:[.,]\d+)*(?:\s*%)?/g) ?? [])];
}

function legalIdentifiers(value: string): string[] {
  return [...new Set(value.match(/\b(?:UU|PP|PMK|PER|KEP)[-\s]?[A-Z0-9./-]{2,}/gi) ?? [])];
}

const evidenceStopWords = new Set([
  "yang", "dan", "atau", "untuk", "dari", "dengan", "pada", "dalam",
  "adalah", "the", "and", "for", "from", "with", "that", "this", "is",
  "are", "was", "were", "will", "tax", "pajak",
]);

function evidenceTerms(value: string): string[] {
  return [...new Set(
    normalize(value)
      .match(/[\p{L}\p{N}%]{3,}/gu)
      ?.filter((term) => !evidenceStopWords.has(term)) ?? [],
  )];
}

function claimSupportedBySource(claim: string, sourceText: string): boolean {
  const normalizedClaim = normalize(claim);
  const normalizedSource = normalize(sourceText);
  if (normalizedSource.includes(normalizedClaim)) return true;
  const terms = evidenceTerms(claim);
  if (terms.length === 0) return false;
  const supported = terms.filter((term) => normalizedSource.includes(term)).length;
  return supported / terms.length >= 0.8;
}

export function validateAiResult(input: {
  output: unknown;
  suppliedSources: RetrievedRegulatorySection[];
  jurisdiction: string;
  effectiveAt: string;
}): AiValidationResult {
  const parsed = aiAnswerContractSchema.safeParse(input.output);
  if (!parsed.success) {
    return { contract: null, canPublish: false, issues: ["invalid_response_contract"] };
  }

  const contract = parsed.data;
  const issues: string[] = [];
  const sources = new Map(input.suppliedSources.map((source) => [source.id, source]));

  if (contract.classification !== "simple") issues.push("model_classified_non_simple");
  if (!contract.canAnswerWithAI) issues.push("model_declined_ai_answer");
  if (contract.needsHuman) issues.push("model_requested_human_review");
  if (!contract.answer) issues.push("empty_answer");
  if (contract.citations.length === 0) issues.push("missing_citations");

  const citedSources: RetrievedRegulatorySection[] = [];
  for (const citation of contract.citations) {
    const source = sources.get(citation.sourceSectionId);
    if (!source) {
      issues.push("citation_not_supplied");
      continue;
    }
    citedSources.push(source);
    if (source.version.reviewStatus !== "approved") issues.push("citation_unapproved");
    if (source.source.status !== "active") issues.push("citation_source_inactive");
    if (source.source.jurisdiction.toUpperCase() !== input.jurisdiction.toUpperCase()) {
      issues.push("citation_wrong_jurisdiction");
    }
    if (
      source.version.effectiveFrom > input.effectiveAt ||
      (source.version.effectiveTo !== null && source.version.effectiveTo < input.effectiveAt)
    ) {
      issues.push("citation_not_effective");
    }
    if (!normalize(contract.answer).includes(normalize(citation.claim))) {
      issues.push("citation_claim_not_in_answer");
    }
    if (
      !claimSupportedBySource(
        citation.claim,
        [source.source.officialIdentifier, source.source.title, source.locator, source.bodyText].join("\n"),
      )
    ) {
      issues.push("citation_claim_not_supported_by_source");
    }
  }

  const evidence = normalize(
    citedSources
      .map((source) => [
        source.source.officialIdentifier,
        source.source.title,
        source.locator,
        source.bodyText,
      ].join("\n"))
      .join("\n"),
  );
  for (const number of numericClaims(contract.answer)) {
    if (!evidence.includes(normalize(number))) issues.push("unsupported_numerical_claim");
  }
  for (const identifier of legalIdentifiers(contract.answer)) {
    if (!evidence.includes(normalize(identifier))) issues.push("unsupported_legal_identifier");
  }

  return {
    contract,
    canPublish: issues.length === 0,
    issues: [...new Set(issues)],
  };
}
