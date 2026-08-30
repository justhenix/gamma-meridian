# Meridian Tax Advisory

Platform konsultasi perpajakan korporasi berbasis AI yang terhubung langsung dengan konsultan senior berlisensi. Sistem ini memadukan asisten cerdas berbasis regulasi resmi Indonesia dengan alur kerja *helpdesk* internal untuk penanganan sengketa dan kepatuhan pajak.

Demo Online: [gamma-meridian.vercel.app](https://gamma-meridian.vercel.app)

---

## Fitur Utama

- **AI Tax Assistant**: Menjawab konsultasi pajak berdasarkan peraturan resmi (PMK 172/2023, UU KUP, UU HPP) lengkap dengan sitasi pasal, serta eskalasi otomatis ke konsultan manusia jika mendeteksi kasus berisiko tinggi.
- **Safety & Guardrails**: Proteksi terhadap *prompt injection*, *jailbreak*, manipulasi persona, serta penolakan otomatis untuk pertanyaan terkait skema pajak ilegal.
- **Client & Staff Portal**: Login *passwordless* menggunakan OTP email untuk klien, serta *dashboard helpdesk* bagi tim konsultan untuk mengklaim dan membalas tiket kasus secara langsung.
- **Bilingual (i18n)**: Dukungan penuh Bahasa Indonesia dan Bahasa Inggris menggunakan Paraglide JS.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack) & React 19
- **Language & Styling**: TypeScript, Tailwind CSS v4, shadcn/ui
- **Database**: Turso LibSQL / SQLite lokal (`meridian.db`)
- **AI Integration**: B.AI (`qwen3.8-flash`) dengan validasi *structured JSON output*
- **Auth & Email**: Passwordless OTP via Nodemailer
- **Package Manager**: npm

## Cara Menjalankan Project

### 1. Setup Environment

Salin file contoh konfigurasi:

```bash
cp .env.example .env.local
```

Sesuaikan variabel di `.env.local`:
- `TURSO_DATABASE_URL="file:meridian.db"`
- `INTAKE_TOKEN_PEPPER` & `AUTH_TOKEN_PEPPER` (kunci acak keamanan sesi)
- `BAI_API_KEY` (API key provider AI)
- `MERIDIAN_STAFF_EMAILS` (daftar email staf/partner yang memiliki akses)

### 2. Install Dependencies & Setup Database

```bash
npm install
npm run migrate
npm run ingest:corpus
```

### 3. Jalankan Dev Server

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

## Script & Perintah

| Command | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan dev server lokal (auto-compile i18n) |
| `npm run build` | Build aplikasi untuk production |
| `npm run start` | Menjalankan production server |
| `npm run migrate` | Menjalankan migrasi skema SQL ke database |
| `npm run ingest:corpus` | Ingest data regulasi perpajakan ke database SQLite |
| `npm run test` | Menjalankan seluruh pengujian otomatis (unit & integration tests) |
| `npm run lint` | Memeriksa format dan standar kode |


