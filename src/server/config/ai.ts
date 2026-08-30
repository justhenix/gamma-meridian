import "server-only";

import { z } from "zod";

export const GENERAL_ASSISTANT_TOPIC = "general_tax_business";

const booleanString = z
  .enum(["true", "false"])
  .default("false")
  .transform((value) => value === "true");

const runtimeConfigSchema = z.object({
  safeTopics: z.string().default("").transform((value) =>
    [
      ...new Set([
        GENERAL_ASSISTANT_TOPIC,
        ...value.split(",").map((topic) => topic.trim().toLowerCase()).filter(Boolean),
      ]),
    ],
  ),
  expertEscalationFree: booleanString,
});

export interface AiRuntimeConfig {
  safeTopics: string[];
  expertEscalationFree: boolean;
}

export function getAiRuntimeConfig(): AiRuntimeConfig {
  return runtimeConfigSchema.parse({
    safeTopics: process.env.MERIDIAN_AI_SAFE_TOPICS,
    expertEscalationFree: process.env.MERIDIAN_EXPERT_ESCALATION_FREE,
  });
}
