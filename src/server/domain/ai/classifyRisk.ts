import "server-only";

import { z } from "zod";
import type { DeterministicRiskResult } from "./types";

export const RISK_RULESET_VERSION = "id-tax-risk-v1";

const hardRiskRules: Array<{ code: string; classification: "complex" | "high_risk"; pattern: RegExp }> = [
  { code: "cross_border_or_treaty", classification: "complex", pattern: /\b(cross[- ]border|lintas batas|tax treaty|perjanjian pajak|p3b)\b/i },
  { code: "permanent_establishment", classification: "complex", pattern: /\b(permanent establishment|bentuk usaha tetap|but)\b/i },
  { code: "transfer_pricing", classification: "high_risk", pattern: /\b(transfer pricing|harga transfer|local file|master file|cbcr)\b/i },
  { code: "beneficial_ownership", classification: "high_risk", pattern: /\b(beneficial owner|beneficial ownership|pemilik manfaat)\b/i },
  { code: "cfc", classification: "high_risk", pattern: /\b(cfc|controlled foreign corporation)\b/i },
  { code: "multi_jurisdiction", classification: "complex", pattern: /\b(multi[- ]jurisdiction|lebih dari satu negara|beberapa negara)\b/i },
  { code: "audit_or_dispute", classification: "high_risk", pattern: /\b(sp2dk|audit|pemeriksaan|sengketa|keberatan|banding|appeal|objection|tax court|pengadilan pajak)\b/i },
  { code: "sanction_or_deadline", classification: "high_risk", pattern: /\b(sanksi|sanction|denda|penalty|deadline|jatuh tempo|batas waktu)\b/i },
  { code: "restructuring_or_ma", classification: "high_risk", pattern: /\b(restrukturisasi|restructuring|merger|akuisisi|acquisition|spin[- ]off|m&a)\b/i },
  { code: "formal_opinion", classification: "high_risk", pattern: /\b(formal opinion|opini resmi|legal opinion|pendapat hukum)\b/i },
  {
    code: "filing_or_representation",
    classification: "high_risk",
    pattern: /\b(file|submit|prepare|sign|represent)\s+(it|this|for me|on my behalf)|\b(bantu\s+lapor|laporkan\s+untuk|tanda\s+tangan|mewakili|bertindak\s+sebagai\s+kuasa)\b/i,
  },
  { code: "material_transaction", classification: "high_risk", pattern: /\b(material transaction|transaksi material|nilai sangat besar|jumlah besar)\b/i },
];

const humanRequestPattern = /\b(speak|talk|connect|hubungkan|bicara|konsultan|consultant|expert|ahli|manusia|human|person)\b/i;

const riskInputSchema = z.object({
  question: z.string().trim().min(1).max(20000),
  jurisdiction: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  taxTopics: z.array(z.string().trim().min(1).max(80)).max(24),
  safeTopicAllowlist: z.array(z.string().trim().min(1).max(80)).max(50),
  requiredFactsAvailable: z.boolean().default(true),
});

export function classifyRisk(input: unknown): DeterministicRiskResult {
  const data = riskInputSchema.parse(input);
  const reasonCodes: string[] = [];
  const missingFacts: string[] = [];
  let classification: DeterministicRiskResult["classification"] = "simple";

  if (!new Set(["ID", "INDONESIA"]).has(data.jurisdiction)) {
    reasonCodes.push("unsupported_jurisdiction");
    classification = "high_risk";
  }
  if (humanRequestPattern.test(data.question)) {
    reasonCodes.push("user_requested_human");
    classification = "high_risk";
  }
  for (const rule of hardRiskRules) {
    if (!rule.pattern.test(data.question)) continue;
    reasonCodes.push(rule.code);
    if (rule.classification === "high_risk" || classification === "simple") {
      classification = rule.classification;
    }
  }
  if (!data.requiredFactsAvailable || data.question.length < 12) {
    reasonCodes.push("missing_critical_facts");
    missingFacts.push("A more specific description of the tax question is required.");
    if (classification === "simple") classification = "needs_information";
  }

  const normalizedAllowlist = new Set(
    data.safeTopicAllowlist.map((topic) => topic.toLowerCase()),
  );
  const topicAllowed = data.taxTopics.some((topic) =>
    normalizedAllowlist.has(topic.toLowerCase()),
  );
  if (!topicAllowed) {
    reasonCodes.push("topic_not_in_ai_safe_allowlist");
    if (classification === "simple") classification = "complex";
  }

  const needsHuman = classification !== "simple";
  return {
    classification,
    canAttemptAiAnswer: !needsHuman,
    needsHuman,
    reasonCodes: [...new Set(reasonCodes)],
    missingFacts,
    rulesetVersion: RISK_RULESET_VERSION,
  };
}
