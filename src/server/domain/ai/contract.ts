import "server-only";

import { z } from "zod";

export const aiAnswerContractSchema = z.object({
  classification: z.enum(["simple", "needs_information", "complex", "high_risk"]),
  canAnswerWithAI: z.boolean(),
  needsHuman: z.boolean(),
  reasonCodes: z.array(z.string().trim().min(1).max(120)).max(24),
  missingFacts: z.array(z.string().trim().min(1).max(500)).max(24),
  answer: z.string().trim().max(12000),
  citations: z
    .array(
      z.object({
        sourceSectionId: z.uuid(),
        claim: z.string().trim().min(1).max(2000),
      }),
    )
    .max(24),
  assumptions: z.array(z.string().trim().min(1).max(1000)).max(24),
  humanHandoffSummary: z.string().trim().min(1).max(6000).nullable(),
});

export type AiAnswerContract = z.infer<typeof aiAnswerContractSchema>;

export const aiAnswerJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "classification",
    "canAnswerWithAI",
    "needsHuman",
    "reasonCodes",
    "missingFacts",
    "answer",
    "citations",
    "assumptions",
    "humanHandoffSummary",
  ],
  properties: {
    classification: {
      type: "string",
      enum: ["simple", "needs_information", "complex", "high_risk"],
    },
    canAnswerWithAI: { type: "boolean" },
    needsHuman: { type: "boolean" },
    reasonCodes: { type: "array", maxItems: 24, items: { type: "string" } },
    missingFacts: { type: "array", maxItems: 24, items: { type: "string" } },
    answer: { type: "string" },
    citations: {
      type: "array",
      maxItems: 24,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["sourceSectionId", "claim"],
        properties: {
          sourceSectionId: { type: "string", format: "uuid" },
          claim: { type: "string" },
        },
      },
    },
    assumptions: { type: "array", maxItems: 24, items: { type: "string" } },
    humanHandoffSummary: { type: ["string", "null"] },
  },
} as const;
