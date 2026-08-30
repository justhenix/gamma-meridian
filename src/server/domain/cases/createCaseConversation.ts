import "server-only";

import type { Client } from "@libsql/client";
import { z } from "zod";
import type { Actor } from "../../auth/actor";
import type { GuestTokenService } from "../../auth/guest-token";
import { IntakeService, type SubmittedCaseDto } from "../intake/service";

const createCaseConversationSchema = z.object({
  clientAccountId: z.uuid(),
  title: z.string().trim().min(3).max(240),
  summary: z.string().trim().min(12).max(20000),
  primaryJurisdiction: z.string().trim().min(2).max(80),
  taxTopics: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
  locale: z.enum(["id", "en"]).default("id"),
  idempotencyKey: z.string().trim().min(8).max(160),
});

export async function createCaseConversation(
  database: Client,
  guestTokens: GuestTokenService,
  actor: Actor,
  input: unknown,
): Promise<SubmittedCaseDto> {
  const data = createCaseConversationSchema.parse(input);
  const service = new IntakeService(database, guestTokens);
  const intake = await service.createIntake(actor, {
    intakeSchemaVersion: "v1",
    locale: data.locale,
  });
  const draft = await service.saveDraftAnswer(actor, {
    intakeSessionId: intake.intake.id,
    expectedVersion: intake.intake.rowVersion,
    questionKey: "summary",
    questionVersion: "1",
    answer: data.summary,
    dataClassification: "confidential",
  });
  return service.submitIntake(actor, {
    intakeSessionId: intake.intake.id,
    expectedVersion: draft.rowVersion,
    idempotencyKey: data.idempotencyKey,
    clientAccountId: data.clientAccountId,
    title: data.title,
    primaryJurisdiction: data.primaryJurisdiction,
    taxTopics: [...new Set(data.taxTopics.map((topic) => topic.toLowerCase()))],
  });
}
