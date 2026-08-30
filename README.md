# Meridian Tax & Legal Advisory

Platform konsultasi perpajakan korporasi dan hukum bisnis Indonesia berstandar tinggi. Meridian memadukan panduan awal berbasis asisten AI cerdas dengan eskalasi langsung ke konsultan pajak berizin dan tim hukum senior, didukung oleh korpus regulasi resmi yang terverifikasi.

---

## Fitur Utama

### 1. Asisten AI Meridian
- **Panduan Visual Terstruktur**: Memberikan respons dengan hierarki visual yang jelas, judul bagian tebal (*bold headers*), urutan bernomor, dan poin daftar (*bullet points*) berwarna amber yang rapi tanpa penumpukan teks.
- **Penalaran & Perutean Pengambilan Regulasi (*Retrieval Routing*)**:
  - `corpus_grounded`: Untuk pertanyaan yang mengikat secara hukum (ketentuan *Master File* / *Local File* *transfer pricing*, ambang batas CbCR, kepatuhan PMK/UU), sistem mencari ke korpus regulasi SQLite resmi dan memvalidasi sitasi pasal secara ketat.
  - `flash_advisory`: Untuk panduan konseptual bisnis (perbedaan PT PMA vs PT lokal, alur perizinan OSS RBA, layanan konsultasi pajak umum), model langsung dipanggil dengan instruksi terstruktur tanpa membebani korpus pasal regulasi.
  - `conversational`: Respons instan tanpa latensi untuk sapaan (*greeting*), identitas asisten, dan informasi tanggal saat ini.
- **Guardrail Keamanan Berlapis**:
  - **Pertahanan Jailbreak**: Menolak *prompt* DAN (*Do Anything Now*), mode *developer*, dan upaya pengubahan persona model.
  - **Pertahanan Injeksi Prompt**: Menangkal pengabaian instruksi sistem (*"abaikan semua instruksi sebelumnya"*) serta upaya membocorkan *system prompt*.
  - **Pencegahan Aktivitas Ilegal**: Menolak secara tegas skema penggelapan pajak (*tax evasion*), faktur pajak fiktif, penyuapan petugas pajak (*suap*), dan pencucian uang, dilengkapi penjelasan kepatuhan hukum resmi.

### 2. Korpus Pengetahuan Regulasi & Validasi Keamanan
- Pencarian teks lengkap (*Full-Text Search* / FTS) lokal dan pemfilteran topik atas peraturan perundang-undangan perpajakan Indonesia (antara lain PMK 172/2023, UU KUP, UU HPP, UU Cipta Kerja, UU PPh/PPN).
- Validator *output* deterministik yang memeriksa kutipan pasal asli, mendeteksi angka tanpa dasar regulasi, menolak nomor regulasi fiktif, serta membatasi panjang respons.

### 3. Alur Konsultasi & Portal Klien
- Sesi *guest* tanpa registrasi rumit yang diamankan menggunakan token bertanda tangan rahasia (*HMAC pepper*).
- Konversi akun klien satu klik dan klaim percakapan konsultasi melalui kode OTP email tanpa kata sandi.
- Portal *helpdesk* khusus staf dan *partner* senior untuk meninjau jejak audit AI, mengelola penugasan kasus, dan berdialog langsung dengan klien.
- Dukungan dwibahasa penuh (Bahasa Indonesia `id` dan Bahasa Inggris `en`) menggunakan Paraglide JS.

---

## Tumpukan Teknologi (*Tech Stack*)

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime & Tampilan Antarmuka**: React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Internasionalisasi (i18n)**: Paraglide JS (`messages/id.json`, `messages/en.json`)
- **Basis Data**: Turso SQLite / libSQL (`@libsql/client`) dengan mesin migrasi dan transaksi khusus
- **Penyedia Model AI**: B.AI (`qwen3.8-flash`) dengan skema format luaran JSON terstruktur
- **Pengiriman Email**: SumoPod SMTP (`nodemailer`) untuk kode verifikasi transaksi
- **Manajer Paket**: npm

---

## Panduan Memulai

### 1. Salin & Konfigurasi Lingkungan (*Environment*)

Salin berkas `.env.example` ke `.env.local`:

```bash
cp .env.example .env.local
```

Sesuaikan variabel konfigurasi utama pada `.env.local`:

```env
# Basis Data (SQLite Lokal atau Turso)
TURSO_DATABASE_URL="file:meridian.db"
TURSO_AUTH_TOKEN=""

# Kunci Pengaman HMAC (dapat dibuat dengan: openssl rand -base64 48)
INTAKE_TOKEN_PEPPER="ganti-dengan-kunci-acak-panjang"
AUTH_TOKEN_PEPPER="ganti-dengan-kunci-acak-berbeda"

# Penyedia AI (B.AI / Qwen)
BAI_API_KEY="kunci-api-bai-anda"
BAI_BASE_URL="https://api.b.ai/v1"
BAI_MODEL="qwen3.8-flash"

# Akun Email Staf yang Diberi Otorisasi
MERIDIAN_STAFF_EMAILS="partner@meridiantax.com"
```

### 2. Pasang Dependensi

```bash
npm install
```

### 3. Migrasi Basis Data & Ingesti Korpus

Jalankan migrasi basis data untuk membuat skema tabel:

```bash
npm run migrate
```

Lakukan proses ingesti peraturan perpajakan resmi ke dalam korpus basis data SQLite:

```bash
npm run ingest:corpus
```

### 4. Kompilasi Terjemahan Bahasa

```bash
npm run compile
```

### 5. Jalankan Server Pengembangan

```bash
npm run dev
```

Buka peramban di [http://localhost:3000](http://localhost:3000).

---

## Daftar Perintah (*Available Scripts*)

| Perintah | Keterangan |
| :--- | :--- |
| `npm run dev` | Menjalankan server pengembangan dengan auto-kompilasi i18n |
| `npm run build` | Mengompilasi kamus bahasa dan membangun aplikasi produksi |
| `npm run start` | Menjalankan server dalam mode produksi |
| `npm run test` | Menjalankan seluruh pengujian unit & integrasi secara menyeluruh |
| `npm run typecheck` | Memeriksa kepatuhan tipe TypeScript (`tsc --noEmit`) |
| `npm run lint` | Menjalankan audit kode dengan ESLint |
| `npm run compile` | Mengompilasi kamus bahasa Paraglide |
| `npm run migrate` | Menerapkan migrasi tabel ke basis data SQLite/Turso |
| `npm run ingest:corpus` | Memasukkan regulasi perundang-undangan resmi ke korpus pengetahuan |
| `npm run smoke:backend` | Menjalankan uji asap (*smoke test*) menyeluruh terhadap endpoint API |

---

## Lisensi

Bersifat privat dan terbatas (*proprietary*). Hak Cipta © Meridian Tax & Legal Advisory. Dilindungi undang-undang.
