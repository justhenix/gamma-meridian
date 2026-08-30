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
