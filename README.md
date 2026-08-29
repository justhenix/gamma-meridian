# Meridian (Gamma)

Raw MVP foundation scaffolded with Next.js, TypeScript, Tailwind CSS, shadcn/ui, Paraglide JS (i18n), and Turso SQLite.

## Tech Stack

- **Framework**: Next.js (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 & shadcn/ui
- **Internationalization (i18n)**: Paraglide JS (English `en` & Indonesian `id`)
- **Database Driver**: Turso SQLite (`@libsql/client`)
- **Package Manager**: npm

## Getting Started

### 1. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your Turso credentials:
- `TURSO_DATABASE_URL`
- `TURSO_AUTH_TOKEN`

### 2. Install Dependencies

```bash
npm install
```

### 3. Compile i18n Messages

```bash
npm run compile
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser.

## Available Scripts

- `npm run dev`: Start development server (auto-compiles i18n messages)
- `npm run build`: Build production application
- `npm run start`: Start production server
- `npm run lint`: Run ESLint checks
- `npm run compile`: Compile Paraglide translation dictionaries
