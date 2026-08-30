import assert from "node:assert/strict";
import test from "node:test";

import { inferRetrievalTopics } from "../../src/server/domain/ai/retrievalTopics";

test("assistant retrieval infers corpus topics from the built-in starter questions", () => {
  assert.deepEqual(
    inferRetrievalTopics(
      "What should I prepare first for Indonesian transfer pricing documentation?",
      ["general_tax_business"],
    ),
    ["tax.transfer_pricing", "tax.cross_border", "tax.corporate_income"],
  );

  const businessSetup = inferRetrievalTopics(
    "I am a foreign founder planning to open a business in Indonesia. Where should I start?",
    ["general_tax_business"],
  );
  assert.ok(businessSetup.includes("business.company_setup"));
  assert.ok(businessSetup.includes("business.foreign_investment"));

  const corporateTax = inferRetrievalTopics(
    "What are the first tax obligations for a newly established Indonesian company?",
    ["general_tax_business"],
  );
  assert.ok(corporateTax.includes("tax.corporate_income"));
  assert.ok(corporateTax.includes("tax.registration"));
});
