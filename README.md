# Meridian Tax & Legal Advisory

Platform konsultasi perpajakan korporasi dan hukum bisnis Indonesia. Proyek ini memadukan portal publik dwibahasa, asisten AI yang terikat pada pasal perundang-undangan resmi, serta alur kerja *helpdesk* internal untuk konsultan senior.

## Fitur Utama

- **Asisten AI Regulasi**: Menjawab konsultasi pajak dengan sitasi pasal resmi (PMK 172/2023, UU KUP, UU HPP) dan eskalasi otomatis ke konsultan manusia untuk kasus berisiko tinggi.
- **Guardrail Keamanan**: Menangkal injeksi prompt, menolak manipulasi persona, serta memblokir konsultasi skema ilegal.
- **Portal Klien & Staf**: Akses klien berbasis OTP email tanpa kata sandi, serta *workspace* internal bagi konsultan untuk meninjau dan menyelesaikan tiket kasus.
- **Dukungan Dwibahasa**: Antarmuka penuh dalam Bahasa Indonesia dan Bahasa Inggris menggunakan Paraglide JS.

## Tumpukan Teknologi

- **Framework**: Next.js 16 (App Router, Turbopack) dan React 19
- **Bahasa & Tampilan**: TypeScript, Tailwind CSS v4, shadcn/ui
- **Basis Data**: Turso LibSQL / SQLite lokal (`meridian.db`)
- **Penyedia AI**: B.AI (`qwen3.8-flash`) dengan format luaran JSON terstruktur
- **Autentikasi & Email**: Passwordless OTP via Nodemailer
- **Manajer Paket**: npm

## Cara Menjalankan

### 1. Siapkan Lingkungan

Salin file contoh konfigurasi:

```bash
cp .env.example .env.local
```

Atur variabel penting pada `.env.local`:
- `TURSO_DATABASE_URL="file:meridian.db"`
- `INTAKE_TOKEN_PEPPER` dan `AUTH_TOKEN_PEPPER` (kunci acak pengaman)
- `BAI_API_KEY` (kunci API untuk model AI)
- `MERIDIAN_STAFF_EMAILS` (daftar email staf/partner berwenang)

### 2. Pasang Dependensi dan Siapkan Data

```bash
npm install
npm run migrate
npm run ingest:corpus
```

### 3. Jalankan Server Lokal

```bash
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di peramban.

## Perintah Penting

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run dev` | Menjalankan server lokal (otomatis kompilasi bahasa) |
| `npm run build` | Kompilasi bahasa dan build aplikasi produksi |
| `npm run start` | Menjalankan server produksi |
| `npm run migrate` | Menerapkan migrasi skema SQL ke database |
| `npm run ingest:corpus` | Memuat data regulasi resmi ke korpus SQLite |
| `npm run test` | Menjalankan seluruh pengujian otomatis |
| `npm run lint` | Memeriksa format dan standar kode |

