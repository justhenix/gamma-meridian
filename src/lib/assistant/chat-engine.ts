import type { ChatMessage, Citation } from "./types";
import { findMatchingRegulations, APPROVED_REGULATIONS } from "./regulatory-corpus";

export interface AIResponsePayload {
  body: string;
  citations: Citation[];
  suggestedFollowUps: string[];
  escalationRecommended: boolean;
  freeEscalationConfirmed?: boolean;
}

export function generateAssistantResponse(query: string, isEnglish: boolean = false): AIResponsePayload {
  const q = query.toLowerCase();
  const matchedCitations = findMatchingRegulations(query);

  // 1. SP2DK / Tax Audit / Tax Dispute Inquiry
  if (
    q.includes("sp2dk") ||
    q.includes("pemeriksaan") ||
    q.includes("audit") ||
    q.includes("sengketa") ||
    q.includes("banding") ||
    q.includes("keberatan") ||
    q.includes("notice") ||
    q.includes("djp")
  ) {
    const body = isEnglish
      ? `Regarding your tax audit/SP2DK inquiry under Indonesian tax laws:\n\n1. **Statutory 14-Day Response Window**:\nUnder [SE-05/PJ/2022 & UU KUP · Pasal 12], taxpayers must submit formal written clarification within **14 calendar days** from the date of receipt. Timely and factually supported submissions prevent arbitrary assessment escalations.\n\n2. **Defensible Workpapers & Reconciliations**:\nPrepare complete transaction logs, commercial justifications, and tax reconciliation workpapers aligned with [UU 7/2021 (HPP) · Pasal 31A].\n\n3. **Closing Conference (PAHP) Protocol**:\nEnsure all counter-arguments are documented in writing before signing closing minutes.\n\nBecause formal tax inquiries carry substantial audit risks, we strongly advise having our senior tax controversy team review your draft response before submission.`
      : `Berdasarkan ketentuan pengawasan kepatuhan perpajakan di Indonesia:\n\n1. **Batas Waktu Tanggapan (14 Hari Kalender)**:\nSesuai [SE-05/PJ/2022 & UU KUP · Pasal 12], Wajib Pajak memiliki waktu maksimal **14 hari kalender** sejak tanggal diterimanya SP2DK untuk menyampaikan surat tanggapan resmi. Keterlambatan dapat memicu penerbitan instruksi Pemeriksaan Pajak formal.\n\n2. **Kesiapan Kertas Kerja & Rekonsiliasi Fiskal**:\nSusun rekonsiliasi antara laporan keuangan komersial, SPT Masa PPh/PPN, dan data yang dipertanyakan oleh Account Representative (AR) dengan dasar hukum [UU 7/2021 (HPP) · Pasal 31A].\n\n3. **Hak Pembahasan Akhir (PAHP)**:\nSeluruh argumentasi pembelaan dan bukti dokumen pendukung wajib disampaikan secara tertulis agar mengikat secara hukum.\n\nKarena penanganan SP2DK menentukan apakah kasus akan naik ke tahap pemeriksaan pajak, kami menyarankan penelaahan langsung bersama konsultan senior Meridian.`;

    return {
      body,
      citations: [
        matchedCitations.find((c) => c.id === "uu-kup-art14-sp2dk") || APPROVED_REGULATIONS[3],
        matchedCitations.find((c) => c.id === "uu-hpp-cit-art31a") || APPROVED_REGULATIONS[2],
      ],
      suggestedFollowUps: isEnglish
        ? [
            "What supporting documents are mandatory for an SP2DK reply?",
            "What happens if our response is rejected by the Account Representative?",
          ]
        : [
            "Dokumen apa saja yang wajib dilampirkan dalam tanggapan SP2DK?",
            "Bagaimana jika Account Representative menolak penjelasan tertulis kami?",
          ],
      escalationRecommended: true,
      freeEscalationConfirmed: true,
    };
  }

  // 2. Transfer Pricing / Intercompany / PMK 172
  if (
    q.includes("transfer pricing") ||
    q.includes("tp doc") ||
    q.includes("local file") ||
    q.includes("master file") ||
    q.includes("afiliasi") ||
    q.includes("arm's length") ||
    q.includes("royalti") ||
    q.includes("172")
  ) {
    const body = isEnglish
      ? `Under Indonesian Transfer Pricing regulations:\n\n1. **Arm's Length Principle (ALP)**:\nUnder [PMK 172/2023 · Pasal 4], all intercompany transactions with domestic and overseas affiliates must apply the most appropriate transfer pricing method (CUP, Resale Price, Cost Plus, TNMM, or Profit Split) and prove economic substance.\n\n2. **Documentation Timeline & Availability**:\nPursuant to [PMK 172/2023 · Pasal 16], the Local File and Master File must be finalized and available within **4 months after the end of the fiscal year** (by April 30 for calendar-year entities).\n\n3. **Benefit Test for Services & Intangibles**:\nIntercompany royalty and service fees require verifiable proof of actual benefit and arm's length benchmarking analysis.`
      : `Berdasarkan ketentuan Transfer Pricing di Indonesia:\n\n1. **Penerapan Prinsip Kewajaran & Kelaziman Usaha (ALP)**:\nSesuai [PMK 172/2023 · Pasal 4], seluruh transaksi afiliasi wajib menerapkan metode penentuan harga transfer yang paling sesuai (*The Most Appropriate Method*) dan memenuhi prinsip substansi ekonomi di atas bentuk formal (*substance over form*).\n\n2. **Batas Waktu Ketersediaan Dokumen (TP Doc)**:\nBerdasarkan [PMK 172/2023 · Pasal 16], Dokumen Lokal (*Local File*) dan Dokumen Induk (*Master File*) **wajib tersedia paling lambat 4 bulan setelah akhir tahun pajak** (30 April untuk tahun buku standar).\n\n3. **Uji Manfaat (*Benefit Test*) Royalti & Jasa**:\nTransaksi pembayaran royalti atau biaya manajemen antar-grup wajib didukung oleh bukti manfaat ekonomi nyata (*economic benefit test*) dan studi pembandingan independen.`;

    return {
      body,
      citations: [
        matchedCitations.find((c) => c.id === "pmk-172-2023-art4") || APPROVED_REGULATIONS[0],
        matchedCitations.find((c) => c.id === "pmk-172-2023-art16") || APPROVED_REGULATIONS[1],
      ],
      suggestedFollowUps: isEnglish
        ? [
            "What are the threshold criteria requiring Master File and Local File?",
            "Can we use multi-year benchmarking data for our 2025 TP Doc?",
          ]
        : [
            "Berapa batas nilai peredaran bruto dan transaksi afiliasi wajib TP Doc?",
            "Apakah studi pembandingan (benchmarking) harus diperbarui tiap tahun?",
          ],
      escalationRecommended: q.includes("sengketa") || q.includes("royalti") || q.includes("miliar"),
      freeEscalationConfirmed: true,
    };
  }

  // 3. Cross-Border / Tax Treaty / Form DGT
  if (
    q.includes("treaty") ||
    q.includes("p3b") ||
    q.includes("dgt") ||
    q.includes("cross border") ||
    q.includes("wpln") ||
    q.includes("but") ||
    q.includes("singapura") ||
    q.includes("luar negeri")
  ) {
    const body = isEnglish
      ? `Regarding cross-border transactions and tax treaty applications in Indonesia:\n\n1. **Certificate of Domicile (Form DGT)**:\nUnder [PER-25/PJ/2018 · Pasal 3], to benefit from reduced treaty withholding rates, foreign tax residents must provide an authenticated Form DGT submitted through the DJP Online portal prior to the monthly withholding tax deadline.\n\n2. **Coretax & Integrated Reporting Verification**:\nAs mandated under [PP 28/2025 · Pasal 12], cross-border documentation and electronic declarations require rigorous validation against jurisdiction partner standards.\n\n3. **Beneficial Ownership & Anti-Avoidance**:\nThe foreign recipient must prove that it is the genuine beneficial owner with commercial substance and is not functioning as a conduit entity.`
      : `Mengenai transaksi lintas batas dan penerapan Tax Treaty (P3B) di Indonesia:\n\n1. **Ketentuan Form DGT (SKD WPLN)**:\nBerdasarkan [PER-25/PJ/2018 · Pasal 3], pemanfaatan tarif P3B yang lebih rendah mewajibkan pengisian dan pengesahan Form DGT yang sah serta diunggah ke DJP Online sebelum batas waktu pelaporan SPT Masa.\n\n2. **Pelaporan Terintegrasi Coretax**:\nSesuai [PP 28/2025 · Pasal 12], transaksi lintas batas negara yang dilaporkan melalui sistem administrasi terintegrasi wajib disertai verifikasi dokumen pendukung yang valid.\n\n3. **Uji Pemilik Manfaat Sebenarnya (*Beneficial Ownership*)**:\nPenerima penghasilan luar negeri harus membuktikan bahwa entitas tersebut memiliki substansi ekonomi aktif dan bukan sekadar entitas perantara (*conduit entity*).`;

    return {
      body,
      citations: [
        matchedCitations.find((c) => c.id === "per-25-pj-2018-dgt") || APPROVED_REGULATIONS[5],
        matchedCitations.find((c) => c.id === "pp-28-2025-art12") || APPROVED_REGULATIONS[4],
      ],
      suggestedFollowUps: isEnglish
        ? [
            "What is the maximum validity period for a Form DGT?",
            "How do we handle Permanent Establishment (PE) risks for foreign consultants?",
          ]
        : [
            "Berapa lama masa berlaku Form DGT SKD WPLN?",
            "Bagaimana mitigasi risiko Bentuk Usaha Tetap (BUT) untuk konsultan asing?",
          ],
      escalationRecommended: true,
      freeEscalationConfirmed: true,
    };
  }

  // 4. Default / Corporate Income Tax / General
  const body = isEnglish
    ? `Based on Indonesian Corporate Income Tax (CIT) standards:\n\n1. **Standard Corporate Tax Rate (22%)**:\nUnder [UU 7/2021 (HPP) · Pasal 31A], corporate income tax is assessed at a flat **22%** rate on taxable net profits for domestic corporate taxpayers.\n\n2. **Domestic Dividend Exemption**:\nPursuant to [PMK 18/2021 · Pasal 28], intercompany dividends received from domestic subsidiaries are strictly non-taxable without minimum shareholding thresholds.\n\n3. **Fiscal Deductibility & 3M Principle**:\nExpenses are deductible provided they are directly incurred to obtain, collect, and maintain taxable income (*biaya 3M*).\n\nIf you would like a detailed review of your specific corporate tax structure or compliance filing, you can connect directly with our advisory team.`
    : `Berdasarkan ketentuan Pajak Penghasilan (PPh Badan) di Indonesia:\n\n1. **Tarif PPh Badan (22%)**:\nSesuai [UU 7/2021 (HPP) · Pasal 31A], tarif PPh Badan yang berlaku bagi Wajib Pajak Badan dalam negeri adalah **22%** atas Penghasilan Kena Pajak.\n\n2. **Pembebasan Pajak atas Dividen Domestik**:\nBerdasarkan [PMK 18/2021 · Pasal 28], dividen yang diterima dari entitas anak dalam negeri dikategorikan sebagai non-objek PPh tanpa batasan persentase kepemilikan saham.\n\n3. **Prinsip Biaya 3M (Deductible Expenses)**:\nBiaya dapat dikurangkan dari penghasilan bruto sepanjang memenuhi kriteria untuk Mendapatkan, Menagih, dan Memelihara penghasilan (3M) dengan bukti pendukung memadai.\n\nJika Anda membutuhkan telaah mendalam terkait struktur perpajakan atau kepatuhan spesifik perusahaan Anda, silakan hubungi tim penasihat Meridian.`;

  return {
    body,
    citations: [
      matchedCitations.find((c) => c.id === "uu-hpp-cit-art31a") || APPROVED_REGULATIONS[2],
      matchedCitations.find((c) => c.id === "pmk-18-2021-deductions") || APPROVED_REGULATIONS[6],
    ],
    suggestedFollowUps: isEnglish
      ? [
          "How are employee benefit-in-kind (natura) expenses treated under UU HPP?",
          "What is the deadline for filing Corporate Income Tax Returns (SPT Tahunan)?",
        ]
      : [
          "Bagaimana perlakuan biaya natura dan kenikmatan karyawan pasca UU HPP?",
          "Kapan batas waktu pelaporan SPT Tahunan PPh Badan dan setoran PPh Pasal 29?",
        ],
    escalationRecommended: false,
    freeEscalationConfirmed: true,
  };
}
