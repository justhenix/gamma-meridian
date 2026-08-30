import "server-only";

import { z } from "zod";

export const idSchema = z.uuid();
export const localeSchema = z.enum(["id", "en"]);
export const idempotencyKeySchema = z.string().trim().min(8).max(160);
export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const createIntakeSchema = z.object({
  intakeSchemaVersion: z.string().trim().min(1).max(80),
  locale: localeSchema.default("id"),
});

export const saveDraftAnswerSchema = z.object({
  intakeSessionId: idSchema,
  expectedVersion: z.number().int().positive(),
  questionKey: z.string().trim().min(1).max(120),
  questionVersion: z.string().trim().min(1).max(80),
  answer: z.json().refine((value) => JSON.stringify(value).length <= 65536, {
    message: "Answer is too large",
  }),
  dataClassification: z
    .enum(["internal", "confidential", "restricted"])
    .default("confidential"),
});

export const submitIntakeSchema = z
  .object({
    intakeSessionId: idSchema,
    expectedVersion: z.number().int().positive(),
    idempotencyKey: idempotencyKeySchema,
    clientAccountId: idSchema.optional(),
    title: z.string().trim().min(1).max(240),
    primaryJurisdiction: z.string().trim().min(2).max(80),
    taxTopics: z.array(z.string().trim().min(1).max(80)).min(1).max(12),
    taxPeriodStart: dateOnlySchema.optional(),
    taxPeriodEnd: dateOnlySchema.optional(),
  })
  .refine(
    (value) =>
      !value.taxPeriodStart ||
      !value.taxPeriodEnd ||
      value.taxPeriodStart <= value.taxPeriodEnd,
    { message: "Tax period start must not be after its end" },
  );

export const assignCaseMemberSchema = z.object({
  caseId: idSchema,
  userId: idSchema,
  caseRole: z.enum([
    "client_owner",
    "client_collaborator",
    "lead_consultant",
    "consultant",
    "reviewer",
  ]),
  reason: z.string().trim().min(1).max(500),
});

export const sendMessageSchema = z.object({
  conversationId: idSchema,
  bodyMarkdown: z.string().trim().min(1).max(20000),
  language: localeSchema,
  clientRequestId: idempotencyKeySchema,
});

export const transitionCaseSchema = z.object({
  caseId: idSchema,
  expectedVersion: z.number().int().positive(),
  toStatus: z.enum([
    "received",
    "human_review_required",
    "consultant_working",
    "waiting_for_client",
    "resolved",
    "closed",
  ]),
  reason: z
    .string()
    .trim()
    .regex(/^[a-z][a-z0-9_.:-]{2,79}$/, "Reason must be a stable reason code"),
  resolutionCode: z.string().trim().min(1).max(80).optional(),
  resolutionNote: z.string().trim().max(2000).optional(),
});
