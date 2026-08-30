import "server-only";

export type VerificationPurpose = "claim" | "consultations";

export interface VerificationDeliveryInput {
  email: string;
  code: string;
  purpose: VerificationPurpose;
}

export interface VerificationDeliveryResult {
  developmentCode?: string;
}

export interface EmailVerificationProvider {
  deliverCode(input: VerificationDeliveryInput): Promise<VerificationDeliveryResult>;
}

export class DevelopmentEmailVerificationProvider implements EmailVerificationProvider {
  async deliverCode(input: VerificationDeliveryInput): Promise<VerificationDeliveryResult> {
    return { developmentCode: input.code };
  }
}

export function getEmailVerificationProvider(): EmailVerificationProvider {
  if (process.env.NODE_ENV === "production") {
    throw new Error("A production email verification provider is not configured");
  }
  return new DevelopmentEmailVerificationProvider();
}
