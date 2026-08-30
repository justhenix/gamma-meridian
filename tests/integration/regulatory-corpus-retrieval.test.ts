import assert from "node:assert/strict";
import test from "node:test";

import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { RegulationsRepository } from "../../src/server/db/repositories/regulations";
import { classifyRisk } from "../../src/server/domain/ai/classifyRisk";
import { RegulatoryIngestionService } from "../../src/server/domain/regulations/ingestSource";
import { retrieveApprovedSources } from "../../src/server/domain/regulations/retrieveSources";
import { createTestDatabase } from "../helpers/database";
import { createUser } from "../helpers/fixtures";

const tokenSecret = "test-token-pepper-regulatory-retrieval-32b";

test("regulatory corpus: approved sources are retrievable by FTS and topics while pending sources remain excluded", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const admin = await createUser(database, "admin", "retrieval-admin");
  const actor = createSyntheticUserActor(admin.id);
  const ingestion = new RegulatoryIngestionService(database, guestTokens);

  // Ingest approved source: PP 44/2022 (VAT / PPN)
  const pp44 = await ingestion.ingestSource(actor, {
    officialIdentifier: "PP 44 TAHUN 2022",
    title: "Penerapan terhadap Pajak Pertambahan Nilai Barang dan Jasa dan PPnBM",
    authority: "Pemerintah Pusat",
    jurisdiction: "ID",
    sourceType: "statute",
    canonicalUrl: "https://jdih.kemenkeu.go.id/dok/pp-44-tahun-2022",
    versionLabel: "2022-12-02",
    publicationDate: "2022-12-02",
    effectiveFrom: "2022-12-02",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    contentSha256: "4444444444444444444444444444444444444444444444444444444444444444",
    sections: [
      {
        heading: "Pasal 4 - Penyerahan BKP dan JKP",
        locator: "Pasal 4",
        ordinal: 4,
        bodyText: "Pajak Pertambahan Nilai dikenakan atas penyerahan Barang Kena Pajak di dalam Daerah Pabean yang dilakukan oleh Pengusaha.",
        taxTopics: ["tax.vat", "tax.general"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, pp44.version.id);

  // Ingest approved source: PMK 168/2023 (PPh 21 withholding)
  const pmk168 = await ingestion.ingestSource(actor, {
    officialIdentifier: "PMK 168 TAHUN 2023",
    title: "Petunjuk Pelaksanaan Pemotongan Pajak atas Penghasilan sehubungan Pekerjaan",
    authority: "Kementerian Keuangan",
    jurisdiction: "ID",
    sourceType: "ministerial_regulation",
    canonicalUrl: "https://jdih.kemenkeu.go.id/dok/pmk-168-tahun-2023",
    versionLabel: "2024-01-01",
    publicationDate: "2023-12-29",
    effectiveFrom: "2024-01-01",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    contentSha256: "1681681681681681681681681681681681681681681681681681681681681681",
    sections: [
      {
        heading: "Pasal 5 - Tarif Pemotongan PPh Pasal 21",
        locator: "Pasal 5",
        ordinal: 5,
        bodyText: "Tarif pemotongan Pajak Penghasilan Pasal 21 terdiri atas tarif berdasarkan Pasal 17 ayat (1) huruf a UU PPh dan tarif efektif bulanan atau harian.",
        taxTopics: ["tax.withholding", "tax.income"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, pmk168.version.id);

  // Ingest pending source (NEEDS_REVIEW): UU 7/2021 (HPP) - NOT approved
  const uu7 = await ingestion.ingestSource(actor, {
    officialIdentifier: "UU 7 TAHUN 2021",
    title: "Harmonisasi Peraturan Perpajakan",
    authority: "Pemerintah Pusat",
    jurisdiction: "ID",
    sourceType: "statute",
    canonicalUrl: "https://peraturan.bpk.go.id/Details/185162",
    versionLabel: "2021-10-29",
    publicationDate: "2021-10-29",
    effectiveFrom: "2021-10-29",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    contentSha256: "7777777777777777777777777777777777777777777777777777777777777777",
    sections: [
      {
        heading: "Pasal 31A - Ketentuan Pajak Penghasilan Badan",
        locator: "Pasal 31A",
        ordinal: 1,
        bodyText: "Ketentuan fasilitas perpajakan penanaman modal dan dividen perseroan.",
        taxTopics: ["tax.corporate_income", "tax.general"],
      },
    ],
  });
  // Notice: uu7 is deliberately NOT approved (reviewStatus remains 'pending')

  // Test retrieval for VAT / PPN: returns PP 44/2022
  const vatResults = await retrieveApprovedSources(database, {
    query: "penyerahan barang kena pajak di dalam daerah pabean",
    jurisdiction: "ID",
    taxTopics: ["tax.vat"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.equal(vatResults.length, 1);
  assert.equal(vatResults[0]?.source.officialIdentifier, "PP 44 TAHUN 2022");
  assert.equal(vatResults[0]?.locator, "Pasal 4");

  // Test retrieval for PPh 21 withholding: returns PMK 168/2023
  const pphResults = await retrieveApprovedSources(database, {
    query: "tarif efektif bulanan pemotongan pph pasal 21",
    jurisdiction: "ID",
    taxTopics: ["tax.withholding"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.equal(pphResults.length, 1);
  assert.equal(pphResults[0]?.source.officialIdentifier, "PMK 168 TAHUN 2023");
  assert.equal(pphResults[0]?.locator, "Pasal 5");

  // Test retrieval for pending source: UU 7/2021 must NOT be returned
  const pendingResults = await retrieveApprovedSources(database, {
    query: "fasilitas penanaman modal dividen",
    jurisdiction: "ID",
    taxTopics: ["tax.corporate_income"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.equal(pendingResults.length, 0);

  // Verify direct repository query returns null for unapproved section retrieval
  const repo = new RegulationsRepository(database);
  const directRetrieved = await repo.findRetrievedSectionById(uu7.sections[0]!.id);
  assert.equal(directRetrieved?.version.reviewStatus, "pending");
});

test("regulatory risk classification: hard-risk statutory topics force expert escalation", () => {
  // Transfer pricing -> PMK 172/2023 / high risk
  const tpRisk = classifyRisk({
    question: "How do we prepare our Local File and Master File for cross-border management fee royalties?",
    jurisdiction: "ID",
    taxTopics: ["tax.transfer_pricing"],
    safeTopicAllowlist: ["synthetic_safe_general"],
  });
  assert.equal(tpRisk.classification, "high_risk");
  assert.equal(tpRisk.needsHuman, true);
  assert.ok(tpRisk.reasonCodes.includes("transfer_pricing"));

  // Permanent establishment -> 35/PMK.03/2019 / complex risk
  const peRisk = classifyRisk({
    question: "Does our foreign company presence trigger a permanent establishment / bentuk usaha tetap in Jakarta?",
    jurisdiction: "ID",
    taxTopics: ["tax.permanent_establishment"],
    safeTopicAllowlist: ["synthetic_safe_general"],
  });
  assert.equal(peRisk.classification, "complex");
  assert.equal(peRisk.needsHuman, true);
  assert.ok(peRisk.reasonCodes.includes("permanent_establishment"));

  // Tax dispute / SP2DK -> high risk
  const disputeRisk = classifyRisk({
    question: "We received an SP2DK tax audit examination notice with potential dispute.",
    jurisdiction: "ID",
    taxTopics: ["tax.general"],
    safeTopicAllowlist: ["synthetic_safe_general"],
  });
  assert.equal(disputeRisk.classification, "high_risk");
  assert.equal(disputeRisk.needsHuman, true);
  assert.ok(disputeRisk.reasonCodes.includes("audit_or_dispute"));
});

test("regulatory corpus: consolidated instruments are retrievable across key corporate tax, SP2DK, Coretax, company law, and foreign investment topics", async (context) => {
  const database = await createTestDatabase(context);
  const guestTokens = new GuestTokenService(tokenSecret);
  const admin = await createUser(database, "admin", "consolidated-admin");
  const actor = createSyntheticUserActor(admin.id);
  const ingestion = new RegulatoryIngestionService(database, guestTokens);

  // Ingest consolidated PP 55/2022 jo. PP 20/2026
  const pp55 = await ingestion.ingestSource(actor, {
    officialIdentifier: "PP 55 TAHUN 2022 jo. PP 20 TAHUN 2026",
    title: "Penyesuaian Pengaturan di Bidang Pajak Penghasilan (Konsolidasi)",
    authority: "Indonesia, Pemerintah Pusat",
    jurisdiction: "ID",
    sourceType: "peraturan_pemerintah_konsolidasi",
    canonicalUrl: "https://jdih.kemenkeu.go.id/dok/pp-55-tahun-2022-konsolidasi",
    versionLabel: "consolidated-pp55-2022-pp20-2026",
    publicationDate: "2026-04-22",
    effectiveFrom: "2026-04-22",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    sections: [
      {
        heading: "Bagian Keempat / Pasal 20A [Disisipkan oleh PP 20/2026]",
        locator: "pp-20-2026.pdf; Pasal 20A; PDF page 3",
        bodyText: "Pengeluaran berupa pemberian suap, gratifikasi, dan/atau pemberian lain... bukan merupakan biaya untuk mendapatkan, menagih, dan memelihara penghasilan.",
        taxTopics: ["tax.income", "tax.corporate_income"],
      },
      {
        heading: "Bagian Ketiga / Pasal 56 [Diubah oleh PP 20/2026]",
        locator: "pp-20-2026.pdf; Pasal 56; PDF pages 3-5",
        bodyText: "Atas penghasilan dari usaha yang diterima atau diperoleh Wajib Pajak dalam negeri yang memiliki peredaran bruto tertentu dikenai Pajak Penghasilan yang bersifat final 0,5%.",
        taxTopics: ["tax.income", "tax.corporate_income"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, pp55.version.id);

  // Ingest SE-05/PJ/2022
  const se05 = await ingestion.ingestSource(actor, {
    officialIdentifier: "SE-05/PJ/2022",
    title: "Pengawasan Kepatuhan Wajib Pajak",
    authority: "Direktorat Jenderal Pajak",
    jurisdiction: "ID",
    sourceType: "surat_edaran_direktur_jenderal_pajak",
    canonicalUrl: "https://jdih.kemenkeu.go.id/dok/se-05-pj-2022",
    versionLabel: "official-2022-02-10",
    publicationDate: "2022-02-10",
    effectiveFrom: "2022-02-10",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    sections: [
      {
        heading: "Bagian III - Jangka Waktu Tanggapan Wajib Pajak (14 Hari Kalender)",
        locator: "SE-05/PJ/2022; Bagian III; Halaman 7-8",
        bodyText: "Wajib Pajak menyampaikan tanggapan atau penjelasan tertulis atas SP2DK paling lama 14 (empat belas) hari kalender sejak tanggal penerbitan atau pengiriman SP2DK.",
        taxTopics: ["tax.audit", "tax.general"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, se05.version.id);

  // Ingest consolidated UU 40/2007 jo. UU 6/2023 (PT Perorangan)
  const uu40 = await ingestion.ingestSource(actor, {
    officialIdentifier: "UU 40 TAHUN 2007 jo. UU 6 TAHUN 2023",
    title: "Perseroan Terbatas (Konsolidasi Undang-Undang Cipta Kerja)",
    authority: "Indonesia, Pemerintah Pusat",
    jurisdiction: "ID",
    sourceType: "undang_undang_konsolidasi",
    canonicalUrl: "https://www.peraturan.go.id/id/uu-no-40-tahun-2007-konsolidasi",
    versionLabel: "consolidated-uu40-2007-uu6-2023",
    publicationDate: "2023-03-31",
    effectiveFrom: "2023-03-31",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    sections: [
      {
        heading: "BAB VI A / Pasal 153A [Disisipkan oleh UU 6/2023]",
        locator: "Pasal 153A",
        bodyText: "Perseroan yang memenuhi kriteria Usaha Mikro dan Kecil dapat didirikan oleh 1 (satu) orang berdasarkan surat pernyataan pendirian dalam bahasa Indonesia.",
        taxTopics: ["business.company_setup", "business.foreign_investment"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, uu40.version.id);

  // Ingest consolidated PERPRES 10/2021 jo. PERPRES 49/2021
  const perpres10 = await ingestion.ingestSource(actor, {
    officialIdentifier: "PERPRES 10 TAHUN 2021 jo. PERPRES 49 TAHUN 2021",
    title: "Bidang Usaha Penanaman Modal (Daftar Positif Investasi Konsolidasi)",
    authority: "Indonesia, Pemerintah Pusat",
    jurisdiction: "ID",
    sourceType: "peraturan_presiden_konsolidasi",
    canonicalUrl: "https://peraturan.bpk.go.id/Details/161806-konsolidasi",
    versionLabel: "consolidated-perpres10-2021-perpres49-2021",
    publicationDate: "2021-05-25",
    effectiveFrom: "2021-05-25",
    effectiveTo: null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    sections: [
      {
        heading: "Pasal 7 - Ketentuan Penanaman Modal Asing PT PMA",
        locator: "Pasal 7",
        bodyText: "Penanaman modal asing hanya dapat melakukan kegiatan usaha pada Usaha Besar dengan nilai investasi lebih besar dari Rp10.000.000.000,00 di luar tanah dan bangunan.",
        taxTopics: ["business.foreign_investment", "business.company_setup"],
      },
    ],
  });
  await ingestion.approveSourceVersion(actor, perpres10.version.id);

  // Verify retrieval of consolidated PPh (PP 55/2022 jo. PP 20/2026)
  const pp55Results = await retrieveApprovedSources(database, {
    query: "suap gratifikasi bukan merupakan biaya pengurang penghasilan bruto",
    jurisdiction: "ID",
    taxTopics: ["tax.corporate_income"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.ok(pp55Results.length > 0);
  assert.equal(pp55Results[0]?.source.officialIdentifier, "PP 55 TAHUN 2022 jo. PP 20 TAHUN 2026");

  // Verify retrieval of SE-05/PJ/2022 for SP2DK 14 days deadline
  const sp2dkResults = await retrieveApprovedSources(database, {
    query: "tanggapan tertulis sp2dk empat belas hari kalender",
    jurisdiction: "ID",
    taxTopics: ["tax.audit"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.ok(sp2dkResults.length > 0);
  assert.equal(sp2dkResults[0]?.source.officialIdentifier, "SE-05/PJ/2022");

  // Verify retrieval of consolidated company law (UU 40/2007 jo. UU 6/2023)
  const ptResults = await retrieveApprovedSources(database, {
    query: "perseroan perorangan usaha mikro kecil satu orang surat pernyataan pendirian",
    jurisdiction: "ID",
    taxTopics: ["business.company_setup"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.ok(ptResults.length > 0);
  assert.equal(ptResults[0]?.source.officialIdentifier, "UU 40 TAHUN 2007 jo. UU 6 TAHUN 2023");

  // Verify retrieval of consolidated PT PMA investment threshold (Perpres 10/2021 jo. Perpres 49/2021)
  const pmaResults = await retrieveApprovedSources(database, {
    query: "penanaman modal asing pt pma sepuluh miliar rupiah tanah bangunan",
    jurisdiction: "ID",
    taxTopics: ["business.foreign_investment"],
    effectiveAt: "2026-08-30",
    limit: 5,
  });
  assert.ok(pmaResults.length > 0);
  assert.equal(pmaResults[0]?.source.officialIdentifier, "PERPRES 10 TAHUN 2021 jo. PERPRES 49 TAHUN 2021");
});
