import "server-only";

export function humanRecommendationMessage(
  locale: "id" | "en",
  expertEscalationFree: boolean,
): string {
  const base = locale === "id"
    ? "Kasus ini bergantung pada fakta tambahan dan interpretasi profesional. Saya menyarankan agar ahli Meridian bergabung dalam percakapan ini sehingga Anda tidak perlu menjelaskan ulang dari awal."
    : "This looks like a case where the correct treatment depends on additional facts and professional interpretation. I recommend bringing a Meridian expert into this conversation so you do not need to explain everything again.";
  if (!expertEscalationFree) return base;
  return `${base}\n\n${locale === "id"
    ? "Seorang ahli dapat bergabung dalam percakapan ini tanpa biaya tambahan."
    : "An expert can join this conversation at no additional cost."}`;
}

export function unavailableSourceMessage(locale: "id" | "en"): string {
  return locale === "id"
    ? "Saya tidak dapat menjawab dengan aman berdasarkan sumber resmi yang telah disetujui dan tersedia saat ini. Saya menyarankan agar ahli Meridian meninjau pertanyaan ini dalam percakapan yang sama."
    : "I cannot safely answer this from the approved sources currently available. I recommend asking a Meridian expert to review this in the same conversation.";
}
