"use server";

import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { z } from "zod";

import type { Actor } from "@/server/auth/actor";
import { getGuestTokenService } from "@/server/auth/guest-token";
import { getDatabaseClient } from "@/server/db/client";
import { IntakeService } from "@/server/domain/intake/service";

const consultationFormSchema = z.object({
  fullName: z.string().trim().min(2, "Full name must be at least 2 characters").max(160),
  workEmail: z.string().trim().email("Please provide a valid corporate email").max(160),
  companyName: z.string().trim().min(2, "Company name must be at least 2 characters").max(240),
  primaryJurisdiction: z.string().trim().min(2).max(80).default("Indonesia"),
  practiceArea: z.string().trim().min(2).max(80),
  inquirySummary: z.string().trim().min(5, "Please provide brief details of your inquiry").max(5000),
  locale: z.enum(["id", "en"]).default("id"),
});

export type ConsultationFormInput = z.infer<typeof consultationFormSchema>;

export interface ConsultationActionResult {
  success: boolean;
  caseReference?: string;
  caseId?: string;
  guestToken?: string;
  error?: string;
}

let isDbInitialized = false;

async function ensureDatabaseReady() {
  if (isDbInitialized) return;
  const db = getDatabaseClient();

  // If running with local file SQLite in dev mode, run initial migration if users table does not exist
  try {
    const check = await db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'");
    if (check.rows.length === 0) {
      const migrationSql = await readFile(
        resolve(process.cwd(), "db/migrations/0001_human_case_workflow.sql"),
        "utf8",
      );
      await db.executeMultiple(migrationSql);
    }
    isDbInitialized = true;
  } catch {
    // If not SQLite / remote Turso already migrated, continue
    isDbInitialized = true;
  }
}

export async function submitConsultationAction(
  input: ConsultationFormInput,
): Promise<ConsultationActionResult> {
  try {
    const validated = consultationFormSchema.parse(input);

    await ensureDatabaseReady();

    const database = getDatabaseClient();
    const guestTokens = getGuestTokenService();
    const intakeService = new IntakeService(database, guestTokens);

    const requestId = crypto.randomUUID();

    // 1. Create anonymous intake session
    const anonymousActor: Actor = {
      kind: "anonymous",
      requestId,
    };
    const created = await intakeService.createIntake(anonymousActor, {
      intakeSchemaVersion: "v1",
      locale: validated.locale,
    });

    if (!created.guestToken) {
      return {
        success: false,
        error: "Failed to issue secure intake access token.",
      };
    }

    const guestActor: Actor = {
      kind: "guest",
      intakeSessionId: created.intake.id,
      token: created.guestToken,
      requestId: crypto.randomUUID(),
    };

    // 2. Save draft answers
    const payload = {
      fullName: validated.fullName,
      workEmail: validated.workEmail,
      companyName: validated.companyName,
      practiceArea: validated.practiceArea,
      inquirySummary: validated.inquirySummary,
    };

    await intakeService.saveDraftAnswer(guestActor, {
      intakeSessionId: created.intake.id,
      expectedVersion: created.intake.rowVersion,
      questionKey: "summary",
      questionVersion: "1",
      answer: payload,
      dataClassification: "confidential",
    });

    // 3. Submit intake and create case
    const submittedCase = await intakeService.submitIntake(guestActor, {
      intakeSessionId: created.intake.id,
      expectedVersion: created.intake.rowVersion + 1,
      idempotencyKey: crypto.randomUUID(),
      title: `Advisory Brief: ${validated.companyName} (${validated.practiceArea})`,
      primaryJurisdiction: validated.primaryJurisdiction,
      taxTopics: [validated.practiceArea],
    });

    return {
      success: true,
      caseReference: submittedCase.caseReference,
      caseId: submittedCase.id,
      guestToken: created.guestToken,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Submission failed";
    return {
      success: false,
      error: message,
    };
  }
}
