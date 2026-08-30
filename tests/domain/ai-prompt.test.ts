import assert from "node:assert/strict";
import test from "node:test";

import type { RetrievedRegulatorySection } from "../../src/server/domain/regulations/types";
import { buildGroundedAnswerPrompt } from "../../src/server/domain/ai/prompt";

function sourceWithBody(bodyText: string): RetrievedRegulatorySection {
  return {
    id: "00000000-0000-4000-8000-000000000001",
    sourceVersionId: "00000000-0000-4000-8000-000000000002",
    heading: "Synthetic long section",
    locator: "Synthetic locator",
    ordinal: 1,
    bodyText,
    bodySha256: "hash",
    taxTopics: ["tax.transfer_pricing"],
    createdAt: "2026-08-30T00:00:00.000Z",
    source: {
      id: "00000000-0000-4000-8000-000000000003",
      officialIdentifier: "SYNTHETIC-LONG",
      title: "Synthetic long source",
      authority: "Synthetic Authority",
      jurisdiction: "ID",
      sourceType: "synthetic",
      canonicalUrl: "https://example.invalid/source",
      status: "active",
      createdAt: "2026-08-30T00:00:00.000Z",
      updatedAt: "2026-08-30T00:00:00.000Z",
    },
    version: {
      id: "00000000-0000-4000-8000-000000000002",
      regulatorySourceId: "00000000-0000-4000-8000-000000000003",
      versionLabel: "v1",
      publicationDate: "2026-01-01",
      effectiveFrom: "2026-01-01",
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

test("grounded prompt bounds oversized statutory sections around relevant terms", () => {
  const relevant = "transfer pricing documentation requirements are listed here";
  const body = `${"irrelevant filler ".repeat(4000)}${relevant}${" trailing filler".repeat(4000)}`;
  const prompt = buildGroundedAnswerPrompt({
    locale: "en",
    question: "What transfer pricing documentation should I prepare?",
    jurisdiction: "ID",
    relevantDate: "2026-08-30",
    taxTopics: ["tax.transfer_pricing"],
    conversation: [],
    intakeFacts: [],
    sources: [sourceWithBody(body)],
  });
  const payload = JSON.parse(prompt.userPrompt) as { approvedSources: Array<{ bodyText: string }> };
  assert.ok(payload.approvedSources[0]!.bodyText.includes(relevant));
  assert.ok(payload.approvedSources[0]!.bodyText.length <= 3200);
  assert.ok(prompt.userPrompt.length < 6000);
  assert.ok(prompt.systemPrompt.includes("deterministic risk router"));
});
