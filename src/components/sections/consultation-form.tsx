"use client";

import * as React from "react";
import * as m from "@/paraglide/messages.js";
import { useAppLocale, useLocalizedMessage } from "@/components/locale-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { submitConsultationAction, type ConsultationActionResult } from "@/app/actions/intake";

export function ConsultationForm() {
  const { locale } = useAppLocale();
  const t = useLocalizedMessage();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<ConsultationActionResult | null>(null);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  const [formData, setFormData] = React.useState({
    fullName: "",
    workEmail: "",
    companyName: "",
    primaryJurisdiction: "Indonesia",
    practiceArea: "Corporate Tax Compliance & CIT",
    inquirySummary: "",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await submitConsultationAction({
        ...formData,
        locale,
      });

      if (res.success) {
        setResult(res);
      } else {
        setErrorMessage(res.error || t(m.form_error_generic));
      }
    } catch {
      setErrorMessage(t(m.form_error_generic));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setErrorMessage(null);
    setFormData({
      fullName: "",
      workEmail: "",
      companyName: "",
      primaryJurisdiction: "Indonesia",
      practiceArea: "Corporate Tax Compliance & CIT",
      inquirySummary: "",
    });
  };

  return (
    <section id="consultation" className="w-full py-20 md:py-28 bg-background border-b border-border scroll-mt-12">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header */}
        <div className="space-y-3">
          <h2 suppressHydrationWarning className="font-heading font-bold text-2xl sm:text-3xl text-foreground tracking-tight text-balance">
            {t(m.form_title)}
          </h2>
          <p suppressHydrationWarning className="text-base text-muted-foreground leading-relaxed text-pretty font-normal">
            {t(m.form_subtitle)}
          </p>
        </div>

        {result?.success ? (
          /* Success State */
          <div className="bg-card border border-border rounded-lg p-8 sm:p-10 text-center space-y-6">
            <div className="size-12 mx-auto rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold text-lg">
              ✓
            </div>
            <div className="space-y-2">
              <h3 suppressHydrationWarning className="font-heading font-bold text-xl text-foreground text-balance">
                {t(m.form_success_title)}
              </h3>
              <p suppressHydrationWarning className="text-[13px] text-muted-foreground text-pretty">
                {t(m.form_success_message)}
              </p>
              <div className="p-3 bg-muted border border-border rounded-md font-sans text-base font-bold tracking-wider text-foreground max-w-xs mx-auto">
                {result.caseReference}
              </div>
            </div>

            <p suppressHydrationWarning className="text-[13px] text-muted-foreground max-w-md mx-auto leading-relaxed text-pretty">
              {t(m.form_success_sla)}
            </p>

            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={handleReset} className="cursor-pointer text-[13px]" suppressHydrationWarning>
                {t(m.form_success_new)}
              </Button>
            </div>
          </div>
        ) : (
          /* Consultation Form */
          <form onSubmit={handleSubmit} className="space-y-6">
            {errorMessage && (
              <div className="p-4 rounded-md bg-destructive/10 border border-destructive/30 text-[13px] font-semibold text-destructive text-pretty">
                {errorMessage}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {/* Full Name & Title */}
              <div className="space-y-2">
                <label htmlFor="fullName" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                  {t(m.form_label_name)} *
                </label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder={t(m.form_placeholder_name)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Work Email */}
              <div className="space-y-2">
                <label htmlFor="workEmail" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                  {t(m.form_label_email)} *
                </label>
                <Input
                  id="workEmail"
                  name="workEmail"
                  type="email"
                  required
                  value={formData.workEmail}
                  onChange={handleChange}
                  placeholder={t(m.form_placeholder_email)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Company Name */}
              <div className="space-y-2">
                <label htmlFor="companyName" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                  {t(m.form_label_company)} *
                </label>
                <Input
                  id="companyName"
                  name="companyName"
                  required
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder={t(m.form_placeholder_company)}
                  disabled={isSubmitting}
                />
              </div>

              {/* Primary Jurisdiction */}
              <div className="space-y-2">
                <label htmlFor="primaryJurisdiction" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                  {t(m.form_label_jurisdiction)} *
                </label>
                <Input
                  id="primaryJurisdiction"
                  name="primaryJurisdiction"
                  required
                  value={formData.primaryJurisdiction}
                  onChange={handleChange}
                  placeholder={t(m.form_placeholder_jurisdiction)}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Practice Area Selector */}
            <div className="space-y-2">
              <label htmlFor="practiceArea" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                {t(m.form_label_practice)} *
              </label>
              <select
                id="practiceArea"
                name="practiceArea"
                suppressHydrationWarning
                value={formData.practiceArea}
                onChange={handleChange}
                disabled={isSubmitting}
                className="flex h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm transition-colors focus-visible:border-ring focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring text-foreground"
              >
                <option suppressHydrationWarning value="Corporate Tax Compliance & CIT">{t(m.form_practice_opt1)}</option>
                <option suppressHydrationWarning value="Transfer Pricing Documentation (PMK-172)">{t(m.form_practice_opt2)}</option>
                <option suppressHydrationWarning value="Tax Dispute / SP2DK / Tax Court">{t(m.form_practice_opt3)}</option>
                <option suppressHydrationWarning value="Cross-Border Tax / M&A Due Diligence">{t(m.form_practice_opt4)}</option>
                <option suppressHydrationWarning value="Other Strategic Advisory">{t(m.form_practice_opt5)}</option>
              </select>
            </div>

            {/* Inquiry Summary */}
            <div className="space-y-2">
              <label htmlFor="inquirySummary" suppressHydrationWarning className="text-[13px] font-semibold text-foreground">
                {t(m.form_label_summary)} *
              </label>
              <Textarea
                id="inquirySummary"
                name="inquirySummary"
                required
                rows={4}
                value={formData.inquirySummary}
                onChange={handleChange}
                placeholder={t(m.form_placeholder_summary)}
                disabled={isSubmitting}
              />
            </div>

            {/* Institutional Confidentiality Notice */}
            <p suppressHydrationWarning className="text-[13px] text-muted-foreground leading-relaxed text-pretty">
              {t(m.form_nda_note)}
            </p>

            {/* Form Submission CTA */}
            <div className="pt-2">
              <Button
                type="submit"
                variant="accent"
                size="lg"
                disabled={isSubmitting}
                className="w-full sm:w-auto h-12 px-8 text-sm font-semibold cursor-pointer"
                suppressHydrationWarning
              >
                {isSubmitting ? t(m.form_submitting) : t(m.form_submit_button)}
              </Button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
