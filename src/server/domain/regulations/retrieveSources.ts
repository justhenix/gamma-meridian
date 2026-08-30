import "server-only";

import { z } from "zod";
import type { SqlExecutor } from "../../db/types";
import { RegulationsRepository } from "../../db/repositories/regulations";
import type { RetrievedRegulatorySection } from "./types";

const stopWords = new Set([
  "yang", "dan", "atau", "untuk", "dari", "dengan", "pada", "dalam",
  "apa", "bagaimana", "apakah", "saya", "kami", "the", "and", "for",
  "from", "with", "what", "how", "does", "tax", "pajak",
]);

const topicSearchTerms: Record<string, string[]> = {
  "tax.transfer_pricing": [
    "dokumen induk", "dokumen lokal", "penentuan harga transfer", "transaksi afiliasi",
    "dokumen", "induk", "lokal", "penentuan", "harga", "transfer", "transaksi", "afiliasi",
  ],
  "tax.permanent_establishment": ["bentuk usaha tetap", "kegiatan usaha", "bentuk", "usaha", "tetap", "kegiatan"],
  "tax.cross_border": ["luar negeri", "lintas negara", "luar", "negeri", "lintas", "negara", "p3b"],
  "tax.foreign_taxpayer": ["wajib pajak luar negeri", "wajib", "pajak", "luar", "negeri"],
  "tax.corporate_income": ["pajak penghasilan badan", "surat pemberitahuan tahunan", "spt tahunan", "penghasilan", "badan", "tahunan", "spt"],
  "tax.registration": ["npwp", "pendaftaran wajib pajak", "pendaftaran", "wajib", "pajak"],
  "tax.withholding": ["pemotongan pajak penghasilan", "pemotongan", "penghasilan"],
  "tax.vat": ["pajak pertambahan nilai", "pengusaha kena pajak", "pertambahan", "nilai", "pkp"],
  "business.company_setup": ["pendirian perseroan", "perizinan berusaha", "kegiatan usaha", "pendirian", "perseroan", "usaha", "perizinan", "berusaha"],
  "business.foreign_investment": ["penanaman modal asing", "perizinan berusaha", "penanaman", "modal", "asing", "pma", "perizinan", "berusaha"],
  "business.licensing": ["perizinan berusaha", "berbasis risiko", "perizinan", "berusaha", "oss", "risiko"],
  "business.oss": ["sistem oss", "perizinan berusaha", "oss", "perizinan", "berusaha"],
};

function toFtsQuery(query: string, taxTopics: string[]): string | null {
  const expandedTerms = taxTopics.flatMap((topic) => topicSearchTerms[topic] ?? []);
  const queryTerms = query
    .toLocaleLowerCase("id")
    .normalize("NFKC")
    .match(/[\p{L}\p{N}]{3,}/gu) ?? [];
  const terms = [...new Set(
    [
      ...queryTerms,
      ...expandedTerms,
    ].filter((term) => !stopWords.has(term)),
  )].slice(0, 20);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
}

function intentScore(query: string, section: RetrievedRegulatorySection): number {
  const normalizedQuery = query.toLocaleLowerCase("id").normalize("NFKC");
  const text = `${section.heading}\n${section.bodyText}`.toLocaleLowerCase("id").normalize("NFKC");
  let score = 0;

  const asksForTransferPricingDocumentation =
    /\b(transfer pricing|harga transfer|master file|local file)\b/.test(normalizedQuery) &&
    /\b(document|documentation|dokumen|prepare|siap|persiap)\w*/.test(normalizedQuery);
  if (asksForTransferPricingDocumentation) {
    const asksForApa =
      /\badvance pricing agreement\b/.test(normalizedQuery) ||
      /\bkesepakatan harga transfer\b/.test(normalizedQuery) ||
      /\bAPA\b/.test(query);
    const asksForMap =
      /\bmutual agreement procedure\b/.test(normalizedQuery) ||
      /\bprosedur persetujuan bersama\b/.test(normalizedQuery);
    if (text.includes("dokumen induk") && text.includes("dokumen lokal")) score += 20;
    if (text.includes("harus memuat informasi")) score += 30;
    if (text.includes("dokumen penentuan harga transfer")) score += 8;
    if (!asksForApa && (text.includes("kesepakatan harga transfer") || text.includes("advance pricing agreement"))) {
      score -= 35;
    }
    if (!asksForMap && (text.includes("prosedur persetujuan bersama") || text.includes("mutual agreement procedure"))) {
      score -= 35;
    }
  }

  // Huge appendix chunks are expensive prompt context and usually contain many
  // unrelated forms. Keep them available as a fallback, but prefer focused articles.
  if (section.bodyText.length > 20_000) score -= 20;
  return score;
}

function rerank(
  query: string,
  sections: RetrievedRegulatorySection[],
  limit: number,
): RetrievedRegulatorySection[] {
  return sections
    .map((section, index) => ({ section, index, score: intentScore(query, section) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(({ section }) => section);
}

const retrievalInputSchema = z.object({
  query: z.string().trim().min(2).max(20000),
  jurisdiction: z.string().trim().min(2).max(80).transform((value) => value.toUpperCase()),
  taxTopics: z
    .array(z.string().trim().min(1).max(80))
    .max(24)
    .default([])
    .transform((topics) => [...new Set(topics.map((topic) => topic.toLowerCase()))]),
  effectiveAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  limit: z.number().int().min(1).max(12).default(6),
});

export async function retrieveApprovedSources(
  database: SqlExecutor,
  input: unknown,
): Promise<RetrievedRegulatorySection[]> {
  const data = retrievalInputSchema.parse(input);
  const candidateLimit = 12;
  const candidates = await new RegulationsRepository(database).retrieve({
    ftsQuery: toFtsQuery(data.query, data.taxTopics),
    jurisdiction: data.jurisdiction,
    taxTopics: data.taxTopics,
    effectiveAt: data.effectiveAt,
    limit: candidateLimit,
  });
  return rerank(data.query, candidates, data.limit);
}
