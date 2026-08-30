import type { HelpdeskCase } from "./types";
import { APPROVED_REGULATIONS } from "./regulatory-corpus";

export const SEED_HELPDESK_CASES: HelpdeskCase[] = [
  {
    id: "case-001",
    caseReference: "MER-2026-8921",
    clientName: "Budi Santoso",
    companyName: "PT Nusantara Jaya Abadi",
    email: "budi.santoso@nusantarajaya.co.id",
    title: "SP2DK Response & Audit Defense on Intercompany Royalties",
    practiceArea: "Tax Dispute Resolution & Defense",
    primaryJurisdiction: "Indonesia (KPP Pratama Jakarta Sudirman)",
    status: "needs_expert",
    riskLevel: "high",
    receivedAt: "2026-08-29T14:30:00Z",
    updatedAt: "2026-08-30T06:15:00Z",
    intakeSummary:
      "Received an SP2DK notice from DJP regarding Rp 14.5 Billion royalty payments made to parent entity in Singapore for FY 2024. Tax office questions economic substance and arm's length justification under PMK-172/2023. Statutory 14-day reply window expires in 6 days.",
    conversationState: "waiting_for_expert",
    assignedConsultant: {
      name: "Hendrik Prasetyo, BAP, S.H.",
      title: "Senior Tax Litigation Partner",
    },
    handoffBrief: {
      caseId: "case-001",
      summary:
        "Client seeks formal legal and benchmarking representation for SP2DK issued by KPP Pratama Jakarta Sudirman. Key dispute concerns benefit test & arm's length royalty rate with Singapore affiliate.",
      clientIntent:
        "Draft defensible formal reply letter before the 14-day statutory deadline and prepare documentation for subsequent closing discussions with Tax Account Representative (AR).",
      aiConclusion:
        "Given the high exposure (Rp 14.5B intercompany transaction), strict 14-day timeline under SE-05/PJ/2022, and requirement for transfer pricing benefit test documentation under PMK-172/2023, immediate senior partner evaluation was triggered.",
      escalationTrigger:
        "Dispute exposure > Rp 10B, active SP2DK notice, high audit escalation risk.",
      missingFacts: [
        {
          key: "sp2dk_date",
          label: "Exact Date of SP2DK Letter",
          status: "provided",
          value: "22 Agustus 2026",
        },
        {
          key: "local_file_status",
          label: "Availability of 2024 TP Local File",
          status: "needs_verification",
          value: "Draft in progress, not finalized",
        },
        {
          key: "form_dgt_validity",
          label: "Singapore Co. Form DGT Status",
          status: "missing",
        },
      ],
      riskFlags: [
        {
          id: "rf-01",
          title: "Statutory 14-Day Response Window",
          description:
            "Failure to respond within 14 calendar days can trigger immediate formal tax audit (Pemeriksaan Pajak) under Article 12 KUP.",
          severity: "high",
          statuteRef: "SE-05/PJ/2022 & UU KUP",
        },
        {
          id: "rf-02",
          title: "Benefit Test & Substantial Proof Burden",
          description:
            "Royalty deduction requires demonstrable economic benefit and non-duplicative service evidence under PMK-172/2023 Pasal 4.",
          severity: "high",
          statuteRef: "PMK-172/2023 Pasal 4",
        },
      ],
      matchedRegulations: [
        APPROVED_REGULATIONS[0], // PMK 172
        APPROVED_REGULATIONS[3], // SE-05/PJ/2022 SP2DK
        APPROVED_REGULATIONS[5], // Form DGT
      ],
    },
    messages: [
      {
        id: "msg-101",
        sender: "client",
        body: "Halo Meridian, kami baru saja menerima SP2DK dari KPP terkait biaya royalti afiliasi ke Singapura sebesar Rp 14,5 Miliar di tahun pajak 2024. Apa yang harus kami siapkan segera?",
        timestamp: "2026-08-29T14:30:00Z",
      },
      {
        id: "msg-102",
        sender: "ai",
        body: "Berdasarkan ketentuan pengawasan kepatuhan perpajakan di Indonesia, berikut langkah-langkah kritis yang harus diperhatikan:\n\n1. **Batas Waktu Tanggapan (14 Hari Kalender)**:\nSesuai [SE-05/PJ/2022 & UU KUP · Pasal 12], Wajib Pajak memiliki waktu maksimal 14 hari kalender sejak tanggal SP2DK untuk menyampaikan surat penjelasan resmi. Keterlambatan dapat menyebabkan usulan pemeriksaan pajak formal.\n\n2. **Uji Manfaat & Prinsip Kewajaran (Benefit Test)**:\nBerdasarkan [PMK 172/2023 · Pasal 4], pembayaran royalti kepada pihak terafiliasi wajib membuktikan adanya substansi ekonomi, nilai manfaat nyata (*benefit test*), dan kesesuaian tarif dengan metode penentuan harga transfer (*TP Doc*).\n\n3. **Kelengkapan Dokumen Tax Treaty**:\nPastikan keabsahan SKD WPLN (Form DGT) yang telah disahkan otoritas IRAS Singapura sesuai [PER-25/PJ/2018 · Pasal 3].",
        timestamp: "2026-08-29T14:30:45Z",
        citations: [
          APPROVED_REGULATIONS[3],
          APPROVED_REGULATIONS[0],
          APPROVED_REGULATIONS[5],
        ],
        escalationRecommended: true,
        escalationState: "requested",
        freeEscalationConfirmed: true,
        suggestedFollowUps: [
          "Bagaimana cara menyusun tanggapan tertulis SP2DK yang aman?",
          "Apakah TP Doc Local File 2024 kami wajib dilampirkan sekarang?",
        ],
      },
      {
        id: "msg-103",
        sender: "client",
        body: "Apakah ada konsultan yang bisa mendampingi kami langsung dalam pembahasan dengan Account Representative?",
        timestamp: "2026-08-29T14:35:10Z",
      },
      {
        id: "msg-104",
        sender: "consultant",
        authorName: "Hendrik Prasetyo, BAP, S.H.",
        authorTitle: "Senior Tax Litigation Partner",
        body: "Selamat siang Bapak Budi. Saya telah menelaah ringkasan kasus dan regulasi terkait SP2DK ini. Mengingat batas waktu 14 hari jatuh pada tanggal 5 September, kami merekomendasikan penelaahan segera terhadap Surat Perjanjian Lisensi (License Agreement) dan draft tanggapan tertulis. Tim kami dapat mendampingi sesi pembahasan formal dengan AR KPP Sudirman.",
        timestamp: "2026-08-30T06:15:00Z",
      },
    ],
  },
  {
    id: "case-002",
    caseReference: "MER-2026-9042",
    clientName: "Caroline Wijaya",
    companyName: "PT Global Logistik Prima",
    email: "c.wijaya@globallogistik.com",
    title: "Transfer Pricing Documentation (Local File & Master File) FY 2025",
    practiceArea: "Transfer Pricing Documentation",
    primaryJurisdiction: "Indonesia",
    status: "ai_handling",
    riskLevel: "medium",
    receivedAt: "2026-08-30T04:10:00Z",
    updatedAt: "2026-08-30T04:15:00Z",
    intakeSummary:
      "Client is preparing Transfer Pricing documentation for FY 2025 following turnover growth exceeding Rp 50 Billion threshold. Needs clarification on mandatory deadlines under PMK-172/2023.",
    conversationState: "ai_assistant",
    handoffBrief: {
      caseId: "case-002",
      summary:
        "Client inquired regarding TP Doc thresholds and preparation timeline under PMK-172/2023.",
      clientIntent:
        "Confirm whether Local File and Master File must be ready within 4 months after fiscal year end.",
      aiConclusion:
        "Standard statutory guidance provided with PMK-172/2023 Pasal 16 citations. Client is currently reviewing follow-up prompts.",
      escalationTrigger: "None currently required.",
      missingFacts: [
        {
          key: "annual_turnover",
          label: "Exact Gross Turnover 2024/2025",
          status: "provided",
          value: "> Rp 50 Miliar",
        },
      ],
      riskFlags: [
        {
          id: "rf-03",
          title: "Documentation Deadline 4 Months After Year-End",
          description:
            "Under PMK-172/2023 Pasal 16, TP Doc must be available upon request without grace period extensions.",
          severity: "medium",
          statuteRef: "PMK-172/2023 Pasal 16",
        },
      ],
      matchedRegulations: [
        APPROVED_REGULATIONS[0],
        APPROVED_REGULATIONS[1],
      ],
    },
    messages: [
      {
        id: "msg-201",
        sender: "client",
        body: "Kapan batas akhir ketersediaan Dokumen Penentuan Harga Transfer (Local File & Master File) untuk tahun pajak yang berakhir Desember 2025?",
        timestamp: "2026-08-30T04:10:00Z",
      },
      {
        id: "msg-202",
        sender: "ai",
        body: "Berdasarkan [PMK 172/2023 · Pasal 16], Dokumen Penentuan Harga Transfer (TP Doc) yang terdiri atas Dokumen Lokal (*Local File*) dan Dokumen Induk (*Master File*) **wajib tersedia paling lambat 4 (empat) bulan setelah akhir Tahun Pajak**.\n\nUntuk tahun buku yang berakhir pada 31 Desember 2025, TP Doc harus sudah selesai dibuat dan bertanggal paling lambat **30 April 2026** (bersamaan dengan batas waktu pelaporan SPT Tahunan PPh Badan).\n\nPerlu diperhatikan bahwa ikhtisar TP Doc wajib dilampirkan pada formulir SPT Tahunan PPh Badan sesuai ketentuan lampiran khusus 3A/3B.",
        timestamp: "2026-08-30T04:11:15Z",
        citations: [APPROVED_REGULATIONS[1], APPROVED_REGULATIONS[0]],
        escalationRecommended: false,
        escalationState: "none",
        suggestedFollowUps: [
          "Apa syarat batasan omzet peredaran bruto untuk wajib membuat TP Doc?",
          "Apakah perlu melakukan benchmarking studi baru setiap tahun?",
        ],
      },
    ],
  },
  {
    id: "case-003",
    caseReference: "MER-2026-7840",
    clientName: "Herman Gunawan",
    companyName: "PT Surya Mega Investama",
    email: "herman.g@suryamega.co.id",
    title: "Cross-Border Acquisition Tax Due Diligence & Form DGT Structuring",
    practiceArea: "Cross-Border & Transaction Tax",
    primaryJurisdiction: "Indonesia / Netherlands",
    status: "consultant_working",
    riskLevel: "high",
    receivedAt: "2026-08-28T09:00:00Z",
    updatedAt: "2026-08-29T16:00:00Z",
    intakeSummary:
      "Acquisition of 60% shares in Indonesian manufacturing entity by Dutch holding company. Needs tax due diligence on target company liabilities and permanent establishment (BUT) risk structuring.",
    conversationState: "expert_joined",
    assignedConsultant: {
      name: "Dra. Maya Anggraini, Ak., M.Ak.",
      title: "Partner - Transaction Tax & M&A",
    },
    handoffBrief: {
      caseId: "case-003",
      summary:
        "M&A Due Diligence and P3B Indonesia-Netherlands withholding tax structuring for share transfer and dividend streams.",
      clientIntent:
        "Engage Meridian for comprehensive Buy-Side Tax Due Diligence and treaty qualification review.",
      aiConclusion:
        "Transaction complexity involving cross-border holding structures and substantial acquisition value triggered partner intake.",
      escalationTrigger: "M&A deal value > USD 5M, Dutch treaty application.",
      missingFacts: [
        {
          key: "target_financials",
          label: "3-Year Audited Financial Statements",
          status: "provided",
          value: "Uploaded to secure room",
        },
      ],
      riskFlags: [
        {
          id: "rf-04",
          title: "Principal Purpose Test (PPT) under MLI / P3B",
          description:
            "Substance requirements in Dutch holding must satisfy beneficial ownership and anti-treaty shopping rules.",
          severity: "high",
          statuteRef: "PER-25/PJ/2018 & MLI",
        },
      ],
      matchedRegulations: [
        APPROVED_REGULATIONS[5],
        APPROVED_REGULATIONS[4],
      ],
    },
    messages: [
      {
        id: "msg-301",
        sender: "client",
        body: "Kami berencana mengakuisisi perusahaan manufaktur di Karawang. Bagaimana cara memastikan tidak ada warisan utang pajak tersembunyi dari tahun-tahun sebelumnya?",
        timestamp: "2026-08-28T09:00:00Z",
      },
      {
        id: "msg-302",
        sender: "ai",
        body: "Untuk transaksi merger & akuisisi, **Tax Due Diligence (TDD)** merupakan instrumen utama untuk mengidentifikasi eksposur fiskal historis yang belum kedaluwarsa (daluwarsa penetapan pajak 5 tahun sesuai UU KUP).\n\nFokus investigasi TDD mencakup:\n- Kepatuhan pemotongan PPh Pasal 21/23/26 dan PPN masukan-keluaran.\n- Kewajaran transaksi afiliasi dan kesiapan TP Documentation.\n- Riwayat SKP, STP, atau pemeriksaan pajak yang sedang berjalan.\n- Rekonsiliasi peredaran usaha vs faktur pajak.",
        timestamp: "2026-08-28T09:01:10Z",
        citations: [APPROVED_REGULATIONS[2]],
        escalationRecommended: true,
        escalationState: "requested",
      },
      {
        id: "msg-303",
        sender: "consultant",
        authorName: "Dra. Maya Anggraini, Ak., M.Ak.",
        authorTitle: "Partner - Transaction Tax & M&A",
        body: "Selamat pagi Bapak Herman. Tim Transaction Tax kami siap memulai proses Pre-Acquisition Tax Health Check. Kami telah mengirimkan proposal ruang lingkup kerja dan daftar permintaan dokumen (Information Request List) ke email Bapak.",
        timestamp: "2026-08-29T16:00:00Z",
      },
    ],
  },
  {
    id: "case-004",
    caseReference: "MER-2026-6102",
    clientName: "David Lie",
    companyName: "PT Artha Ventura Digital",
    email: "david@arthaventura.id",
    title: "Domestic Dividend Exemption Requirements under UU HPP",
    practiceArea: "Corporate Tax Advisory & Compliance",
    primaryJurisdiction: "Indonesia",
    status: "resolved",
    riskLevel: "low",
    receivedAt: "2026-08-27T11:00:00Z",
    updatedAt: "2026-08-27T15:30:00Z",
    intakeSummary:
      "Clarification regarding dividend received by corporate shareholder from domestic subsidiary without withholding tax (PPh 23) under UU Cipta Kerja and UU HPP.",
    conversationState: "resolved",
    assignedConsultant: {
      name: "Siti Rahmawati, S.E., BAP",
      title: "Senior Tax Consultant",
    },
    handoffBrief: {
      caseId: "case-004",
      summary:
        "Query regarding non-taxable domestic intercompany dividend treatment under PMK 18/2021 and UU HPP.",
      clientIntent:
        "Confirm whether 25% shareholding ownership threshold is still required for corporate dividend tax exemption.",
      aiConclusion:
        "Under PMK 18/2021, all domestic intercompany dividends received by Indonesian corporate taxpayers are exempt from PPh without minimum ownership percentage requirements.",
      escalationTrigger: "Routine compliance inquiry.",
      missingFacts: [],
      riskFlags: [],
      matchedRegulations: [
        APPROVED_REGULATIONS[6],
        APPROVED_REGULATIONS[2],
      ],
    },
    messages: [
      {
        id: "msg-401",
        sender: "client",
        body: "Apakah dividen yang kami terima dari anak perusahaan lokal (kepemilikan 15%) masih dipotong PPh Pasal 23?",
        timestamp: "2026-08-27T11:00:00Z",
      },
      {
        id: "msg-402",
        sender: "ai",
        body: "Berdasarkan [PMK 18/2021 · Pasal 28] dan klaster PPh [UU 7/2021 (HPP) · Pasal 31A], dividen yang berasal dari dalam negeri yang diterima oleh Wajib Pajak Badan dalam negeri **dikecualikan dari objek Pajak Penghasilan (non-objek PPh)** dan **tidak dipotong PPh Pasal 23**.\n\nKetentuan lama yang mensyaratkan kepemilikan saham minimal 25% sudah **dihapus**. Saat ini seluruh dividen antar-badan dalam negeri bebas pajak tanpa syarat kepemilikan minimum dan tanpa syarat investasi kembali.",
        timestamp: "2026-08-27T11:01:00Z",
        citations: [APPROVED_REGULATIONS[6], APPROVED_REGULATIONS[2]],
        escalationRecommended: false,
        escalationState: "none",
      },
      {
        id: "msg-403",
        sender: "consultant",
        authorName: "Siti Rahmawati, S.E., BAP",
        authorTitle: "Senior Tax Consultant",
        body: "Penjelasan AI di atas telah kami verifikasi sesuai regulasi yang berlaku. Cukup pastikan dividen dilaporkan pada bagian Penghasilan Tidak Termasuk Objek Pajak pada Lampiran SPT Tahunan PPh Badan. Konsultasi ini ditutup dengan status Terselesaikan.",
        timestamp: "2026-08-27T15:30:00Z",
      },
    ],
  },
];
