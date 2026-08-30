import "server-only";

export interface AiProviderRequest {
  systemPrompt: string;
  userPrompt: string;
  jsonSchema: Record<string, unknown>;
  idempotencyKey: string;
}

export interface AiProviderResult {
  output: unknown;
  providerRequestId: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
}

export interface AiProvider {
  readonly providerName: string;
  readonly model: string;
  generateStructuredAnswer(request: AiProviderRequest): Promise<AiProviderResult>;
}

export class AiProviderError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
    public readonly providerRequestId: string | null = null,
  ) {
    super(message);
    this.name = "AiProviderError";
  }
}
