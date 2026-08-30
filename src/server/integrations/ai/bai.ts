import "server-only";

import { z } from "zod";
import {
  AiProviderError,
  type AiProvider,
  type AiProviderRequest,
  type AiProviderResult,
} from "./provider";

const baiConfigSchema = z.object({
  apiKey: z.string().min(1),
  baseUrl: z.url().default("https://api.b.ai/v1").transform((value) => value.replace(/\/$/, "")),
  model: z.string().min(1).default("qwen3.8-flash"),
  timeoutMs: z.coerce.number().int().min(1000).max(120000).default(15000),
  maxOutputTokens: z.coerce.number().int().min(256).max(12000).default(1200),
});

type BaiConfig = z.infer<typeof baiConfigSchema>;

const baiResponseSchema = z.object({
  id: z.string().optional(),
  choices: z.array(
    z.object({
      message: z.object({ content: z.string() }),
    }),
  ).min(1),
  usage: z.object({
    prompt_tokens: z.number().int().nonnegative().optional(),
    completion_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
});

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export class BaiAiProvider implements AiProvider {
  readonly providerName = "bai";
  readonly model: string;

  constructor(private readonly config: BaiConfig) {
    this.model = config.model;
  }

  async generateStructuredAnswer(request: AiProviderRequest): Promise<AiProviderResult> {
    const startedAt = Date.now();
    let lastError: AiProviderError | null = null;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);
      try {
        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": request.idempotencyKey,
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: [
              { role: "system", content: request.systemPrompt },
              { role: "user", content: request.userPrompt },
            ],
            stream: false,
            temperature: 0,
            // Meridian uses this model for fast, grounded first-line retrieval.
            // Qwen's reasoning mode adds substantial latency for long legal context
            // and is unnecessary because risk routing and citation validation happen
            // deterministically outside the provider.
            enable_thinking: false,
            max_tokens: this.config.maxOutputTokens,
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "meridian_grounded_answer",
                strict: true,
                schema: request.jsonSchema,
              },
            },
          }),
          signal: controller.signal,
        });
        const providerRequestId = response.headers.get("x-request-id");
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
          const retryable = [429, 500, 502, 503].includes(response.status);
          const code =
            payload && typeof payload === "object" && "error" in payload
              ? String((payload as { error?: { code?: unknown } }).error?.code ?? `http_${response.status}`)
              : `http_${response.status}`;
          lastError = new AiProviderError(
            code,
            `B.AI request failed with status ${response.status}`,
            retryable,
            providerRequestId,
          );
          if (!retryable || attempt === 1) throw lastError;
          await sleep(150 * 2 ** attempt + Math.floor(Math.random() * 100));
          continue;
        }

        const parsed = baiResponseSchema.safeParse(payload);
        if (!parsed.success) {
          throw new AiProviderError(
            "invalid_provider_response",
            "B.AI returned an invalid response envelope",
            false,
            providerRequestId,
          );
        }
        let output: unknown;
        try {
          output = JSON.parse(parsed.data.choices[0]!.message.content);
        } catch {
          throw new AiProviderError(
            "invalid_provider_json",
            "B.AI returned non-JSON structured output",
            false,
            parsed.data.id ?? providerRequestId,
          );
        }
        return {
          output,
          providerRequestId: parsed.data.id ?? providerRequestId,
          inputTokens: parsed.data.usage?.prompt_tokens ?? null,
          outputTokens: parsed.data.usage?.completion_tokens ?? null,
          latencyMs: Date.now() - startedAt,
        };
      } catch (error) {
        if (error instanceof AiProviderError) throw error;
        const timedOut = error instanceof Error && error.name === "AbortError";
        lastError = new AiProviderError(
          timedOut ? "timeout" : "network_error",
          timedOut ? "B.AI request timed out" : "B.AI network request failed",
          !timedOut,
        );
        if (timedOut || attempt === 1) throw lastError;
        await sleep(150 * 2 ** attempt + Math.floor(Math.random() * 100));
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError ?? new AiProviderError("unknown", "B.AI request failed", false);
  }
}

let configuredProvider: BaiAiProvider | undefined;

function getConfiguredBaiProvider(): BaiAiProvider {
  if (configuredProvider) return configuredProvider;
  const parsed = baiConfigSchema.safeParse({
    apiKey: process.env.BAI_API_KEY,
    baseUrl: process.env.BAI_BASE_URL,
    model: process.env.BAI_MODEL,
    timeoutMs: process.env.BAI_TIMEOUT_MS,
    maxOutputTokens: process.env.BAI_MAX_OUTPUT_TOKENS,
  });
  if (!parsed.success) {
    throw new AiProviderError(
      "missing_configuration",
      "B.AI provider configuration is missing or invalid",
      false,
    );
  }
  configuredProvider = new BaiAiProvider(parsed.data);
  return configuredProvider;
}

class EnvironmentBaiProvider implements AiProvider {
  readonly providerName = "bai";

  get model(): string {
    return process.env.BAI_MODEL?.trim() || "qwen3.8-flash";
  }

  generateStructuredAnswer(request: AiProviderRequest): Promise<AiProviderResult> {
    return getConfiguredBaiProvider().generateStructuredAnswer(request);
  }
}

let environmentProvider: EnvironmentBaiProvider | undefined;

export function getBaiAiProvider(): AiProvider {
  environmentProvider ??= new EnvironmentBaiProvider();
  return environmentProvider;
}
