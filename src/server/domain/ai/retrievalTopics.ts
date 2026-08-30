import "server-only";

import { GENERAL_ASSISTANT_TOPIC } from "../../config/ai";

const topicRules: Array<{ pattern: RegExp; topics: string[] }> = [
  {
    pattern: /\b(transfer pricing|harga transfer|local file|master file|cbcr|arm['’]?s length|tnmm|profit split)\b/i,
    topics: ["tax.transfer_pricing", "tax.cross_border", "tax.corporate_income"],
  },
  {
    pattern: /\b(permanent establishment|bentuk usaha tetap|\bbut\b)\b/i,
    topics: ["tax.permanent_establishment", "tax.foreign_taxpayer", "tax.cross_border", "tax.registration"],
  },
  {
    pattern: /\b(tax treaty|perjanjian pajak|p3b|form dgt|cross[- ]border|lintas batas)\b/i,
    topics: ["tax.cross_border", "tax.foreign_taxpayer", "tax.withholding"],
  },
  {
    pattern: /\b(vat|ppn|pajak pertambahan nilai)\b/i,
    topics: ["tax.vat", "tax.general", "tax.corporate_income"],
  },
  {
    pattern: /\b(withholding|withhold|pph\s*(?:21|23|26)|pemotongan|dipotong)\b/i,
    topics: ["tax.withholding", "tax.income", "tax.general"],
  },
  {
    pattern: /\b(sp2dk|audit|pemeriksaan|sengketa|keberatan|banding)\b/i,
    topics: ["tax.audit", "tax.general", "tax.registration"],
  },
  {
    pattern: /\b(foreign founder|foreign investor|warga negara asing|orang asing|pma|foreign investment|penanaman modal asing|open (?:a )?business|start (?:a )?business|membuka usaha|pendirian usaha|company setup)\b/i,
    topics: ["business.company_setup", "business.foreign_investment", "business.licensing", "business.oss"],
  },
  {
    pattern: /\b(corporate tax|corporate income tax|pajak perusahaan|pph badan|new(?:ly)? established|perusahaan baru|tax obligation|kewajiban pajak)\b/i,
    topics: ["tax.corporate_income", "tax.general", "tax.registration", "tax.withholding", "tax.vat"],
  },
];

const generalTopics = [
  "tax.general",
  "tax.registration",
  "tax.corporate_income",
  "business.company_setup",
  "business.foreign_investment",
  "business.licensing",
];

export function inferRetrievalTopics(question: string, caseTopics: string[]): string[] {
  const specificCaseTopics = caseTopics.filter((topic) => topic !== GENERAL_ASSISTANT_TOPIC);
  const inferred = topicRules.flatMap((rule) => rule.pattern.test(question) ? rule.topics : []);
  if (inferred.length > 0) {
    return [...new Set([...specificCaseTopics, ...inferred])];
  }
  if (specificCaseTopics.length > 0) {
    return [...new Set(specificCaseTopics)];
  }
  return generalTopics;
}
