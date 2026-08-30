import assert from "node:assert/strict";
import test from "node:test";

import { validateAiResult } from "../../src/server/domain/ai/validateAIResult";
import type { RetrievedRegulatorySection } from "../../src/server/domain/regulations/types";

function source(bodyText: string): RetrievedRegulatorySection {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sourceVersionId: "00000000-0000-4000-8000-000000000002",
    heading: "Pasal 16",
    locator: "PMK 172/2023 Pasal 16",
    ordinal: 16,
    bodyText,
    bodySha256: "hash",
    taxTopics: ["tax.transfer_pricing"],
    createdAt: "2026-08-30T00:00:00.000Z",
    source: {
      id: "00000000-0000-4000-8000-000000000003",
      officialIdentifier: "PMK 172 TAHUN 2023",
      title: "Penerapan Prinsip Kewajaran dan Kelaziman Usaha",
      authority: "Kementerian Keuangan",
      jurisdiction: "ID",
      sourceType: "ministerial_regulation",
      canonicalUrl: "https://example.invalid/pmk-172",
      status: "active",
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    },
    version: {
      id: "00000000-0000-4000-8000-000000000002",
      regulatorySourceId: "00000000-0000-4000-8000-000000000003",
      versionLabel: "v1",
      publicationDate: "2023-12-29",
      effectiveFrom: "2023-12-29",
      effectiveTo: null,
      retrievedAt: "2026-08-30T00:00:00.000Z",
      contentSha256: "hash",
      reviewStatus: "approved",
      reviewedByUserId: null,
      reviewedAt: "2026-08-30T00:00:00.000Z",
      createdAt: "2026-08-30T00:00:00.000Z",
    },
    retrievalMethod: "fts5_bm25",
    retrievalScore: -1,
  };
}

test("validator accepts translated answers backed by source-language citations and common rupiah OCR", () => {
  const supplied = source(
    "Wajib Pajak dengan nilai peredaran bruto lebih dari RpS0.000.000.000,00 (lima puluh miliar rupiah) wajib menyelenggarakan Dokumen Penentuan Harga Transfer.",
  );
  const answer = "A relevant gross-turnover threshold is Rp50,000,000,000.00.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "Wajib Pajak dengan nilai peredaran bruto lebih dari RpS0.000.000.000,00 (lima puluh miliar rupiah) wajib menyelenggarakan Dokumen Penentuan Harga Transfer.",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator still rejects unsupported numbers", () => {
  const supplied = source("The synthetic statutory period is 3 business days.");
  const answer = "The statutory period is 4 business days.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote: supplied.bodyText }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("unsupported_numerical_claim"));
});

test("validator matches English scale words to OCR-corrupted full rupiah amounts", () => {
  const supplied = source(
    "Peredaran bruto konsolidasi paling sedikit Rpl l.000.000.000.000,00 (sebelas triliun rupiah).",
  );
  const answer = "The consolidated gross-turnover threshold is IDR 11 trillion.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "Peredaran bruto konsolidasi paling sedikit Rpl l.000.000.000.000,00 (sebelas triliun rupiah).",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator treats PMK slash-year and TAHUN citation styles as equivalent", () => {
  const supplied = source("PMK 172 TAHUN 2023 mengatur Dokumen Penentuan Harga Transfer.");
  const answer = "PMK 172/2023 governs Indonesian transfer pricing documentation.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "PMK 172 TAHUN 2023 mengatur Dokumen Penentuan Harga Transfer.",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator still rejects unsupported legal identifiers", () => {
  const supplied = source("PMK 172 TAHUN 2023 mengatur Dokumen Penentuan Harga Transfer.");
  const answer = "PMK 999/2099 governs this rule.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: supplied.bodyText,
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("unsupported_legal_identifier"));
});

test("validator does not collapse decimal percentages into different integers", () => {
  const supplied = source("The synthetic tax rate is 15%.");
  const answer = "The synthetic tax rate is 1.5%.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote: supplied.bodyText }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("unsupported_numerical_claim"));
});

test("validator compares complete legal identifiers instead of substrings", () => {
  const supplied = source("PMK 172 TAHUN 2023 mengatur Dokumen Penentuan Harga Transfer.");
  const answer = "PMK 172/202 is the governing regulation.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote: supplied.bodyText }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("unsupported_legal_identifier"));
});

test("validator removes uncited qualitative answer segments from the published contract", () => {
  const supportedClaim = "Taxpayers must maintain transfer pricing documentation.";
  const unsupportedClaim = "All related-party transactions are automatically tax exempt.";
  const supplied = source(supportedClaim);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer: `${supportedClaim} ${unsupportedClaim}`,
      citations: [{
        sourceSectionId: supplied.id,
        claim: supportedClaim,
        sourceQuote: supportedClaim,
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.equal(result.contract?.answer, supportedClaim);
  assert.equal(result.contract?.answer.includes(unsupportedClaim), false);
});

test("validator enforces the prompt's 180-word publication limit", () => {
  const answer = Array.from({ length: 181 }, () => "records").join(" ");
  const supplied = source(answer);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote: answer }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("answer_too_long"));
});

test("validator normalizes an empty non-human handoff summary to null", () => {
  const answer = "Taxpayers must keep the synthetic records.";
  const supplied = source(answer);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote: answer }],
      assumptions: [],
      humanHandoffSummary: "",
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.equal(result.contract?.humanHandoffSummary, null);
});

test("validator does not treat numbered-list markers as numerical claims", () => {
  const firstClaim = "Keep the synthetic records.";
  const secondClaim = "Retain the synthetic receipts.";
  const supplied = source(`${firstClaim} ${secondClaim}`);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer: `1. ${firstClaim}\n2. ${secondClaim}`,
      citations: [
        { sourceSectionId: supplied.id, claim: firstClaim, sourceQuote: firstClaim },
        { sourceSectionId: supplied.id, claim: secondClaim, sourceQuote: secondClaim },
      ],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator rejects translated legal concepts missing from the source quote", () => {
  const sourceText = [
    "Laporan per negara wajib diselenggarakan berdasarkan data dan informasi yang tersedia sampai dengan akhir tahun pajak.",
    "Nilai peredaran bruto tertentu dapat menentukan kewajiban pelaporan.",
  ].join(" ");
  const supplied = source(sourceText);
  const answer = "Prepare a Country-by-Country Report when revenue thresholds apply, using data available through the end of the tax year.";
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "Laporan per negara wajib diselenggarakan berdasarkan data dan informasi yang tersedia sampai dengan akhir tahun pajak.",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("citation_claim_semantic_mismatch"));
});

test("validator does not parse ordinary words beginning with PER as regulations", () => {
  const answer = "Perform comparability analysis before selecting the synthetic method.";
  const sourceQuote = "Conduct comparability analysis before selecting the synthetic method.";
  const supplied = source(sourceQuote);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{ sourceSectionId: supplied.id, claim: answer, sourceQuote }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator rejects ellipsis gaps that omit a material qualifier", () => {
  const sourceText = "Taxpayers must maintain complete transfer pricing records before filing.";
  const answer = "Taxpayers must maintain complete transfer pricing records before filing.";
  const supplied = source(sourceText);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "Taxpayers must maintain... records before filing.",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, false);
  assert.ok(result.issues.includes("citation_claim_semantic_mismatch"));
});

test("validator accepts source quotes with trailing ellipsis", () => {
  const sourceText = "Pelaku usaha wajib melaporkan Tenaga Kerja Asing (Laki-laki/Perempuan) : Diisi dengan jumlah tenaga kerja asing yang dipekerjakan pada kantor perwakilan.";
  const answer = "You must report foreign workforce details through the OSS system.";
  const supplied = source(sourceText);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: answer,
        sourceQuote: "Pelaku usaha wajib melaporkan Tenaga Kerja Asing (Laki-laki/Perempuan) : Diisi dengan jumlah tenaga kerja asing...",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

test("validator accepts citations where model placed Indonesian source quote in claim", () => {
  const sourceText = "Untuk kegiatan usaha Risiko rendah, Pelaku Usaha hanya dipersyaratkan memiliki NIB.";
  const answer = "For low-risk businesses in Indonesia, you only need a Business Identification Number (NIB).";
  const supplied = source(sourceText);
  const result = validateAiResult({
    output: {
      classification: "simple",
      canAnswerWithAI: true,
      needsHuman: false,
      reasonCodes: [],
      missingFacts: [],
      answer,
      citations: [{
        sourceSectionId: supplied.id,
        claim: "Untuk kegiatan usaha Risiko rendah, Pelaku Usaha hanya dipersyaratkan memiliki NIB.",
      }],
      assumptions: [],
      humanHandoffSummary: null,
    },
    suppliedSources: [supplied],
    jurisdiction: "ID",
    effectiveAt: "2026-08-30",
  });
  assert.equal(result.canPublish, true);
  assert.deepEqual(result.issues, []);
});

