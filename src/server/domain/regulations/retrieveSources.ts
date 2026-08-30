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
    "dokumen", "induk", "lokal", "penentuan", "harga", "transfer", "transaksi", "afiliasi",
  ],
  "tax.permanent_establishment": ["bentuk", "usaha", "tetap", "kegiatan"],
  "tax.cross_border": ["luar", "negeri", "lintas", "negara", "p3b"],
  "tax.foreign_taxpayer": ["wajib", "pajak", "luar", "negeri"],
  "tax.corporate_income": ["penghasilan", "badan", "tahunan", "spt"],
  "tax.registration": ["npwp", "pendaftaran", "wajib", "pajak"],
  "tax.withholding": ["pemotongan", "penghasilan"],
  "tax.vat": ["pertambahan", "nilai", "pkp"],
  "business.company_setup": ["pendirian", "perseroan", "usaha", "perizinan", "berusaha"],
  "business.foreign_investment": ["penanaman", "modal", "asing", "pma", "perizinan", "berusaha"],
  "business.licensing": ["perizinan", "berusaha", "oss", "risiko"],
  "business.oss": ["oss", "perizinan", "berusaha"],
};

function toFtsQuery(query: string, taxTopics: string[]): string | null {
  const expandedTerms = taxTopics.flatMap((topic) => topicSearchTerms[topic] ?? []);
  const terms = [...new Set(
    [
      ...expandedTerms,
      ...(query
        .toLocaleLowerCase("id")
        .normalize("NFKC")
        .match(/[\p{L}\p{N}]{3,}/gu) ?? []),
    ].filter((term) => !stopWords.has(term)),
  )].slice(0, 20);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replaceAll('"', '""')}"`).join(" OR ");
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
  return new RegulationsRepository(database).retrieve({
    ftsQuery: toFtsQuery(data.query, data.taxTopics),
    jurisdiction: data.jurisdiction,
    taxTopics: data.taxTopics,
    effectiveAt: data.effectiveAt,
    limit: data.limit,
  });
}
