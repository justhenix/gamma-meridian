import "server-only";

import { z } from "zod";
import type { DeterministicRiskResult } from "./types";

export const RISK_RULESET_VERSION = "id-tax-risk-v2";

const hardRiskRules: Array<{ code: string; classification: "complex" | "high_risk"; pattern: RegExp }> = [
  { code: "multi_jurisdiction", classification: "complex", pattern: /\b(multi[- ]jurisdiction|lebih dari satu negara|beberapa negara)\b/i },
  { code: "audit_or_dispute", classification: "high_risk", pattern: /\b(sp2dk|audit|pemeriksaan|sengketa|keberatan|banding|appeal|objection|tax court|pengadilan pajak)\b/i },
  { code: "sanction_or_deadline", classification: "high_risk", pattern: /\b(sanksi|sanction|denda|penalty|late filing|terlambat)\b/i },
  { code: "restructuring_or_ma", classification: "high_risk", pattern: /\b(restrukturisasi|restructuring|merger|akuisisi|acquisition|spin[- ]off|m&a)\b/i },
  { code: "formal_opinion", classification: "high_risk", pattern: /\b(formal opinion|opini resmi|legal opinion|pendapat hukum)\b/i },
  {
    code: "filing_or_representation",
    classification: "high_risk",
    pattern: /\b(file|submit|prepare|sign|represent)\s+(it|this|for me|on my behalf)|\b(bantu\s+lapor|laporkan\s+untuk|tanda\s+tangan|mewakili|bertindak\s+sebagai\s+kuasa)\b/i,
  },
  { code: "material_transaction", classification: "high_risk", pattern: /\b(material transaction|transaksi material|nilai sangat besar|jumlah besar)\b/i },
];

const contextualRiskRules: Array<{
  code: string;
  classification: "complex" | "high_risk";
  topicPattern: RegExp;
  advicePattern: RegExp;
}> = [
  {
    code: "transfer_pricing",
    classification: "high_risk",
    topicPattern: /\b(transfer pricing|harga transfer|local file|master file|cbcr)\b/i,
    advicePattern: /\b(intercompany|related[- ]party|afiliasi|royalt(?:y|ies|i)|management fee|benchmark|arm['’]?s length|cup|tnmm|profit split|pricing method|metode penentuan|transaction|transaksi)\b/i,
  },
  {
    code: "cross_border_or_treaty",
    classification: "complex",
    topicPattern: /\b(cross[- ]border|lintas batas|tax treaty|perjanjian pajak|p3b)\b/i,
    advicePattern: /\b(treaty rate|tarif p3b|form dgt|withholding|pemotongan|royalt(?:y|ies|i)|service fee|dividend|foreign tax credit|tax residence|residency|permanent establishment|bentuk usaha tetap|transaction|transaksi)\b/i,
  },
  {
    code: "permanent_establishment",
    classification: "complex",
    topicPattern: /\b(permanent establishment|bentuk usaha tetap|but)\b/i,
    advicePattern: /\b(does|would|could|trigger|constitute|create|our|kami|kita|apakah|menimbulkan|membentuk|termasuk)\b/i,
  },
  {
    code: "beneficial_ownership",
    classification: "high_risk",
    topicPattern: /\b(beneficial owner|beneficial ownership|pemilik manfaat)\b/i,
    advicePattern: /\b(qualif|eligible|our|kami|kita|apakah|memenuhi|status|claim|klaim)\w*/i,
  },
  {
    code: "cfc",
    classification: "high_risk",
    topicPattern: /\b(cfc|controlled foreign corporation)\b/i,
    advicePattern: /\b(apply|trigger|our|kami|kita|apakah|berlaku|terutang|income|penghasilan)\b/i,
  },
];

import { matchConversationalIntent } from "./safeResponse";
import { evaluateGuardrails } from "./guardrails";

const humanRequestPattern =
  /\b(?:(?:speak|talk|connect|chat|communicate)\s+(?:with|to)|hubungkan\s+dengan|bicara\s+dengan|sambungkan\s+ke|transfer\s+to|switch\s+to)\s+(?:a\s+|an\s+)?(?:human|person|agent|consultant|expert|specialist|advisor|konsultan|ahli|manusia|staf|staff)\b|\b(?:talk|speak)\s+to\s+someone\b|\b(?:i\s+want|need|prefer)\s+(?:to\s+speak\s+with|to\s+talk\s+to|a)\s+(?:human|expert|consultant|person)\b|\b(?:minta|butuh|ingin)\s+(?:bicara|konsultasi|terhubung)\s+dengan\s+(?:manusia|ahli|konsultan)\b/i;

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

  const guardrail = evaluateGuardrails(data.question);
  if (guardrail.triggered && guardrail.reasonCode) {
    reasonCodes.push(guardrail.reasonCode);
    classification = "high_risk";
  }

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
  for (const rule of contextualRiskRules) {
    if (!rule.topicPattern.test(data.question) || !rule.advicePattern.test(data.question)) continue;
    reasonCodes.push(rule.code);
    if (rule.classification === "high_risk" || classification === "simple") {
      classification = rule.classification;
    }
  }
  const isConversational = matchConversationalIntent(data.question) !== null;
  if (!isConversational && (!data.requiredFactsAvailable || data.question.length < 12)) {
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
