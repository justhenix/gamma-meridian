import type { Client } from "@libsql/client";
import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { RegulatoryIngestionService } from "../../src/server/domain/regulations/ingestSource";
import type { UserRecord } from "../../src/server/domain/shared/types";
import type {
  AiProvider,
  AiProviderRequest,
  AiProviderResult,
} from "../../src/server/integrations/ai/provider";

export class FakeAiProvider implements AiProvider {
  readonly providerName = "fake";
  readonly model = "fake-grounded-model";
  calls = 0;

  constructor(
    private readonly respond: (
      request: AiProviderRequest,
    ) => Promise<unknown> | unknown,
  ) {}

  async generateStructuredAnswer(
    request: AiProviderRequest,
  ): Promise<AiProviderResult> {
    this.calls += 1;
    const output = await this.respond(request);
    return {
      output,
      providerRequestId: `fake-request-${this.calls}`,
      inputTokens: 100,
      outputTokens: 50,
      latencyMs: 5,
    };
  }
}

export async function ingestSyntheticSource(
  database: Client,
  guestTokens: GuestTokenService,
  admin: UserRecord,
  input: {
    versionLabel?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    approve?: boolean;
  } = {},
) {
  const service = new RegulatoryIngestionService(database, guestTokens);
  const actor = createSyntheticUserActor(admin.id);
  const suffix = input.versionLabel ?? "ai-001";
  const ingested = await service.ingestSource(actor, {
    officialIdentifier: `SYNTHETIC-DEV-${suffix.toUpperCase()}`,
    title: "Synthetic Development Tax Guidance — Not Law",
    authority: "Meridian Synthetic Test Authority",
    jurisdiction: "ID",
    sourceType: "synthetic_development",
    canonicalUrl: `https://example.invalid/meridian/${suffix}`,
    versionLabel: input.versionLabel ?? "dev-v1",
    publicationDate: "2026-01-01",
    effectiveFrom: input.effectiveFrom ?? "2026-01-01",
    effectiveTo: input.effectiveTo ?? null,
    retrievedAt: "2026-08-30T00:00:00.000Z",
    synthetic: true,
    sections: [
      {
        heading: "Synthetic filing acknowledgement",
        locator: "Synthetic Section A",
        bodyText:
          "SYNTHETIC TEST CONTENT. This is not Indonesian law. The synthetic filing acknowledgement is issued within 3 synthetic business days.",
        taxTopics: ["synthetic_safe_general"],
      },
    ],
  });
  return input.approve === false
    ? ingested
    : service.approveSourceVersion(actor, ingested.version.id);
}
