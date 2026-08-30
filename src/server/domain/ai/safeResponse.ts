import "server-only";

export function humanRecommendationMessage(
  locale: "id" | "en",
  expertEscalationFree: boolean,
  isExplicitUserRequest = false,
): string {
  if (isExplicitUserRequest) {
    const direct = locale === "id"
      ? "Tentu, saya akan menghubungkan Anda dengan konsultan pajak dan hukum Meridian. Silakan konfirmasi di bawah ini agar konsultan kami dapat bergabung langsung dalam konsultasi ini."
      : "I will connect you directly with a Meridian tax and legal expert. Please confirm below to bring a senior consultant into this consultation.";
    if (!expertEscalationFree) return direct;
    return `${direct}\n\n${locale === "id"
      ? "Seorang ahli dapat bergabung dalam percakapan ini tanpa biaya tambahan."
      : "An expert can join this conversation at no additional cost."}`;
  }

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

export type ConversationalIntent = "date" | "greeting" | "identity" | "thanks";

export function matchConversationalIntent(query: string): ConversationalIntent | null {
  const trimmed = query.trim();
  if (!trimmed) return null;

  // Date and time queries
  if (
    /^(?:what(?:'s| is) (?:the )?(?:current |today'?s )?date\??|what date is (?:it|today)\??|today'?s date\??|what is the day today\??|what day is (?:it|today)\??|sekarang tanggal berapa\??|tanggal berapa (?:sekarang|hari ini)\??|hari apa sekarang\??|what time is it\??|jam berapa sekarang\??)$/i.test(trimmed)
  ) {
    return "date";
  }

  // Pure greetings
  if (
    /^(?:hi|hello|halo|hai|hey|good morning|good afternoon|good evening|good day|selamat pagi|selamat siang|selamat sore|selamat malam)\b[!?.]*$/i.test(trimmed)
  ) {
    return "greeting";
  }

  // Identity / Assistant capability inquiries
  if (
    /^(?:who are you\??|what are you\??|what can you do\??|what is meridian\??|how can you help(?:\s+me)?\??|siapa (?:anda|kamu)\??|apa yang bisa (?:kamu|anda) lakukan\??|apa itu meridian\??|bisa bantu apa\??|help|bantuan)$/i.test(trimmed)
  ) {
    return "identity";
  }

  // Thanks / acknowledgments
  if (
    /^(?:thank you(?:\s+very\s+much)?|thanks(?:\s+a\s+lot)?|terima kasih(?:\s+banyak)?|makasih|ok|okay|got it|baik|terimakasih)\b[!?.]*$/i.test(trimmed)
  ) {
    return "thanks";
  }

  return null;
}

export function conversationalAnswer(
  intent: ConversationalIntent,
  locale: "id" | "en",
  relevantDate?: string,
): string {
  if (intent === "date") {
    const dateObj = relevantDate ? new Date(`${relevantDate}T12:00:00Z`) : new Date();
    const formattedDate = dateObj.toLocaleDateString(locale === "id" ? "id-ID" : "en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return locale === "id"
      ? `Hari ini adalah tanggal ${formattedDate}. Saya adalah Meridian Assistant, siap memberikan panduan awal mengenai perpajakan badan dan pendirian usaha di Indonesia. Ada yang bisa saya bantu terkait situasi bisnis Anda?`
      : `Today's date is ${formattedDate}. I am Meridian Assistant, here to provide guidance on Indonesian corporate tax, business setup, and regulatory compliance. How can I assist you with your business or tax situation?`;
  }

  if (intent === "greeting") {
    return locale === "id"
      ? "Halo! Saya **Meridian Assistant**. Saya siap memberikan panduan awal mengenai perpajakan Indonesia, pendirian PT PMA/PMDN, perizinan berusaha berbasis risiko (OSS), dan kepatuhan pajak perusahaan. Ada yang ingin Anda tanyakan?"
      : "Hello! I am **Meridian Assistant**. I provide initial guidance on Indonesian corporate taxation, business setup (PT PMA/PMDN), risk-based licensing (OSS), and compliance. How can I help you today?";
  }

  if (intent === "identity") {
    return locale === "id"
      ? "Saya adalah **Meridian Assistant**, asisten digital dari Meridian Tax & Legal Advisory. Saya dapat membantu menjelaskan konsep perpajakan Indonesia, persyaratan pendirian perseroan terbatas (PT PMA/PMDN), nomor induk berusaha (NIB/OSS), PPh Badan, PPN, dan dokumentasi transfer pricing. Jika situasi Anda memerlukan analisis mendalam, konsultan berlisensi Meridian juga siap bergabung dalam percakapan."
      : "I am **Meridian Assistant**, a specialized guidance assistant from Meridian Tax & Legal Advisory. I can help explain Indonesian corporate tax rules, foreign investment setup (PT PMA), risk-based licensing (OSS/NIB), Corporate Income Tax, VAT, and transfer pricing documentation. If your situation requires formal advice, a licensed Meridian consultant can also step into this conversation.";
  }

  return locale === "id"
    ? "Sama-sama! Silakan tanyakan jika Anda memiliki pertanyaan lain seputar perpajakan atau pendirian usaha di Indonesia."
    : "You're very welcome! Please let me know if you have any further questions about Indonesian tax or business matters.";
}

