export type ConsultationAccessLocale = "en" | "id";

interface ConsultationsAccessCopy {
  brandTagline: string;
  backLabel: string;
  leftTitle: string;
  leftBody: string;
  title: string;
  subtitle: string;
  emailLabel: string;
  submitLabel: string;
}

const copy: Record<ConsultationAccessLocale, ConsultationsAccessCopy> = {
  en: {
    brandTagline: "Tax Advisory & Controversy",
    backLabel: "Back to Meridian",
    leftTitle: "One conversation. AI and expert guidance together.",
    leftBody: "Your consultation history stays intact when a Meridian expert joins your case.",
    title: "Access your consultations",
    subtitle: "Enter your email to continue previous conversations with Meridian.",
    emailLabel: "Email",
    submitLabel: "Continue with email",
  },
  id: {
    brandTagline: "Konsultasi & Sengketa Pajak",
    backLabel: "Kembali ke Meridian",
    leftTitle: "Satu percakapan. Panduan AI dan konsultan dalam satu alur.",
    leftBody: "Riwayat konsultasi Anda tetap utuh saat konsultan Meridian bergabung dalam kasus Anda.",
    title: "Akses konsultasi Anda",
    subtitle: "Masukkan email Anda untuk melanjutkan percakapan sebelumnya dengan Meridian.",
    emailLabel: "Email",
    submitLabel: "Lanjutkan dengan email",
  },
};

export function getConsultationsAccessCopy(locale: ConsultationAccessLocale) {
  return copy[locale];
}
