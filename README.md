# Meridian Tax & Legal Advisory

High-assurance Indonesian tax advisory and corporate consulting platform. Meridian integrates a first-line AI guidance assistant with seamless escalation to licensed senior tax partners and legal counsel, backed by an approved regulatory corpus.

---

## Key Features

### 1. Meridian AI Assistant
- **Structured Visual Guidance**: Answers with clear visual hierarchy, bold category headings, numbered procedures, and styled bullet points.
- **Intelligent Retrieval Routing**:
  - `corpus_grounded`: Statutorily binding inquiries (transfer pricing Master/Local File rules, CbCR thresholds, PMK/UU compliance) query the approved SQLite regulatory corpus and strictly validate citations.
  - `flash_advisory`: Conceptual corporate guidance (PT PMA vs local PT, OSS RBA workflows, general tax advisory) dynamically calls the model with structured guidance prompts without querying the statutory corpus.
  - `conversational`: Instant zero-latency responses for greetings, identity, and current date queries.
- **Multi-Layer Guardrails**:
  - **Jailbreak Defense**: Rejects DAN prompts, developer mode bypasses, and persona overrides.
  - **Prompt Injection Defense**: Intercepts instruction overrides (*"ignore all previous instructions"*) and system prompt extraction attempts.
  - **Illegal Activity Defense**: Refuses tax evasion schemes, fraudulent tax invoices (*faktur fiktif*), bribery of tax officials (*suap*), and money laundering with professional legal compliance explanations.

### 2. Regulatory Knowledge Corpus & Safety Contract
- Local full-text search (FTS) and topic-based retrieval over approved Indonesian tax regulations (e.g., PMK 172/2023, UU KUP, UU HPP, UU PPh/PPN).
- Deterministic output validator that verifies quoted passages, detects unsupported numbers, rejects hallucinated legal identifiers, and enforces word count limits.

### 3. Consultation Handoff & Client Portal
- Seamless guest intake with HMAC-peppered opaque tokens.
- One-click client account conversion and case claiming via passwordless email OTP.
- Staff helpdesk portal for senior partners to review AI audit trails, assign cases, and respond to clients.
- Full internationalization support in English (`en`) and Indonesian (`id`) powered by Paraglide JS.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Runtime & UI**: React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Internationalization**: Paraglide JS (`messages/en.json`, `messages/id.json`)
- **Database**: Turso SQLite / libSQL (`@libsql/client`) with custom transaction and migration engine
- **AI Model Provider**: B.AI (`qwen3.8-flash`) with structured JSON schema output
- **Email Delivery**: SumoPod SMTP (`nodemailer`) for transactional verification codes
- **Package Manager**: npm

---

## Getting Started

### 1. Clone & Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the essential variables in `.env.local`:

```env
# Database (Local SQLite or Turso)
TURSO_DATABASE_URL="file:meridian.db"
TURSO_AUTH_TOKEN=""

# HMAC Security Peppers (generate using: openssl rand -base64 48)
INTAKE_TOKEN_PEPPER="replace-with-a-long-random-secret"
AUTH_TOKEN_PEPPER="replace-with-a-different-long-random-secret"

# AI Provider (B.AI / Qwen)
BAI_API_KEY="your-bai-api-key"
BAI_BASE_URL="https://api.b.ai/v1"
BAI_MODEL="qwen3.8-flash"

# Authorized Staff Accounts
MERIDIAN_STAFF_EMAILS="partner@meridiantax.com"
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Database Migration & Corpus Ingestion

Run database migrations to initialize tables:

```bash
npm run migrate
```

Ingest consolidated regulatory instruments into the SQLite knowledge corpus:

```bash
npm run ingest:corpus
```

### 4. Compile Translations

```bash
npm run compile
```

### 5. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Available Scripts

| Command | Description |
| :--- | :--- |
| `npm run dev` | Start development server with automatic i18n compilation |
| `npm run build` | Compile translations and build production application |
| `npm run start` | Start production server |
| `npm run test` | Run complete Node.js test suite across all domain and integration tests |
| `npm run typecheck` | Run TypeScript type checking (`tsc --noEmit`) |
| `npm run lint` | Run ESLint across codebase |
| `npm run compile` | Compile Paraglide translation dictionaries |
| `npm run migrate` | Apply database migrations to the configured SQLite/Turso database |
| `npm run ingest:corpus` | Ingest approved statutory tax regulations into the knowledge corpus |
| `npm run smoke:backend` | Execute end-to-end backend smoke tests against live API routes |

---

## License

Private and proprietary. Copyright © Meridian Tax & Legal Advisory. All rights reserved.
