import type { Client } from "@libsql/client";

import { GuestTokenService } from "../../src/server/auth/guest-token";
import { createSyntheticUserActor } from "../../src/server/auth/synthetic";
import { IntakeService, type SubmittedCaseDto } from "../../src/server/domain/intake/service";
import type { ClientAccountRecord, UserRecord } from "../../src/server/domain/shared/types";

let submissionSequence = 0;

export async function createSubmittedClientCase(
  database: Client,
  guestTokens: GuestTokenService,
  client: UserRecord,
  account: ClientAccountRecord,
  taxTopics: string[] = ["corporate_income_tax"],
): Promise<SubmittedCaseDto> {
  submissionSequence += 1;
  const actor = createSyntheticUserActor(client.id);
  const service = new IntakeService(database, guestTokens);
  const intake = await service.createIntake(actor, {
    intakeSchemaVersion: "v1",
    locale: "id",
  });
  const draft = await service.saveDraftAnswer(actor, {
    intakeSessionId: intake.intake.id,
    expectedVersion: intake.intake.rowVersion,
    questionKey: "summary",
    questionVersion: "1",
    answer: `Synthetic case ${submissionSequence}`,
  });
  return service.submitIntake(actor, {
    intakeSessionId: intake.intake.id,
    expectedVersion: draft.rowVersion,
    idempotencyKey: `workflow-submit-${submissionSequence}`,
    clientAccountId: account.id,
    title: `Synthetic case ${submissionSequence}`,
    primaryJurisdiction: "ID",
    taxTopics,
  });
}
