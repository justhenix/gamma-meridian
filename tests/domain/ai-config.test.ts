import assert from "node:assert/strict";
import test from "node:test";

import { getAiRuntimeConfig } from "../../src/server/config/ai";

test("AI runtime keeps the general assistant topic safe when the env allowlist is empty", () => {
  const previous = process.env.MERIDIAN_AI_SAFE_TOPICS;
  process.env.MERIDIAN_AI_SAFE_TOPICS = "";
  try {
    const config = getAiRuntimeConfig();
    assert.ok(config.safeTopics.includes("general_tax_business"));
  } finally {
    if (previous === undefined) {
      delete process.env.MERIDIAN_AI_SAFE_TOPICS;
    } else {
      process.env.MERIDIAN_AI_SAFE_TOPICS = previous;
    }
  }
});
