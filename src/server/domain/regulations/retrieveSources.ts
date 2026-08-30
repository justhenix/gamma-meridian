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

function toFtsQuery(query: string): string | null {
  const terms = [...new Set(
    query
      .toLocaleLowerCase("id")
      .normalize("NFKC")
      .match(/[\p{L}\p{N}]{3,}/gu)
      ?.filter((term) => !stopWords.has(term)) ?? [],
  )].slice(0, 12);
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
    ftsQuery: toFtsQuery(data.query),
    jurisdiction: data.jurisdiction,
    taxTopics: data.taxTopics,
    effectiveAt: data.effectiveAt,
    limit: data.limit,
  });
}
