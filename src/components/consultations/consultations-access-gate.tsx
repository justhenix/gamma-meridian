"use client";

import Image from "next/image";
import Link from "next/link";

import { EmailVerificationPanel } from "@/components/auth/email-verification-panel";
import { getConsultationsAccessCopy } from "@/lib/consultations/access-copy";
import { localizeHref } from "@/paraglide/runtime.js";

interface ConsultationsAccessGateProps {
  locale: "en" | "id";
  onVerified: () => void | Promise<void>;
}

export function ConsultationsAccessGate({ locale, onVerified }: ConsultationsAccessGateProps) {
  const text = getConsultationsAccessCopy(locale);
  const isEnglish = locale === "en";

  return (
    <main className="min-h-screen bg-[#0b0f17] p-4 text-foreground sm:p-6 lg:flex lg:items-center lg:justify-center lg:p-8">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-hidden rounded-lg bg-card shadow-2xl sm:min-h-[calc(100vh-3rem)] lg:min-h-[720px] lg:grid-cols-[1.35fr_1fr]">
        <div className="relative min-h-[260px] overflow-hidden bg-[#0b0f17] sm:min-h-[340px] lg:min-h-full">
          <Image
            src="/auth.webp"
            alt=""
            fill
            preload
            sizes="(max-width: 1023px) 100vw, 58vw"
            className="object-cover object-[50%_58%]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/10" aria-hidden="true" />

          <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8 lg:p-10">
            <div className="max-w-md space-y-3">
              <h2 className="font-heading text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
                {text.leftTitle}
              </h2>
              <p className="max-w-sm text-[15px] leading-relaxed text-slate-200">
                {text.leftBody}
              </p>
            </div>
          </div>
        </div>

        <div className="flex bg-card px-6 py-7 sm:px-9 sm:py-9 lg:px-12 lg:py-11">
          <div className="mx-auto flex w-full max-w-sm flex-col">
            <div className="flex items-start justify-between gap-4">
              <Link href={localizeHref("/", { locale })} className="flex flex-col">
                <span className="font-heading text-lg font-bold leading-none tracking-tight text-foreground">Meridian</span>
                <span className="mt-1 text-[13px] font-medium text-muted-foreground">{text.brandTagline}</span>
              </Link>
              <Link
                href={localizeHref("/", { locale })}
                className="text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
              >
                {text.backLabel}
              </Link>
            </div>

            <div className="flex flex-1 items-center py-10 lg:py-14">
              <div className="w-full">
                <div className="mb-7 space-y-2">
                  <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-[34px]">
                    {text.title}
                  </h1>
                  <p className="text-[15px] leading-relaxed text-muted-foreground">{text.subtitle}</p>
                </div>

                <EmailVerificationPanel
                  purpose="consultations"
                  isEnglish={isEnglish}
                  onVerified={onVerified}
                  surface="plain"
                  showIntroduction={false}
                  emailLabel={text.emailLabel}
                  submitLabel={text.submitLabel}
                />
              </div>
            </div>

            <p className="text-[13px] leading-relaxed text-muted-foreground">
              {isEnglish
                ? "Email verification protects access to your private consultation history."
                : "Verifikasi email melindungi akses ke riwayat konsultasi pribadi Anda."}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
