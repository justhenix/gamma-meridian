import "server-only";

import nodemailer from "nodemailer";

export type VerificationPurpose = "claim" | "consultations";

export interface VerificationDeliveryInput {
  email: string;
  code: string;
  purpose: VerificationPurpose | "staff_login";
}

export interface VerificationDeliveryResult {
  developmentCode?: string;
}

export interface EmailVerificationProvider {
  deliverCode(input: VerificationDeliveryInput): Promise<VerificationDeliveryResult>;
}

interface MailTransport {
  sendMail(message: {
    from: string;
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<unknown>;
}

export class SumoPodEmailVerificationProvider implements EmailVerificationProvider {
  constructor(
    private readonly transport: MailTransport,
    private readonly sender: { fromName: string; fromEmail: string },
  ) {}

  async deliverCode(input: VerificationDeliveryInput): Promise<VerificationDeliveryResult> {
    const isStaff = input.purpose === "staff_login";
    const subject = isStaff
      ? "Your Meridian staff sign-in code"
      : "Your Meridian verification code";
    const context = isStaff ? "sign in to the Meridian staff workspace" : "verify your Meridian email";
    const fromName = this.sender.fromName.replace(/["\r\n]/g, "").trim() || "Meridian Tax";
    const fromEmail = this.sender.fromEmail.replace(/[\r\n]/g, "").trim();

    await this.transport.sendMail({
      from: `"${fromName}" <${fromEmail}>`,
      to: input.email,
      subject,
      text: `Your Meridian verification code is ${input.code}. Use it within 10 minutes to ${context}. If you did not request this code, you can ignore this email.`,
      html: `<p>Your Meridian verification code is <strong style="font-size:20px;letter-spacing:0.12em">${input.code}</strong>.</p><p>Use it within 10 minutes to ${context}.</p><p>If you did not request this code, you can ignore this email.</p>`,
    });

    return {};
  }
}

export class DevelopmentEmailVerificationProvider implements EmailVerificationProvider {
  async deliverCode(input: VerificationDeliveryInput): Promise<VerificationDeliveryResult> {
    return { developmentCode: input.code };
  }
}

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for production email verification`);
  return value;
}

export function getEmailVerificationProvider(): EmailVerificationProvider {
  if (process.env.NODE_ENV === "production") {
    const portValue = process.env.SUMOPOD_SMTP_PORT?.trim() || "465";
    const port = Number.parseInt(portValue, 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error("SUMOPOD_SMTP_PORT must be a valid TCP port");
    }
    const secure = (process.env.SUMOPOD_SMTP_SECURE?.trim().toLowerCase() || "true") !== "false";
    const transport = nodemailer.createTransport({
      host: process.env.SUMOPOD_SMTP_HOST?.trim() || "smtp.sumopod.com",
      port,
      secure,
      auth: {
        user: requiredEnv("SUMOPOD_SMTP_USER"),
        pass: requiredEnv("SUMOPOD_SMTP_PASSWORD"),
      },
    });
    return new SumoPodEmailVerificationProvider(transport, {
      fromName: process.env.SUMOPOD_FROM_NAME?.trim() || "Meridian Tax",
      fromEmail: requiredEnv("SUMOPOD_FROM_EMAIL"),
    });
  }
  return new DevelopmentEmailVerificationProvider();
}
