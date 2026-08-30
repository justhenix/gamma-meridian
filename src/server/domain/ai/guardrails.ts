import "server-only";

export type GuardrailCategory = "jailbreak" | "prompt_injection" | "illegal_activity";

export interface GuardrailResult {
  triggered: boolean;
  category?: GuardrailCategory;
  reasonCode?: string;
  responseMessage?: {
    id: string;
    en: string;
  };
}

const JAILBREAK_PATTERNS = [
  /\bDAN\b/,
  /\b(?:Do Anything Now|act as a dan|mode dan)\b/i,
  /\b(?:jailbreak|jailbroken)\b/i,
  /\b(?:developer mode|unrestricted mode)\b/i,
  /\b(?:bypass|override)\s+(?:rules|filters|safety|restrictions|policy)\b/i,
  /\b(?:pretend|act as though)\s+(?:you have no rules|you are unrestricted)\b/i,
  /\b(?:stay in character|breaking character|deduct(?:ed)?\s+\d+\s+tokens?)\b/i,
  /\b(?:\[🔒CLASSIC\]|\[🔓JAILBREAK\])\b/i,
  /\b(?:ChatGPT successfully jailbroken)\b/i,
];

const INJECTION_PATTERNS = [
  /\b(?:ignore|forget|disregard)\s+(?:all\s+)?(?:previous|prior|above|system)\s+(?:instructions?|directives?|prompts?|rules?)\b/i,
  /\b(?:abaikan|lupakan)\s+(?:semua\s+)?(?:instruksi|perintah|aturan)\s+(?:sebelumnya|awal)\b/i,
  /\b(?:reveal|show|display|print|expose|output)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions?|hidden\s+prompt)\b/i,
  /\b(?:tampilkan|bocorkan)\s+(?:system\s+prompt|instruksi\s+sistem)\b/i,
  /\b(?:you are now|from now on you are|mulai sekarang kamu adalah)\s+(?!Meridian\b)[a-z0-9_-]+/i,
];

const ILLEGAL_PATTERNS = [
  /\b(?:evade|evading)\s+(?:(?:corporate\s+)?taxes?)\b/i,
  /\b(?:tax evasion|tax fraud)\b/i,
  /\b(?:penggelapan pajak|menggelapkan pajak)\b/i,
  /\b(?:fake|fictitious|bogus)\s+(?:invoices?|tax invoices?|receipts?)\b/i,
  /\b(?:faktur\s+(?:fiktif|palsu)|faktur pajak bodong)\b/i,
  /\b(?:bribe|bribery|bribing)\s+(?:tax|official|auditor|examiner)?\b/i,
  /\b(?:suap|menyuap|sogok|menyogok)\s+(?:petugas|pemeriksa|pegawai)?\s*pajak\b/i,
  /\b(?:money laundering|launder(?:ing)?\s+money)\b/i,
  /\b(?:pencucian uang|cuci uang)\b/i,
  /\b(?:off[- ]the[- ]books|under[- ]the[- ]table)\s+(?:cash|payment|scheme|arrangement)\b/i,
  /\b(?:cara|bagaimana)\s+(?:menghindari|mengelak)\s+pajak\s+secara\s+ilegal\b/i,
];

export function evaluateGuardrails(question: string): GuardrailResult {
  const normalized = question.trim();
  if (!normalized) return { triggered: false };

  // 1. Jailbreak attempts
  for (const pattern of JAILBREAK_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        triggered: true,
        category: "jailbreak",
        reasonCode: "guardrail_jailbreak_detected",
        responseMessage: {
          id: "Saya adalah **Meridian Assistant**, didedikasikan secara eksklusif untuk memberikan panduan profesional terkait perpajakan badan, pendirian usaha, dan kepatuhan hukum di Indonesia. Saya tidak dapat mengubah peran atau mengabaikan parameter keamanan dan operasional.",
          en: "I am **Meridian Assistant**, dedicated exclusively to providing professional guidance on Indonesian corporate tax, business setup, and regulatory compliance. I cannot adopt alternative personas, bypass instructions, or discuss unrelated matters.",
        },
      };
    }
  }

  // 2. Prompt injection / instruction overrides
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        triggered: true,
        category: "prompt_injection",
        reasonCode: "guardrail_prompt_injection_detected",
        responseMessage: {
          id: "Permintaan untuk mengubah atau mengekspos instruksi operasional sistem tidak dapat diproses. Silakan ajukan pertanyaan seputar perpajakan atau pendirian usaha di Indonesia yang dapat kami bantu.",
          en: "Requests to alter or expose system operational instructions cannot be processed. Please let me know if you have legitimate questions regarding Indonesian taxation or business setup.",
        },
      };
    }
  }

  // 3. Illegal activities & tax fraud / evasion
  for (const pattern of ILLEGAL_PATTERNS) {
    if (pattern.test(normalized)) {
      return {
        triggered: true,
        category: "illegal_activity",
        reasonCode: "guardrail_illegal_activity_detected",
        responseMessage: {
          id: "Meridian tidak dapat memfasilitasi penggelapan pajak, transaksi atau faktur fiktif, penyuapan, pencucian uang, atau tindakan melanggar hukum lainnya. Kami secara ketat hanya membantu klien dalam perencanaan pajak yang sah, kepatuhan resmi, dan penyelesaian sengketa perpajakan sesuai peraturan perundang-undangan Indonesia.",
          en: "Meridian cannot assist with tax evasion, fraudulent transactions or fake invoices, bribery, money laundering, or unlawful activities. We strictly assist clients with lawful tax planning, official compliance, and dispute defense under Indonesian tax regulations.",
        },
      };
    }
  }

  return { triggered: false };
}
