import assert from "node:assert/strict";
import test from "node:test";

import { BaiAiProvider } from "../../src/server/integrations/ai/bai";

test("B.AI first-line answers disable model thinking", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody: Record<string, unknown> | null = null;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      id: "test-request",
      choices: [{ message: { content: JSON.stringify({ ok: true }) } }],
      usage: { prompt_tokens: 1, completion_tokens: 1 },
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  try {
    const provider = new BaiAiProvider({
      apiKey: "test-key",
      baseUrl: "https://example.invalid/v1",
      model: "qwen3.8-flash",
      timeoutMs: 1000,
      maxOutputTokens: 256,
    });
    await provider.generateStructuredAnswer({
      systemPrompt: "Return JSON.",
      userPrompt: "Test.",
      jsonSchema: { type: "object" },
      idempotencyKey: "test-idempotency-key",
    });
    assert.equal((requestBody as Record<string, unknown> | null)?.["enable_thinking"], false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
