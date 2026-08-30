"use client";

import * as React from "react";
import { AlertCircle, Loader2, MailCheck, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface EmailVerificationPanelProps {
  purpose: "claim" | "consultations";
  isEnglish?: boolean;
  onVerified: () => void | Promise<void>;
  onCancel?: () => void;
  surface?: "card" | "plain";
  showIntroduction?: boolean;
  emailLabel?: string;
  submitLabel?: string;
}

interface ApiErrorBody {
  error?: { message?: string };
}

export function EmailVerificationPanel({
  purpose,
  isEnglish = true,
  onVerified,
  onCancel,
  surface = "card",
  showIntroduction = true,
  emailLabel = "Email",
  submitLabel,
}: EmailVerificationPanelProps) {
  const isClaim = purpose === "claim";
  const [fullName, setFullName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [companyName, setCompanyName] = React.useState("");
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [developmentCode, setDevelopmentCode] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function errorMessage(response: Response) {
    const body = await response.json().catch(() => ({})) as ApiErrorBody;
    return body.error?.message ?? (isEnglish ? "The request could not be completed." : "Permintaan tidak dapat diselesaikan.");
  }

  async function startVerification(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verification/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          purpose,
          email,
          ...(isClaim ? { fullName, companyName: companyName || undefined } : {}),
        }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      const result = await response.json() as { challengeId: string; developmentCode?: string };
      setChallengeId(result.challengeId);
      setDevelopmentCode(result.developmentCode ?? null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: React.FormEvent) {
    event.preventDefault();
    if (!challengeId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      if (!response.ok) throw new Error(await errorMessage(response));
      await onVerified();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={surface === "card" ? "rounded-lg border border-border bg-card p-5 shadow-sm" : "w-full"}>
      {showIntroduction && <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
          <ShieldCheck className="size-4" />
        </div>
        <div>
          <h3 className="font-heading text-[14px] font-semibold text-foreground">
            {isClaim
              ? (isEnglish ? "Continue securely with a Meridian expert" : "Lanjutkan dengan aman bersama konsultan Meridian")
              : (isEnglish ? "Access My Consultations" : "Akses Konsultasi Saya")}
          </h3>
          <p className="mt-1 text-[13px] leading-relaxed text-muted-foreground">
            {isClaim
              ? (isEnglish
                  ? "Verify your email so our team can continue from this conversation. You won't need to explain everything again."
                  : "Verifikasi email agar tim kami dapat melanjutkan dari percakapan ini. Anda tidak perlu menjelaskan semuanya dari awal.")
              : (isEnglish
                  ? "Enter your email to continue previous conversations with Meridian."
                  : "Masukkan email Anda untuk melanjutkan percakapan sebelumnya dengan Meridian.")}
          </p>
        </div>
      </div>}

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-[13px] text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!challengeId ? (
        <form onSubmit={startVerification} className={showIntroduction ? "mt-5 space-y-4" : "space-y-4"}>
          {isClaim && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-foreground">{isEnglish ? "Full name" : "Nama lengkap"}</label>
              <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required autoComplete="name" />
            </div>
          )}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-foreground">{emailLabel}</label>
            <Input className="h-11" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />
          </div>
          {isClaim && (
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-foreground">
                {isEnglish ? "Company name (optional)" : "Nama perusahaan (opsional)"}
              </label>
              <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} autoComplete="organization" />
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>{isEnglish ? "Cancel" : "Batal"}</Button>}
            <Button type="submit" variant="accent" size="lg" disabled={busy} className={surface === "plain" ? "w-full" : undefined}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {submitLabel ?? (isClaim
                ? (isEnglish ? "Send verification code" : "Kirim kode verifikasi")
                : (isEnglish ? "Continue with email" : "Lanjutkan dengan email"))}
            </Button>
          </div>
        </form>
      ) : (
        <form onSubmit={verifyCode} className={showIntroduction ? "mt-5 space-y-4" : "space-y-4"}>
          <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <MailCheck className="size-4" />
            <span>{isEnglish ? `Verification code sent to ${email}.` : `Kode verifikasi dikirim ke ${email}.`}</span>
          </div>
          {developmentCode && (
            <p className="text-[13px] text-muted-foreground">
              Development only · OTP: <span className="font-semibold tracking-wider text-foreground">{developmentCode}</span>
            </p>
          )}
          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold text-foreground">{isEnglish ? "6-digit code" : "Kode 6 digit"}</label>
            <Input
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              required
              autoComplete="one-time-code"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" disabled={busy} onClick={() => { setChallengeId(null); setCode(""); setDevelopmentCode(null); }}>
              {isEnglish ? "Change email" : "Ganti email"}
            </Button>
            <Button type="submit" variant="accent" size="lg" disabled={busy || code.length !== 6} className={surface === "plain" ? "flex-1" : undefined}>
              {busy && <Loader2 className="size-3.5 animate-spin" />}
              {isClaim ? (isEnglish ? "Continue to expert" : "Lanjut ke konsultan") : (isEnglish ? "Verify and continue" : "Verifikasi dan lanjutkan")}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
