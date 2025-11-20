# Is It Mom or Dad? — Scaffold

This repository contains a scaffold for a small Next.js (App Router) + Supabase project.

Features included in scaffold:

- Next.js 14 App Router (TypeScript)
- TailwindCSS + PostCSS config
- Placeholder routes and API route handlers (stubs)
- `lib/supabase.ts` and `lib/types.ts` placeholders
- `.env.example` with Supabase placeholders

Getting started (local dev):

1. Copy `.env.example` to `.env.local` and fill values.

```bash
cp .env.example .env.local
# edit .env.local and add your Supabase keys
```

2. Install deps and run dev server:

```bash
npm install
npm run dev
```

Notes:
- All API handlers and pages are placeholders/stubs — business logic will be implemented later per your request.
- Supabase helpers are present but not wired into business logic yet.
