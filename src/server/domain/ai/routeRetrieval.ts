import "server-only";

import { matchConversationalIntent } from "./safeResponse";

export type RetrievalIntentMode =
  | "conversational"
  | "corpus_grounded"
  | "flash_advisory";

export interface RouteRetrievalResult {
  mode: RetrievalIntentMode;
  reason: string;
}

const STATUTORY_CITATION_PATTERNS = [
  /\b(?:pmk|per|kep|uu|pp|perpu)\s*(?:no(?:mor)?\.?)?\s*\d+/i,
  /\b(?:pasal|ayat|huruf)\s*\d+/i,
  /\b(?:undang[- ]undang|peraturan\s+menteri\s+keuangan|peraturan\s+pemerintah)\b/i,
  /\b(?:threshold|ambang\s+batas|omzet\s+minimal|batas\s+peredaran)\b/i,
  /\b(?:tarif|rate|persentase|percentage)\s*(?:pajak|pph|ppn|tax)?\b/i,
  /\b(?:sanksi|denda|penalty|bunga|penalties)\b/i,
  /\b(?:deadline|jatuh\s+tempo|batas\s+waktu|spt\s+tahunan|spt\s+masa)\b/i,
  /\b(?:transfer\s+pricing\s+documentation|tp\s+doc|master\s+file|local\s+file|cbcr)\b/i,
  /\b(?:coretax|sp2dk|bupot|ebupot|faktur\s+pajak)\b/i,
  /\b(?:arm['’]?s\s+length\s+principle|prinsip\s+kewajaran\s+dan\s+kelaziman\s+usaha|pku)\b/i,
  /\b(?:regulation|regulasi|peraturan|statute|statutory|law|timing|acknowledgement)\b/i,
];

export function routeRetrievalMode(
  question: string,
  taxTopics: string[] = [],
): RouteRetrievalResult {
  const trimmed = question.trim();

  // 1. Instant conversational fastpath
  if (matchConversationalIntent(trimmed) !== null) {
    return {
      mode: "conversational",
      reason: "Matched conversational or identity pattern",
    };
  }

  // 2. Specific statutory, regulatory, numerical, or documentation threshold queries -> eat corpus
  for (const pattern of STATUTORY_CITATION_PATTERNS) {
    if (pattern.test(trimmed)) {
      return {
        mode: "corpus_grounded",
        reason: "Query references specific statutory instruments, tax rates, filing deadlines, or TP documentation rules",
      };
    }
  }

  // If case is specifically tagged with formal dispute/audit/treaty topics -> eat corpus
  const corpusTopics = new Set([
    "dispute_defense",
    "sp2dk",
    "tax_audit",
    "transfer_pricing",
    "treaty_relief",
    "coretax_migration",
  ]);
  if (taxTopics.some((topic) => corpusTopics.has(topic.toLowerCase()))) {
    return {
      mode: "corpus_grounded",
      reason: "Case tax topics require grounded regulatory corpus retrieval",
    };
  }

  // 3. Default to flash advisory: general business setup, definitions, orientation, conceptual guidance
  return {
    mode: "flash_advisory",
    reason: "General conceptual advisory query suitable for direct flash guidance without statutory citation dependency",
  };
}
