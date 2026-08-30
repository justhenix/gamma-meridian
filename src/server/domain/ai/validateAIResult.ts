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
  return [...new Set(
    value.match(
      /(?:\b(?:Rp|IDR)\s*)?\d+(?:[.,]\d+)*(?:\s*(?:trillion|billion|million|triliun|miliar|juta|ribu))?(?:\s*%)?/gi,
    ) ?? [],
  )];
}

function repairCommonCurrencyOcr(value: string): string {
  return value
    .replace(/\bRp\s*S0(?=[.,\d])/gi, "Rp 50")
    .replace(/\bRp\s*S(?=[.,\d])/gi, "Rp 5")
    .replace(/\bRp\s*l\s*l(?=[.,\d])/gi, "Rp 11")
    .replace(/\bRp(?=\d)/gi, "Rp ");
}

function canonicalDecimal(value: string): string | null {
  const separatorIndexes = [...value.matchAll(/[.,]/g)].map((match) => match.index);
  let decimalIndex = -1;
  if (separatorIndexes.length > 0) {
    const separators = new Set(separatorIndexes.map((index) => value[index]));
    const lastIndex = separatorIndexes.at(-1)!;
    const trailingDigits = value.length - lastIndex - 1;
    if (separators.size > 1) {
      decimalIndex = lastIndex;
    } else if (separatorIndexes.length === 1 && trailingDigits !== 3) {
      decimalIndex = lastIndex;
    } else if (separatorIndexes.length > 1) {
      const groups = value.split(/[.,]/);
      const groupedInteger = groups.slice(1).every((group) => group.length === 3);
      if (!groupedInteger) decimalIndex = lastIndex;
    }
  }

  const integerPart = (decimalIndex === -1 ? value : value.slice(0, decimalIndex))
    .replace(/[.,]/g, "");
  const fractionPart = decimalIndex === -1
    ? ""
    : value.slice(decimalIndex + 1).replace(/[.,]/g, "").replace(/0+$/, "");
  if (!/^\d+$/.test(integerPart) || (fractionPart && !/^\d+$/.test(fractionPart))) {
    return null;
  }
  const integer = integerPart.replace(/^0+(?=\d)/, "") || "0";
  return fractionPart ? `${integer}.${fractionPart}` : integer;
}

function applyScale(value: string, power: number): string {
  const [integer, fraction = ""] = value.split(".");
  const digits = `${integer}${fraction}`.replace(/^0+(?=\d)/, "") || "0";
  const shiftedPlaces = power - fraction.length;
  if (shiftedPlaces >= 0) return `${digits}${"0".repeat(shiftedPlaces)}`;
  const splitAt = digits.length + shiftedPlaces;
  const padded = splitAt > 0 ? digits : `${"0".repeat(1 - splitAt)}${digits}`;
  const decimalAt = Math.max(1, splitAt);
  return `${padded.slice(0, decimalAt)}.${padded.slice(decimalAt)}`
    .replace(/\.0+$/, "")
    .replace(/(\.\d*?)0+$/, "$1");
}

function canonicalNumber(value: string): string {
  const scalePowers: Record<string, number> = {
    trillion: 12,
    triliun: 12,
    billion: 9,
    miliar: 9,
    million: 6,
    juta: 6,
    ribu: 3,
  };
  const compact = value.replace(/^(?:Rp|IDR)\s*/i, "").trim();
  const percent = compact.endsWith("%");
  const withoutPercent = percent ? compact.slice(0, -1).trim() : compact;
  const scaleMatch = withoutPercent.match(/\s+(trillion|billion|million|triliun|miliar|juta|ribu)$/i);
  const numberPart = scaleMatch
    ? withoutPercent.slice(0, scaleMatch.index).trim()
    : withoutPercent;
  const decimal = canonicalDecimal(numberPart);
  if (!decimal) return `invalid:${normalize(value)}`;
  if (scaleMatch) {
    const scale = scalePowers[scaleMatch[1]!.toLowerCase()]!;
    const scaled = applyScale(decimal, scale);
    return percent ? `${scaled}%` : scaled;
  }
  return percent ? `${decimal}%` : decimal;
}

function legalIdentifiers(value: string): string[] {
  return [...new Set(
    value.match(/\b(?:UU|PP|PMK|PER|KEP)(?=[-\s]?\d)(?:[-\s]?[A-Z0-9./-]{2,})(?:\s+TAHUN\s+\d{2,4})?/gi) ?? [],
  )];
}

function canonicalLegalIdentifier(value: string): string {
  return normalize(value)
    .replace(/\btahun\b/g, " ")
    .replace(/[./-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(value: string): number {
  return value.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0;
}

function stripNumberedListMarkers(value: string): string {
  return value.replace(/^\s*(?:\*{1,2})?\s*\d+[.)]\s*/gm, "");
}

function coverageText(value: string): string {
  return normalize(value)
    .replace(/[*_`#]/g, "")
    .replace(/^(?:[-+]\s+|\d+[.)]\s+)/, "")
    .trim();
}

function reconstructPublishedAnswer(originalAnswer: string, publishedClaims: string[]): string {
  if (publishedClaims.length === 0) return originalAnswer.trim();
  if (publishedClaims.length === 1) return publishedClaims[0]!.trim();

  // If originalAnswer has line breaks (lists, paragraphs, headers), preserve the structured lines
  const rawLines = originalAnswer.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (rawLines.length > 1) {
    const keptLines = rawLines.filter((line) => {
      // Keep markdown headings or category titles like **1. Master File:** or Master File:
      const isHeading = /^(\*\*.*?\*\*|\d+\..*?:|[A-Za-z0-9\s]+:)$/.test(line);
      if (isHeading) return true;
      const normalizedLine = coverageText(line);
      return publishedClaims.some((claim) => {
        const normClaim = coverageText(claim);
        return normalizedLine.includes(normClaim) || normClaim.includes(normalizedLine);
      });
    });
    if (keptLines.length > 1) {
      return keptLines.join("\n\n");
    }
  }

  // If claims already have list markers or newlines, preserve them
  const hasFormatting = publishedClaims.some((c) => /^[-*•]|\d+[.)]/.test(c.trim()) || c.includes("\n"));
  if (hasFormatting) {
    return publishedClaims.join("\n\n").trim();
  }

  // Otherwise join with space
  return publishedClaims.join(" ").trim();
}

function stripPunctuationAndSpacing(value: string): string {
  return value.toLocaleLowerCase("id").normalize("NFKC").replace(/[^0-9\p{L}]+/gu, "");
}

function claimSupportedBySource(claim: string, sourceText: string): boolean {
  const normalizedSource = normalize(sourceText);
  const normalizedClaim = normalize(claim);
  if (normalizedSource.includes(normalizedClaim)) return true;

  // Handle OCR artifacts like hyphenation/broken syllable spacing (e.g. "secar a" for "secara")
  const compactClaim = stripPunctuationAndSpacing(claim);
  const compactSource = stripPunctuationAndSpacing(sourceText);
  if (compactClaim.length >= 12 && compactSource.includes(compactClaim)) return true;

  const fragments = normalizedClaim
    .split(/\s*(?:\.{3}|…)\s*/)
    .map((fragment) => fragment.trim())
    .filter(Boolean);
  if (fragments.length === 0) return false;
  if (fragments.length === 1) {
    const compactFragment = stripPunctuationAndSpacing(fragments[0]!);
    return (
      normalizedSource.includes(fragments[0]!) ||
      (compactFragment.length >= 12 && compactSource.includes(compactFragment))
    );
  }
  if (fragments.some((fragment) => wordCount(fragment) < 2)) {
    return false;
  }
  let offset = 0;
  for (const fragment of fragments) {
    let index = normalizedSource.indexOf(fragment, offset);
    if (index === -1) {
      const compactFrag = stripPunctuationAndSpacing(fragment);
      const compactOffset = stripPunctuationAndSpacing(normalizedSource.slice(0, offset)).length;
      const compIndex = compactSource.indexOf(compactFrag, compactOffset);
      if (compIndex === -1) return false;
      index = offset;
    }
    offset = index + fragment.length;
  }
  return true;
}

const translatedLegalConcepts: Array<{ claim: RegExp; source: RegExp }> = [
  {
    claim: /\b(?:master file|dokumen induk)\b/i,
    source: /\b(?:master file|dokumen induk)\b/i,
  },
  {
    claim: /\b(?:local file|dokumen lokal)\b/i,
    source: /\b(?:local file|dokumen lokal)\b/i,
  },
  {
    claim: /\b(?:country[- ]by[- ]country report|cbcr|laporan per negara)\b/i,
    source: /\b(?:country[- ]by[- ]country report|cbcr|laporan per negara)\b/i,
  },
  {
    claim: /\b(?:thresholds?|gross turnover|revenue threshold|ambang|batas|peredaran bruto)\b/i,
    source: /\b(?:thresholds?|gross turnover|revenue threshold|ambang|batas|peredaran bruto|nilai transaksi)\b/i,
  },
  {
    claim: /\b(?:exempt(?:ion|ed)?|tax[- ]free|dikecualikan|dibebaskan|tidak wajib)\b/i,
    source: /\b(?:exempt(?:ion|ed)?|tax[- ]free|dikecualikan|dibebaskan|tidak wajib)\b/i,
  },
  {
    claim: /\b(?:complete|all|entire|only|automatic(?:ally)?|lengkap|seluruh|semua|hanya|otomatis)\b/i,
    source: /\b(?:complete|all|entire|only|automatic(?:ally)?|lengkap|seluruh|semua|hanya|otomatis)\b/i,
  },
  {
    claim: /\b(?:must|required?|requires?|shall|wajib|harus)\b/i,
    source: /\b(?:must|required?|requires?|shall|wajib|harus)\b/i,
  },
  {
    claim: /\b(?:deadlines?|due date|batas waktu|jangka waktu|paling lama)\b/i,
    source: /\b(?:deadlines?|due date|batas waktu|jangka waktu|paling lama)\b/i,
  },
  {
    claim: /\b(?:related[- ]party|affiliated transaction|transaksi afiliasi|pihak afiliasi|hubungan istimewa)\b/i,
    source: /\b(?:related[- ]party|affiliated transaction|transaksi afiliasi|pihak afiliasi|hubungan istimewa)\b/i,
  },
  {
    claim: /\b(?:arm['’]s length|prinsip kewajaran dan kelaziman usaha|pkku)\b/i,
    source: /\b(?:arm['’]s length|prinsip kewajaran dan kelaziman usaha|pkku)\b/i,
  },
  {
    claim: /\b(?:tax year|tahun pajak)\b/i,
    source: /\b(?:tax year|tahun pajak)\b/i,
  },
  {
    claim: /\b(?:filing|submit|submission|attach|lampiran|disampaikan|surat pemberitahuan|spt)\b/i,
    source: /\b(?:filing|submit|submission|attach|lampiran|disampaikan|surat pemberitahuan|spt)\b/i,
  },
];

function claimConceptsSupportedByQuote(claim: string, sourceQuote: string): boolean {
  return translatedLegalConcepts.every(
    (concept) => !concept.claim.test(claim) || concept.source.test(sourceQuote),
  );
}

export function validateAiResult(input: {
  output: unknown;
  suppliedSources: RetrievedRegulatorySection[];
  jurisdiction: string;
  effectiveAt: string;
  mode?: "corpus_grounded" | "flash_advisory";
}): AiValidationResult {
  const parsed = aiAnswerContractSchema.safeParse(input.output);
  if (!parsed.success) {
    return { contract: null, canPublish: false, issues: ["invalid_response_contract"] };
  }

  const contract = parsed.data;
  const originalAnswer = contract.answer;
  const issues: string[] = [];
  const mode = input.mode ?? "corpus_grounded";

  if (contract.classification !== "simple") issues.push("model_classified_non_simple");
  if (!contract.canAnswerWithAI) issues.push("model_declined_ai_answer");
  if (contract.needsHuman) issues.push("model_requested_human_review");
  if (!originalAnswer) issues.push("empty_answer");

  if (mode === "flash_advisory") {
    if (wordCount(originalAnswer) > 250) issues.push("answer_too_long");
    return {
      contract: { ...contract, answer: originalAnswer.trim(), citations: [] },
      canPublish: issues.length === 0,
      issues: [...new Set(issues)],
    };
  }

  const sources = new Map(input.suppliedSources.map((source) => [source.id, source]));
  if (contract.citations.length === 0) issues.push("missing_citations");

  const citedSources: RetrievedRegulatorySection[] = [];
  const publishedClaims: string[] = [];
  const seenClaims = new Set<string>();
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

    const combinedSourceText = [
      source.source.officialIdentifier,
      source.source.title,
      source.locator,
      source.bodyText,
    ].join("\n");

    const claimText = citation.claim.trim();
    let sourceQuote = citation.sourceQuote?.trim() ?? "";

    // If sourceQuote was omitted and claimText is actually a verbatim Indonesian quote from the source:
    const claimIsSourceQuote = claimSupportedBySource(claimText, combinedSourceText);
    if (!sourceQuote && claimIsSourceQuote) {
      sourceQuote = claimText;
    }

    const effectiveQuote = sourceQuote || claimText;
    if (!claimSupportedBySource(effectiveQuote, combinedSourceText)) {
      issues.push("citation_claim_not_supported_by_source");
    }

    const normalizedClaim = coverageText(claimText);
    const inAnswer = coverageText(originalAnswer).includes(normalizedClaim);
    if (!inAnswer) {
      // If the model put the Indonesian regulatory quote into claim and generated an answer
      // in another language (e.g. English), the quote won't be verbatim in originalAnswer.
      // As long as the quote is genuinely from the cited source, allow it without failing.
      if (!claimIsSourceQuote) {
        issues.push("citation_claim_not_in_answer");
      }
    } else {
      if (seenClaims.has(normalizedClaim)) {
        issues.push("duplicate_citation_claim");
      } else {
        seenClaims.add(normalizedClaim);
        publishedClaims.push(claimText);
      }
    }

    if (sourceQuote && claimText !== sourceQuote) {
      if (!claimConceptsSupportedByQuote(claimText, sourceQuote)) {
        issues.push("citation_claim_semantic_mismatch");
      }
    }
  }

  const publishedAnswer = reconstructPublishedAnswer(originalAnswer, publishedClaims);
  const validatedContract = { ...contract, answer: publishedAnswer };
  if (!publishedAnswer) issues.push("empty_answer");
  if (wordCount(publishedAnswer) > 180) issues.push("answer_too_long");

  const rawEvidence =
    citedSources
      .map((source) => [
        source.source.officialIdentifier,
        source.source.title,
        source.locator,
        source.bodyText,
      ].join("\n"))
      .join("\n");
  const evidenceLegalIdentifiers = new Set(
    legalIdentifiers(rawEvidence).map(canonicalLegalIdentifier),
  );
  const evidenceNumbers = new Set(
    numericClaims(repairCommonCurrencyOcr(rawEvidence)).map(canonicalNumber),
  );
  for (const number of numericClaims(stripNumberedListMarkers(publishedAnswer))) {
    if (!evidenceNumbers.has(canonicalNumber(number))) issues.push("unsupported_numerical_claim");
  }
  for (const identifier of legalIdentifiers(publishedAnswer)) {
    if (!evidenceLegalIdentifiers.has(canonicalLegalIdentifier(identifier))) {
      issues.push("unsupported_legal_identifier");
    }
  }

  return {
    contract: validatedContract,
    canPublish: issues.length === 0,
    issues: [...new Set(issues)],
  };
}
