"use client";

import * as React from "react";
import { AlertCircle, KeyRound, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface StaffEmailVerificationPanelProps {
  redirectTarget: string;
}

function apiError(body: unknown, fallback: string): string {
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof body.error === "object" &&
    body.error !== null &&
    "message" in body.error &&
    typeof body.error.message === "string"
  ) {
    return body.error.message;
  }
  return fallback;
}

export function StaffEmailVerificationPanel({ redirectTarget }: StaffEmailVerificationPanelProps) {
  const [email, setEmail] = React.useState("");
  const [challengeId, setChallengeId] = React.useState<string | null>(null);
  const [code, setCode] = React.useState("");
  const [developmentCode, setDevelopmentCode] = React.useState<string | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);

  const sendCode = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth/staff/verification/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = await response.json().catch(() => ({})) as {
        challengeId?: string;
        developmentCode?: string;
      };
      if (!response.ok || !body.challengeId) {
        throw new Error(apiError(body, "Could not send the staff verification code."));
      }
      setChallengeId(body.challengeId);
      setDevelopmentCode(body.developmentCode ?? null);
      if (body.developmentCode) setCode(body.developmentCode);
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setIsLoading(false);
    }
  };

  const verifyCode = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!challengeId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetch("/api/auth/staff/verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId, code }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(apiError(body, "Could not verify the staff code."));
      }
      window.location.href = redirectTarget;
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : String(cause));
      setIsLoading(false);
    }
  };

  const resetEmail = () => {
    setChallengeId(null);
    setCode("");
    setDevelopmentCode(null);
    setErrorMessage(null);
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6 sm:p-7 shadow-sm space-y-5">
      {errorMessage && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/40 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {!challengeId ? (
        <form onSubmit={sendCode} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="staff-email" className="text-xs font-semibold text-foreground">
              Staff email
            </label>
            <Input
              id="staff-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              placeholder="name@company.com"
              required
            />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Use an email authorized for the Meridian staff workspace. We will send a 6-digit code valid for 10 minutes.
          </p>
          <Button type="submit" disabled={isLoading || !email.trim()} className="w-full gap-2 font-semibold">
            <Mail className="size-4" />
            {isLoading ? "Sending code..." : "Send staff verification code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verifyCode} className="space-y-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Verification code sent to</p>
            <p className="text-sm font-semibold text-foreground">{email}</p>
          </div>
          {developmentCode && (
            <div className="rounded-md border border-amber-300/60 bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-900 dark:text-amber-200">
              Development code: <span className="font-mono font-semibold">{developmentCode}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <label htmlFor="staff-code" className="text-xs font-semibold text-foreground">
              6-digit code
            </label>
            <Input
              id="staff-code"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              autoComplete="one-time-code"
              required
              className="font-mono tracking-[0.25em]"
            />
          </div>
          <Button type="submit" disabled={isLoading || code.length !== 6} className="w-full gap-2 font-semibold">
            <KeyRound className="size-4" />
            {isLoading ? "Verifying..." : "Enter staff workspace"}
          </Button>
          <button
            type="button"
            onClick={resetEmail}
            disabled={isLoading}
            className="w-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Use a different email
          </button>
        </form>
      )}
    </div>
  );
}
