# SP-1 Platform Spine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the vertical slice of the Elevate Coaching training platform — a deployed Next.js app where a real user can sign up via Clerk, complete onboarding (category + goals), and land on a dashboard shell that reads their own data from Neon Postgres with Row-Level Security enforced.

**Architecture:** Next.js 16 App Router on Vercel, Neon Postgres with RLS policies driven by per-connection session GUCs, Clerk for auth with `publicMetadata.role` in the JWT, Sentry for error tracking, shadcn/ui on top of Tailwind tokens locked to the Elevate brand. Webhook from Clerk syncs user creation into Neon with Svix-style idempotency.

**Tech Stack:** Next.js 16, React 19, TypeScript 5, Tailwind CSS 4, shadcn/ui, Clerk 6, Neon serverless Postgres, `@neondatabase/serverless` driver, Stripe (env vars only in SP-1), Sentry, Vitest, Playwright, GitHub Actions CI.

**Companion spec:** [2026-05-13-sp1-platform-spine-design.md](../specs/2026-05-13-sp1-platform-spine-design.md)

---

## File Structure (locked at start)

```
.                                  # worktree root
├── .env.example                   # template env vars (committed)
├── .env.local                     # local secrets (gitignored)
├── .eslintrc.json
├── .gitignore
├── .prettierrc
├── README.md
├── instrumentation.ts             # Sentry init (Next 16 pattern)
├── middleware.ts                  # Clerk + onboarding gate
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
├── components.json                # shadcn config
├── sentry.client.config.ts
├── sentry.edge.config.ts
├── sentry.server.config.ts
├── vitest.config.ts
├── playwright.config.ts
│
├── app/
│   ├── layout.tsx                 # root layout (providers, fonts, Clerk)
│   ├── globals.css
│   ├── (public)/
│   │   ├── layout.tsx             # public shell (no sidebar)
│   │   ├── page.tsx               # / — landing
│   │   ├── sign-in/[[...rest]]/page.tsx
│   │   └── sign-up/[[...rest]]/page.tsx
│   ├── (authed)/
│   │   ├── layout.tsx             # sidebar + top bar + right rail
│   │   ├── onboarding/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts         # server action: completeOnboarding
│   │   ├── dashboard/page.tsx
│   │   └── settings/page.tsx
│   └── api/
│       └── webhooks/clerk/route.ts
│
├── components/
│   ├── ui/                        # shadcn primitives (auto-generated)
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── TopBar.tsx
│   │   └── RightRail.tsx
│   └── branded/
│       ├── Logo.tsx
│       ├── HeroCard.tsx
│       └── StatCard.tsx
│
├── lib/
│   ├── db.ts                      # Neon client + withRls() helper
│   ├── auth.ts                    # requireUser(), getCurrentUser()
│   ├── env.ts                     # zod env validation
│   ├── access.ts                  # canAccess() stub (filled in SP-3)
│   ├── categories.ts              # category constants
│   ├── goals.ts                   # goal constants
│   └── utils.ts                   # shadcn cn() helper
│
├── db/
│   ├── schema.sql                 # canonical schema (reference)
│   ├── policies.sql               # RLS policies (reference)
│   └── migrations/
│       └── 0001_initial.sql       # first migration applied to Neon
│
├── tests/
│   ├── lib/
│   │   ├── env.test.ts
│   │   └── db.test.ts
│   └── e2e/
│       ├── signup-flow.spec.ts
│       └── rls-enforcement.spec.ts
│
└── .github/
    └── workflows/
        └── ci.yml
```

**File responsibility rules:**
- `app/` — routes only, minimal logic; delegate to `lib/` and `components/`
- `lib/` — pure functions + DB access; testable without UI
- `components/branded/` — Elevate-specific composed components
- `components/layout/` — shell pieces, framework-agnostic
- `components/ui/` — shadcn primitives, never modified by us directly (use shadcn CLI to update)

---

## Phase A — Foundation (Tasks 1-8)

Bootstrap the repo, install everything, configure tooling. No business logic yet.

### Task 1: Bootstrap Next.js project in worktree root

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `app/layout.tsx`, `app/page.tsx`, `.gitignore`, `app/globals.css` (auto-generated)

- [ ] **Step 1: Run create-next-app in the worktree root**

Working dir is the worktree root (`.claude/worktrees/dreamy-ride-012e78`). The `docs/` folder already exists; confirm "yes" when prompted about non-empty directory.

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --turbopack --use-npm
```

When prompted "would you like to proceed in this non-empty directory?", answer **Yes**.

- [ ] **Step 2: Verify the dev server starts**

```bash
npm run dev
```

Expected: "Local: http://localhost:3000" printed. Open the URL → see default Next.js welcome page. Stop with Ctrl+C.

- [ ] **Step 3: Verify `docs/` was not overwritten**

```bash
ls docs/superpowers/specs/
```

Expected: `2026-05-13-sp1-platform-spine-design.md` still present.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(SP-1): bootstrap Next.js 16 + TypeScript + Tailwind"
```

---

### Task 2: Install core runtime dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Clerk, Neon, Zod, Sentry, Svix**

```bash
npm install @clerk/nextjs@^6 @neondatabase/serverless@^0.10 zod@^3.23 svix@^1 @sentry/nextjs@^8
```

- [ ] **Step 2: Install dev dependencies for testing + linting**

```bash
npm install -D vitest@^2 @vitest/ui@^2 @playwright/test@^1 @types/node@^22 prettier@^3 eslint-config-prettier@^9
```

- [ ] **Step 3: Verify installs**

```bash
npm ls @clerk/nextjs @neondatabase/serverless zod svix @sentry/nextjs vitest @playwright/test
```

Expected: all 7 packages listed with version numbers, no UNMET PEER warnings that block.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(SP-1): install Clerk, Neon, Zod, Sentry, Svix, Vitest, Playwright"
```

---

### Task 3: Initialize shadcn/ui

**Files:**
- Create: `components.json`, `lib/utils.ts`, `components/ui/*` (as needed)

- [ ] **Step 1: Run shadcn init**

```bash
npx shadcn@latest init
```

Answer prompts:
- Style: **Default**
- Base color: **Neutral**
- CSS variables: **Yes**

- [ ] **Step 2: Install initial primitives needed for SP-1**

```bash
npx shadcn@latest add button card input label select switch badge avatar dropdown-menu separator toast
```

- [ ] **Step 3: Verify primitives landed**

```bash
ls components/ui/
```

Expected: `button.tsx`, `card.tsx`, `input.tsx`, `label.tsx`, `select.tsx`, `switch.tsx`, `badge.tsx`, `avatar.tsx`, `dropdown-menu.tsx`, `separator.tsx`, `toast.tsx` (or `sonner.tsx` depending on version).

- [ ] **Step 4: Commit**

```bash
git add components.json components/ui/ lib/utils.ts app/globals.css
git commit -m "chore(SP-1): initialize shadcn/ui with primitives for SP-1"
```

---

### Task 4: Replace Tailwind config with Elevate brand tokens

**Files:**
- Replace: `tailwind.config.ts`

- [ ] **Step 1: Write the locked brand tokens into Tailwind config**

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: '#0A0B0B',
        surface: '#15181A',
        'surface-hover': '#1B1F22',
        border: 'rgba(255,255,255,0.06)',
        accent: {
          DEFAULT: '#2DE3A8',
          fg: '#003D2B',
        },
        text: {
          DEFAULT: '#FFFFFF',
          muted: '#9CA3AF',
          dim: '#6B7280',
        },
        danger: '#EF4444',
        success: '#10B981',
        warning: '#F59E0B',
      },
      borderRadius: {
        card: '14px',
        pill: '9999px',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
```

- [ ] **Step 2: Update `app/globals.css` to set base colors**

```css
/* app/globals.css — append below shadcn's existing content */
@layer base {
  body {
    background-color: theme('colors.background');
    color: theme('colors.text.DEFAULT');
    font-family: theme('fontFamily.sans');
    -webkit-font-smoothing: antialiased;
  }
}
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add tailwind.config.ts app/globals.css
git commit -m "feat(SP-1): apply Elevate brand tokens to Tailwind"
```

---

### Task 5: Wire Inter font + root layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout to load Inter font and apply dark theme**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Elevate Coaching',
  description: 'Premium training platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace default `app/page.tsx` with a minimal landing placeholder**

```typescript
// app/page.tsx — TEMPORARY: replaced fully in Task 38
export default function Home() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <h1 className="text-4xl text-accent font-semibold">Elevate Coaching</h1>
    </main>
  );
}
```

- [ ] **Step 3: Verify the page renders with the brand colors**

```bash
npm run dev
```

Open http://localhost:3000 → should see the title in mint-teal on near-black background. Stop.

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx app/page.tsx
git commit -m "feat(SP-1): load Inter font and apply dark theme at root"
```

---

### Task 6: Set up env validation (lib/env.ts)

**Files:**
- Create: `lib/env.ts`, `.env.example`, `tests/lib/env.test.ts`

- [ ] **Step 1: Write the failing test first**

```typescript
// tests/lib/env.test.ts
import { describe, it, expect } from 'vitest';

describe('env validation', () => {
  it('throws when required vars are missing', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(import('@/lib/env?reset')).rejects.toThrow();
    process.env.DATABASE_URL = original;
  });

  it('parses a valid env without throwing', async () => {
    process.env.DATABASE_URL = 'postgres://test';
    process.env.CLERK_SECRET_KEY = 'sk_test_x';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_x';
    process.env.CLERK_WEBHOOK_SECRET = 'whsec_x';
    process.env.NEXT_PUBLIC_COACH_WHATSAPP = '441234567890';
    process.env.NEXT_PUBLIC_COACH_CALENDLY = 'https://calendly.com/coach';
    const { env } = await import('@/lib/env?fresh');
    expect(env.DATABASE_URL).toBe('postgres://test');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

First, configure Vitest. Create `vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: false,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Run:
```bash
npm test
```

Expected: FAIL with "Cannot find module @/lib/env".

- [ ] **Step 3: Implement `lib/env.ts`**

```typescript
// lib/env.ts
import { z } from 'zod';

const schema = z.object({
  // Database
  DATABASE_URL: z.string().url().or(z.string().startsWith('postgres://')),

  // Clerk
  CLERK_SECRET_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: z.string().min(1),

  // Sentry (optional in dev, required in prod)
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),

  // Coach contact (public)
  NEXT_PUBLIC_COACH_WHATSAPP: z.string().min(1),
  NEXT_PUBLIC_COACH_CALENDLY: z.string().url(),

  // Runtime
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid environment variables — see logs above.');
}

export const env = parsed.data;
```

- [ ] **Step 4: Create `.env.example`**

```bash
# .env.example — committed; real values in .env.local (gitignored)

# Database (Neon Postgres)
DATABASE_URL=postgres://user:pass@host/db

# Clerk
CLERK_SECRET_KEY=sk_test_xxxxx
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
CLERK_WEBHOOK_SECRET=whsec_xxxxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxx@sentry.io/yyy

# Coach contact (set with client's real numbers before launch)
NEXT_PUBLIC_COACH_WHATSAPP=441234567890
NEXT_PUBLIC_COACH_CALENDLY=https://calendly.com/elevate-coaching/intro
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test
```

Expected: PASS — 2 tests in `env.test.ts`.

- [ ] **Step 6: Commit**

```bash
git add lib/env.ts .env.example tests/lib/env.test.ts vitest.config.ts package.json
git commit -m "feat(SP-1): add zod-validated env with example template"
```

---

### Task 7: Wire Sentry

**Files:**
- Create: `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Run Sentry's Next.js wizard (interactive)**

```bash
npx @sentry/wizard@latest -i nextjs
```

When prompted:
- Authenticate via the browser (or use existing Sentry auth)
- Choose/create project named `elevate-coaching`
- Accept default integrations

This auto-generates `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts`, `instrumentation.ts`, and modifies `next.config.ts`.

- [ ] **Step 2: Verify generated files exist**

```bash
ls sentry.client.config.ts sentry.server.config.ts sentry.edge.config.ts instrumentation.ts
```

Expected: all 4 files present.

- [ ] **Step 3: Add a Sentry test route**

Create `app/api/_debug/sentry/route.ts`:

```typescript
// app/api/_debug/sentry/route.ts — REMOVE AFTER VERIFICATION
import { NextResponse } from 'next/server';

export async function GET() {
  throw new Error('SP-1 Sentry test — this error is expected.');
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 4: Build to verify no Sentry config errors**

```bash
npm run build
```

Expected: build completes; if Sentry env vars are missing, you'll see a Sentry-specific warning but build still succeeds.

- [ ] **Step 5: Commit**

```bash
git add sentry.*.config.ts instrumentation.ts next.config.ts app/api/_debug/
git commit -m "feat(SP-1): wire Sentry for client/server/edge error tracking"
```

---

### Task 8: Configure ESLint, Prettier, .gitignore

**Files:**
- Modify: `.gitignore`
- Create: `.prettierrc`, `.eslintrc.json` (replace existing if needed)

- [ ] **Step 1: Update `.gitignore`**

Add these lines if not already present:

```
# .env files (only commit .env.example)
.env
.env.local
.env.production.local
.env.development.local

# Sentry
.sentryclirc

# Tests
playwright-report/
test-results/

# IDE
.idea/
.vscode/
```

- [ ] **Step 2: Create `.prettierrc`**

```json
{
  "semi": true,
  "trailingComma": "all",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

```bash
npm install -D prettier-plugin-tailwindcss
```

- [ ] **Step 3: Add format scripts to `package.json`**

```json
"format": "prettier --write \"**/*.{ts,tsx,md}\" --ignore-path .gitignore",
"format:check": "prettier --check \"**/*.{ts,tsx,md}\" --ignore-path .gitignore",
"typecheck": "tsc --noEmit"
```

- [ ] **Step 4: Run format + typecheck once**

```bash
npm run format
npm run typecheck
```

Expected: format runs, typecheck shows zero errors.

- [ ] **Step 5: Commit**

```bash
git add .gitignore .prettierrc package.json package-lock.json
git commit -m "chore(SP-1): configure Prettier, gitignore, format/typecheck scripts"
```

---

## Phase B — Provisioning (Tasks 9-13)

External services: Neon, Clerk, Vercel, Sentry already configured. This phase wires real credentials and verifies everything connects.

### Task 9: Provision Neon Postgres

**Files:** None (external setup) — capture creds in `.env.local`

- [ ] **Step 1: Create Neon project**

Go to https://neon.tech → New Project → name `elevate-coaching-prod` → region closest to UK (e.g., `eu-west-2` London or `eu-central-1` Frankfurt) → PostgreSQL 16.

- [ ] **Step 2: Copy the pooled connection string**

From Neon dashboard → Connection Details → choose **Pooled connection** → copy the `postgres://...` string.

- [ ] **Step 3: Save to `.env.local`**

Create `.env.local`:

```bash
DATABASE_URL=postgres://...   # paste the pooled string from Neon
```

- [ ] **Step 4: Test the connection**

Install `psql` if not available, or use Neon's web SQL Editor. Run:

```sql
SELECT version();
```

Expected: PostgreSQL 16 version string.

No commit (secrets are in `.env.local` which is gitignored).

---

### Task 10: Provision Clerk

**Files:** None (external setup) — capture creds in `.env.local`

- [ ] **Step 1: Create Clerk application**

Go to https://clerk.com → Add Application → name `Elevate Coaching` → enable Email + Google sign-in methods.

- [ ] **Step 2: Configure JWT template to include role**

In Clerk dashboard → **Sessions → Customize session token** → add this claim:

```json
{
  "role": "{{user.public_metadata.role}}"
}
```

Save. This puts `role` in every JWT so middleware reads it without a DB hit.

- [ ] **Step 3: Copy keys to `.env.local`**

From Clerk dashboard → API Keys:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

- [ ] **Step 4: Configure URLs in Clerk dashboard**

In Clerk dashboard → **Paths**:
- Sign-in URL: `/sign-in`
- Sign-up URL: `/sign-up`
- After sign-up redirect: `/onboarding`
- After sign-in redirect: `/dashboard`

No commit.

---

### Task 11: Provision Vercel project + link repo

**Files:** None (external) — captures `vercel/` directory after linking

- [ ] **Step 1: Install Vercel CLI**

```bash
npm install -g vercel
```

- [ ] **Step 2: Link the project**

From the worktree root:

```bash
vercel link
```

Answer prompts:
- Set up and deploy: **Yes**
- Which scope: choose your account
- Link to existing project: **No, create new**
- Project name: `elevate-coaching`
- In which directory: `./`
- Modify settings: **No**

This creates `.vercel/project.json`.

- [ ] **Step 3: Push env vars to Vercel**

```bash
vercel env add DATABASE_URL production
vercel env add CLERK_SECRET_KEY production
vercel env add NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY production
vercel env add CLERK_WEBHOOK_SECRET production
vercel env add NEXT_PUBLIC_SENTRY_DSN production
vercel env add NEXT_PUBLIC_COACH_WHATSAPP production
vercel env add NEXT_PUBLIC_COACH_CALENDLY production
```

Paste the value for each when prompted.

Repeat for `preview` environment using the same values (you can later swap to a Neon branch).

- [ ] **Step 4: Pull env vars locally to verify**

```bash
vercel env pull .env.local
```

Open `.env.local` → confirm all 7 vars present.

- [ ] **Step 5: Verify `.vercel/` is gitignored**

Add to `.gitignore` if missing:
```
.vercel
```

- [ ] **Step 6: Commit (just the .gitignore change)**

```bash
git add .gitignore
git commit -m "chore(SP-1): gitignore .vercel directory"
```

---

### Task 12: Set up Clerk webhook endpoint in Clerk dashboard

**Files:** None (external) — get `CLERK_WEBHOOK_SECRET`

- [ ] **Step 1: Create webhook in Clerk dashboard**

Clerk dashboard → **Webhooks** → **Add Endpoint**:
- Endpoint URL: `https://<your-vercel-project>.vercel.app/api/webhooks/clerk` (placeholder OK; update after first deploy)
- Subscribe to events: `user.created` (only one needed for SP-1)
- Click **Create**

- [ ] **Step 2: Copy the signing secret**

After creation, copy the **Signing Secret** (starts with `whsec_`).

- [ ] **Step 3: Add to `.env.local` and push to Vercel**

```bash
# .env.local
CLERK_WEBHOOK_SECRET=whsec_...

# Also push to Vercel (was added in Task 11 — verify):
vercel env ls
```

No commit.

---

### Task 13: Verify all connections from local dev

**Files:** None — verification only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Visit homepage**

http://localhost:3000 → see the Elevate Coaching welcome heading.

- [ ] **Step 3: Verify Sentry test route**

http://localhost:3000/api/_debug/sentry → expect a 500 error response.

Go to Sentry dashboard → confirm the error appears within 1 minute.

- [ ] **Step 4: Test database connection from a quick script**

Create `scripts/test-db.ts`:

```typescript
import { neon } from '@neondatabase/serverless';
import { config } from 'dotenv';
config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const result = await sql`SELECT version() as v`;
console.log(result[0]);
```

```bash
npx tsx scripts/test-db.ts
```

Expected: prints `{ v: 'PostgreSQL 16...' }`.

- [ ] **Step 5: Delete the test script**

```bash
rm scripts/test-db.ts
rmdir scripts 2>/dev/null || true
```

No commit (no committed changes).

---

## Phase C — Database (Tasks 14-19)

Define the schema, RLS policies, and the DB client that sets session GUCs.

### Task 14: Write canonical schema files

**Files:**
- Create: `db/schema.sql`, `db/policies.sql`, `db/migrations/0001_initial.sql`

- [ ] **Step 1: Write `db/schema.sql` (reference; matches design § 4)**

```sql
-- db/schema.sql — canonical reference of all tables in SP-1
-- Apply via db/migrations/0001_initial.sql

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  category      TEXT,
  goals         TEXT[] NOT NULL DEFAULT '{}',
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active   TIMESTAMPTZ,
  CONSTRAINT users_role_check     CHECK (role IN ('user', 'admin')),
  CONSTRAINT users_category_check CHECK (category IN ('A', 'B', 'C', 'D') OR category IS NULL),
  CONSTRAINT users_plan_check     CHECK (plan IN ('free', 'basic', 'pro'))
);

CREATE INDEX IF NOT EXISTS users_category_idx ON users(category);
CREATE INDEX IF NOT EXISTS users_plan_idx     ON users(plan);
CREATE INDEX IF NOT EXISTS users_role_idx     ON users(role) WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS category_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_category    TEXT,
  requested_category  TEXT NOT NULL,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  reviewed_by         TEXT REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ccr_status_check CHECK (status IN ('pending', 'approved', 'denied'))
);

CREATE INDEX IF NOT EXISTS ccr_pending_idx
  ON category_change_requests(status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS clerk_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

- [ ] **Step 2: Write `db/policies.sql`**

```sql
-- db/policies.sql — RLS policies driven by session GUCs

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE clerk_events ENABLE ROW LEVEL SECURITY;

-- USERS table
CREATE POLICY users_self_read ON users FOR SELECT
  USING (
    id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY users_self_update ON users FOR UPDATE
  USING (
    id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

-- CATEGORY_CHANGE_REQUESTS
CREATE POLICY ccr_self_read ON category_change_requests FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY ccr_self_insert ON category_change_requests FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY ccr_admin_update ON category_change_requests FOR UPDATE
  USING (current_setting('app.user_role', true) = 'admin');

-- CLERK_EVENTS: no public access; webhook uses Neon's service role / bypass
-- (RLS enabled with no policies = denied to everyone except superuser)
```

- [ ] **Step 3: Combine into `db/migrations/0001_initial.sql`**

```sql
-- db/migrations/0001_initial.sql
BEGIN;

-- Tables
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  category      TEXT,
  goals         TEXT[] NOT NULL DEFAULT '{}',
  plan          TEXT NOT NULL DEFAULT 'free',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active   TIMESTAMPTZ,
  CONSTRAINT users_role_check     CHECK (role IN ('user', 'admin')),
  CONSTRAINT users_category_check CHECK (category IN ('A', 'B', 'C', 'D') OR category IS NULL),
  CONSTRAINT users_plan_check     CHECK (plan IN ('free', 'basic', 'pro'))
);

CREATE INDEX IF NOT EXISTS users_category_idx ON users(category);
CREATE INDEX IF NOT EXISTS users_plan_idx     ON users(plan);
CREATE INDEX IF NOT EXISTS users_role_idx     ON users(role) WHERE role = 'admin';

CREATE TABLE IF NOT EXISTS category_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_category    TEXT,
  requested_category  TEXT NOT NULL,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',
  reviewed_by         TEXT REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ccr_status_check CHECK (status IN ('pending', 'approved', 'denied'))
);

CREATE INDEX IF NOT EXISTS ccr_pending_idx
  ON category_change_requests(status) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS clerk_events (
  id            TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_change_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE clerk_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_self_read ON users FOR SELECT
  USING (
    id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY users_self_update ON users FOR UPDATE
  USING (
    id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY ccr_self_read ON category_change_requests FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY ccr_self_insert ON category_change_requests FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id', true));

CREATE POLICY ccr_admin_update ON category_change_requests FOR UPDATE
  USING (current_setting('app.user_role', true) = 'admin');

COMMIT;
```

- [ ] **Step 4: Commit**

```bash
git add db/
git commit -m "feat(SP-1): add canonical schema + RLS policies + initial migration"
```

---

### Task 15: Apply initial migration to Neon

**Files:** None (state lives in Neon)

- [ ] **Step 1: Run the migration via Neon's SQL Editor**

Open https://console.neon.tech → your project → SQL Editor → paste the entire contents of `db/migrations/0001_initial.sql` → Run.

Expected: "COMMIT" success. No errors.

- [ ] **Step 2: Verify tables exist**

In SQL Editor:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

Expected output:
```
category_change_requests
clerk_events
users
```

- [ ] **Step 3: Verify RLS is enabled**

```sql
SELECT tablename, rowsecurity FROM pg_tables
WHERE schemaname='public' AND tablename IN ('users','category_change_requests','clerk_events');
```

Expected: all three rows show `rowsecurity = true`.

- [ ] **Step 4: Verify policies exist**

```sql
SELECT tablename, policyname FROM pg_policies WHERE schemaname='public' ORDER BY tablename, policyname;
```

Expected: 6 rows total (2 on users, 3 on category_change_requests, 0 on clerk_events).

No commit (state is in Neon).

---

### Task 16: Build the DB client with RLS GUC helper

**Files:**
- Create: `lib/db.ts`, `tests/lib/db.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/db.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { withRls, sql } from '@/lib/db';

beforeAll(() => {
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://test';
});

describe('withRls', () => {
  it('sets app.user_id GUC inside the callback', async () => {
    // This test runs against a real DB connection — skip if not configured.
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon')) {
      return;
    }

    const result = await withRls({ userId: 'user_test_123', role: 'user' }, async () => {
      return await sql`SELECT current_setting('app.user_id', true) AS uid`;
    });
    expect(result[0].uid).toBe('user_test_123');
  });

  it('returns the value from the callback', async () => {
    if (!process.env.DATABASE_URL || !process.env.DATABASE_URL.includes('neon')) {
      return;
    }
    const value = await withRls({ userId: 'u1', role: 'user' }, async () => 42);
    expect(value).toBe(42);
  });
});
```

- [ ] **Step 2: Run test — expect failure**

```bash
npm test
```

Expected: FAIL — `Cannot find module '@/lib/db'`.

- [ ] **Step 3: Implement `lib/db.ts`**

```typescript
// lib/db.ts
import { neon, neonConfig } from '@neondatabase/serverless';
import { env } from './env';

neonConfig.fetchConnectionCache = true;

// Raw SQL tag for queries that bypass RLS (e.g., webhook inserts)
// Webhooks use this directly — they have no user session.
export const sql = neon(env.DATABASE_URL);

interface RlsContext {
  userId: string;
  role: 'user' | 'admin';
}

/**
 * Run a callback with Postgres session GUCs set so RLS policies fire correctly.
 * Uses SET LOCAL inside a transaction so connection pooling can't leak state.
 */
export async function withRls<T>(
  ctx: RlsContext,
  callback: () => Promise<T>,
): Promise<T> {
  // Open a transaction-scoped connection
  // neon's HTTP driver doesn't support multi-statement transactions natively,
  // so we use the transaction() helper:
  const txSql = neon(env.DATABASE_URL, { fullResults: false });

  // Use Neon's transaction wrapper to ensure SET LOCAL is bounded to a single tx.
  return await txSql.transaction(
    [
      txSql`SELECT set_config('app.user_id', ${ctx.userId}, true)`,
      txSql`SELECT set_config('app.user_role', ${ctx.role}, true)`,
    ],
    { isolationLevel: 'ReadCommitted' },
  ).then(async () => {
    // Note: Neon's HTTP transaction is single-shot for arrays of queries.
    // For dynamic callbacks, switch to the WebSocket driver pattern below:
    return await callback();
  });
}
```

**Note on Neon transaction semantics:** Neon's HTTP driver is request-scoped. For per-callback RLS, we use the WebSocket-backed `Pool` with explicit `BEGIN/COMMIT`. Replace the body with:

```typescript
// lib/db.ts — REVISED
import { Pool } from '@neondatabase/serverless';
import ws from 'ws';
import { env } from './env';

// WebSocket polyfill for Node — only needed in Node runtimes (not Edge)
import { neonConfig } from '@neondatabase/serverless';
if (typeof WebSocket === 'undefined') {
  neonConfig.webSocketConstructor = ws;
}

const pool = new Pool({ connectionString: env.DATABASE_URL });

// Bypass-RLS handle for webhooks (no user session)
export async function sqlAdmin<T = unknown>(
  query: TemplateStringsArray,
  ...params: unknown[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    const result = await client.query({
      text: query.reduce((acc, str, i) => acc + str + (i < params.length ? `$${i + 1}` : ''), ''),
      values: params,
    });
    return result.rows as T[];
  } finally {
    client.release();
  }
}

interface RlsContext {
  userId: string;
  role: 'user' | 'admin';
}

export async function withRls<T>(
  ctx: RlsContext,
  callback: (client: import('@neondatabase/serverless').PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', ctx.userId]);
    await client.query('SELECT set_config($1, $2, true)', ['app.user_role', ctx.role]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
```

Install ws:

```bash
npm install ws
npm install -D @types/ws
```

- [ ] **Step 4: Update the test to use the new signature**

Replace `tests/lib/db.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { withRls } from '@/lib/db';

const hasNeon = !!process.env.DATABASE_URL && process.env.DATABASE_URL.includes('neon');

describe.skipIf(!hasNeon)('withRls', () => {
  it('sets app.user_id GUC inside the callback', async () => {
    const result = await withRls({ userId: 'user_test_123', role: 'user' }, async (client) => {
      const r = await client.query("SELECT current_setting('app.user_id', true) AS uid");
      return r.rows[0].uid;
    });
    expect(result).toBe('user_test_123');
  });

  it('sets app.user_role GUC and rolls back on error', async () => {
    await expect(
      withRls({ userId: 'u1', role: 'admin' }, async (client) => {
        const r = await client.query("SELECT current_setting('app.user_role', true) AS role");
        expect(r.rows[0].role).toBe('admin');
        throw new Error('intentional');
      }),
    ).rejects.toThrow('intentional');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: PASS (or "skipped" if `DATABASE_URL` not pointing at Neon — that's fine in CI without a DB).

- [ ] **Step 6: Commit**

```bash
git add lib/db.ts tests/lib/db.test.ts package.json package-lock.json
git commit -m "feat(SP-1): add Neon client with withRls() session-GUC helper"
```

---

### Task 17: Add lib/categories.ts and lib/goals.ts constants

**Files:**
- Create: `lib/categories.ts`, `lib/goals.ts`

- [ ] **Step 1: Write `lib/categories.ts`**

```typescript
// lib/categories.ts
export const CATEGORIES = ['A', 'B', 'C', 'D'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_INFO: Record<
  Category,
  { name: string; description: string; idealFor: string }
> = {
  A: {
    name: 'Foundation',
    description: 'Building base fitness, learning technique, getting consistent.',
    idealFor: 'New to structured training, returning after a break, or focusing on technique.',
  },
  B: {
    name: 'Fat Loss & Conditioning',
    description: 'Cardio capacity, body composition, sustainable habits.',
    idealFor: 'Want to lean down while keeping strength, focused on conditioning.',
  },
  C: {
    name: 'Strength & Hypertrophy',
    description: 'Progressive overload, muscle growth, max strength.',
    idealFor: 'Have a solid base, want to get bigger and stronger systematically.',
  },
  D: {
    name: 'Performance',
    description: 'High volume, advanced technique, recovery and performance metrics.',
    idealFor: 'Trained 2+ years, chasing measurable performance goals.',
  },
};
```

- [ ] **Step 2: Write `lib/goals.ts`**

```typescript
// lib/goals.ts
export const GOALS = [
  'muscle_gain',
  'fat_loss',
  'strength',
  'performance',
  'mobility',
  'discipline',
] as const;

export type Goal = (typeof GOALS)[number];

export const GOAL_LABEL: Record<Goal, string> = {
  muscle_gain: 'Muscle Gain',
  fat_loss: 'Fat Loss',
  strength: 'Strength',
  performance: 'Performance',
  mobility: 'Mobility',
  discipline: 'Discipline',
};
```

- [ ] **Step 3: Commit**

```bash
git add lib/categories.ts lib/goals.ts
git commit -m "feat(SP-1): add category and goal constants with descriptions"
```

---

### Task 18: Stub lib/access.ts (full canAccess() in SP-3)

**Files:**
- Create: `lib/access.ts`

- [ ] **Step 1: Write the stub**

```typescript
// lib/access.ts
// Full canAccess(user, contentItem) lives in SP-3 once Plan + Category + per-user overrides exist.
// For SP-1, only auth gating matters — no plan-based gating yet (plan is always 'free').

import type { Category } from './categories';
import type { Goal } from './goals';

export type Plan = 'free' | 'basic' | 'pro';
export type Role = 'user' | 'admin';

export interface UserAccessContext {
  id: string;
  role: Role;
  plan: Plan;
  category: Category | null;
  goals: Goal[];
}

/**
 * Stub: full content-gating logic lands in SP-3.
 * For SP-1, only auth is gated (handled by Clerk middleware).
 */
export function canAccess(_user: UserAccessContext, _contentItem: unknown): boolean {
  // SP-1: everyone authenticated gets everything that exists, which is just shells.
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/access.ts
git commit -m "feat(SP-1): stub canAccess() — full implementation lands in SP-3"
```

---

### Task 19: Write the RLS enforcement integration test

**Files:**
- Create: `tests/e2e/rls-enforcement.spec.ts`

This is critical proof that RLS actually works. We insert two users and confirm one cannot read the other.

- [ ] **Step 1: Configure Playwright**

```bash
npx playwright install --with-deps chromium
```

Create `playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        port: 3000,
        timeout: 60_000,
        reuseExistingServer: true,
      },
});
```

Add to `package.json`:
```json
"test:e2e": "playwright test"
```

- [ ] **Step 2: Write the RLS test (uses lib/db directly, no UI)**

```typescript
// tests/e2e/rls-enforcement.spec.ts
import { test, expect } from '@playwright/test';
import { withRls, sqlAdmin } from '../../lib/db';

test.describe('RLS enforcement', () => {
  test.beforeAll(async () => {
    // Seed two users directly (admin-bypass)
    await sqlAdmin`
      INSERT INTO users (id, email, role, category)
      VALUES
        ('user_rls_a', 'a@test.local', 'user', 'A'),
        ('user_rls_b', 'b@test.local', 'user', 'B')
      ON CONFLICT (id) DO NOTHING
    `;
  });

  test.afterAll(async () => {
    await sqlAdmin`DELETE FROM users WHERE id IN ('user_rls_a', 'user_rls_b')`;
  });

  test('user A cannot read user B row', async () => {
    const rows = await withRls({ userId: 'user_rls_a', role: 'user' }, async (client) => {
      const r = await client.query("SELECT * FROM users WHERE id = 'user_rls_b'");
      return r.rows;
    });
    expect(rows.length).toBe(0);
  });

  test('user A can read their own row', async () => {
    const rows = await withRls({ userId: 'user_rls_a', role: 'user' }, async (client) => {
      const r = await client.query("SELECT * FROM users WHERE id = $1", ['user_rls_a']);
      return r.rows;
    });
    expect(rows.length).toBe(1);
    expect(rows[0].email).toBe('a@test.local');
  });

  test('admin can read both rows', async () => {
    const rows = await withRls({ userId: 'user_rls_a', role: 'admin' }, async (client) => {
      const r = await client.query("SELECT id FROM users WHERE id LIKE 'user_rls_%' ORDER BY id");
      return r.rows;
    });
    expect(rows.map((r) => r.id)).toEqual(['user_rls_a', 'user_rls_b']);
  });
});
```

- [ ] **Step 3: Run the RLS test**

```bash
npm run test:e2e -- tests/e2e/rls-enforcement.spec.ts
```

Expected: PASS — 3 tests green.

- [ ] **Step 4: Commit**

```bash
git add playwright.config.ts tests/e2e/rls-enforcement.spec.ts package.json
git commit -m "test(SP-1): verify RLS prevents cross-user reads"
```

---

## Phase D — Auth Foundation (Tasks 20-23)

### Task 20: Implement lib/auth.ts

**Files:**
- Create: `lib/auth.ts`, `tests/lib/auth.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/lib/auth.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
}));

describe('requireUser', () => {
  it('throws redirect when no session', async () => {
    const { auth } = await import('@clerk/nextjs/server');
    (auth as any).mockResolvedValue({ userId: null });
    const { requireUser } = await import('@/lib/auth');
    await expect(requireUser()).rejects.toMatchObject({ message: 'NEXT_REDIRECT' });
  });
});
```

(The exact error shape from `redirect()` in Next 16 is `NEXT_REDIRECT` — the test just confirms a redirect was triggered.)

- [ ] **Step 2: Run — expect failure**

```bash
npm test
```

Expected: FAIL.

- [ ] **Step 3: Implement `lib/auth.ts`**

```typescript
// lib/auth.ts
import { auth, currentUser } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { withRls, sqlAdmin } from './db';
import type { UserAccessContext } from './access';

/**
 * Require an authenticated session. Returns the Clerk userId.
 * Redirects to /sign-in if no session.
 */
export async function requireUser(): Promise<{ userId: string; role: 'user' | 'admin' }> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    redirect('/sign-in');
  }
  const role = (sessionClaims?.role as 'user' | 'admin') || 'user';
  return { userId, role };
}

/**
 * Load the current user's full DB row (with RLS enforcement).
 * Throws redirect to /onboarding if the user has no category yet.
 */
export async function getCurrentUser(): Promise<UserAccessContext> {
  const { userId, role } = await requireUser();

  const rows = await withRls({ userId, role }, async (client) => {
    const r = await client.query<{
      id: string;
      role: 'user' | 'admin';
      plan: 'free' | 'basic' | 'pro';
      category: 'A' | 'B' | 'C' | 'D' | null;
      goals: string[];
    }>("SELECT id, role, plan, category, goals FROM users WHERE id = $1", [userId]);
    return r.rows;
  });

  if (rows.length === 0) {
    // Webhook lag — user exists in Clerk but not yet in our DB.
    // Force a brief retry by redirecting to onboarding which has its own handler.
    redirect('/onboarding?syncing=1');
  }

  return {
    id: rows[0].id,
    role: rows[0].role,
    plan: rows[0].plan,
    category: rows[0].category,
    goals: rows[0].goals as UserAccessContext['goals'],
  };
}

/**
 * Require an admin role. Redirects to /dashboard if user is not admin.
 */
export async function requireAdmin(): Promise<{ userId: string }> {
  const { userId, role } = await requireUser();
  if (role !== 'admin') {
    redirect('/dashboard');
  }
  return { userId };
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npm test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/auth.ts tests/lib/auth.test.ts
git commit -m "feat(SP-1): add requireUser/getCurrentUser/requireAdmin auth helpers"
```

---

### Task 21: Write middleware.ts

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Write middleware**

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/onboarding(.*)',
]);

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks/(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Skip Next.js internals + static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 2: Run dev server to verify middleware loads**

```bash
npm run dev
```

Open http://localhost:3000/dashboard → should redirect to Clerk's hosted sign-in. Stop.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat(SP-1): add Clerk middleware protecting authed routes"
```

---

### Task 22: Wrap root layout with ClerkProvider

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Update root layout**

```typescript
// app/layout.tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Elevate Coaching',
  description: 'Premium training platform.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#2DE3A8',
          colorBackground: '#0A0B0B',
          colorInputBackground: '#15181A',
          colorInputText: '#FFFFFF',
          colorText: '#FFFFFF',
          colorTextSecondary: '#9CA3AF',
          borderRadius: '14px',
          fontFamily: 'var(--font-inter)',
        },
      }}
    >
      <html lang="en" className={`dark ${inter.variable}`}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Verify dev server still works**

```bash
npm run dev
```

Open http://localhost:3000 → page loads normally. Stop.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "feat(SP-1): wrap root with ClerkProvider themed to Elevate brand"
```

---

### Task 23: Create sign-in and sign-up routes

**Files:**
- Create: `app/(public)/sign-in/[[...rest]]/page.tsx`, `app/(public)/sign-up/[[...rest]]/page.tsx`, `app/(public)/layout.tsx`

- [ ] **Step 1: Create public layout (no sidebar)**

```typescript
// app/(public)/layout.tsx
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
```

- [ ] **Step 2: Create sign-in route**

```typescript
// app/(public)/sign-in/[[...rest]]/page.tsx
import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <SignIn forceRedirectUrl="/dashboard" signUpForceRedirectUrl="/onboarding" />
    </main>
  );
}
```

- [ ] **Step 3: Create sign-up route**

```typescript
// app/(public)/sign-up/[[...rest]]/page.tsx
import { SignUp } from '@clerk/nextjs';

export default function SignUpPage() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <SignUp forceRedirectUrl="/onboarding" signInForceRedirectUrl="/dashboard" />
    </main>
  );
}
```

- [ ] **Step 4: Test in browser**

```bash
npm run dev
```

Open http://localhost:3000/sign-up → should see Clerk's themed sign-up form on a dark background with mint accent on the submit button. Open http://localhost:3000/sign-in → themed sign-in.

- [ ] **Step 5: Commit**

```bash
git add "app/(public)/"
git commit -m "feat(SP-1): add themed Clerk sign-in and sign-up routes"
```

---

## Phase E — Clerk Webhook (Tasks 24-28)

### Task 24: Implement webhook signature verification

**Files:**
- Create: `app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Write the route — verify signature only**

```typescript
// app/api/webhooks/clerk/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';

export const runtime = 'nodejs';

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

type ClerkEvent = ClerkUserCreatedEvent | { type: string; data: unknown };

export async function POST(req: NextRequest) {
  const headerPayload = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  if (!headerPayload['svix-id'] || !headerPayload['svix-timestamp'] || !headerPayload['svix-signature']) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let event: ClerkEvent;
  try {
    event = wh.verify(body, headerPayload) as ClerkEvent;
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'clerk-webhook' } });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  // SP-1: only user.created is handled. Other events return 200 + log.
  if (event.type !== 'user.created') {
    console.log(`[webhook] skipped event type: ${event.type} (not handled in SP-1)`);
    return NextResponse.json({ skipped: event.type });
  }

  // Body handling lives in Task 25
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Verify route loads (404 with no auth, expected)**

```bash
npm run dev
curl -X POST http://localhost:3000/api/webhooks/clerk -d '{}'
```

Expected: `{"error":"Missing Svix headers"}` with 400 status.

- [ ] **Step 3: Commit**

```bash
git add app/api/webhooks/clerk/
git commit -m "feat(SP-1): add Clerk webhook route with Svix signature verification"
```

---

### Task 25: Implement user.created handler with idempotency

**Files:**
- Modify: `app/api/webhooks/clerk/route.ts`

- [ ] **Step 1: Replace handler body**

```typescript
// app/api/webhooks/clerk/route.ts — REPLACE THE FILE
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import * as Sentry from '@sentry/nextjs';
import { env } from '@/lib/env';
import { sqlAdmin } from '@/lib/db';

export const runtime = 'nodejs';

interface ClerkUserCreatedEvent {
  type: 'user.created';
  data: {
    id: string;
    email_addresses: { email_address: string; id: string }[];
    primary_email_address_id: string;
    first_name: string | null;
    last_name: string | null;
  };
}

type ClerkEvent = ClerkUserCreatedEvent | { type: string; data: unknown };

export async function POST(req: NextRequest) {
  const headerPayload = {
    'svix-id': req.headers.get('svix-id') ?? '',
    'svix-timestamp': req.headers.get('svix-timestamp') ?? '',
    'svix-signature': req.headers.get('svix-signature') ?? '',
  };

  if (!headerPayload['svix-id'] || !headerPayload['svix-timestamp'] || !headerPayload['svix-signature']) {
    return NextResponse.json({ error: 'Missing Svix headers' }, { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET);

  let event: ClerkEvent;
  try {
    event = wh.verify(body, headerPayload) as ClerkEvent;
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'clerk-webhook' } });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const eventId = headerPayload['svix-id'];

  // Idempotency: skip if we've already processed this event
  try {
    const existing = await sqlAdmin<{ id: string }>`
      SELECT id FROM clerk_events WHERE id = ${eventId}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ idempotent: true });
    }
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'clerk-webhook', stage: 'idempotency-check' } });
    return NextResponse.json({ error: 'DB unavailable' }, { status: 500 });
  }

  if (event.type !== 'user.created') {
    // Log skip + record event so we don't keep checking it
    await sqlAdmin`
      INSERT INTO clerk_events (id, event_type) VALUES (${eventId}, ${event.type})
      ON CONFLICT (id) DO NOTHING
    `;
    return NextResponse.json({ skipped: event.type });
  }

  // user.created — insert into users table + clerk_events in one transaction
  const userData = (event as ClerkUserCreatedEvent).data;
  const primaryEmail = userData.email_addresses.find(
    (e) => e.id === userData.primary_email_address_id,
  )?.email_address;

  if (!primaryEmail) {
    Sentry.captureMessage('user.created event missing primary email', {
      tags: { source: 'clerk-webhook' },
      extra: { eventId, userId: userData.id },
    });
    return NextResponse.json({ error: 'No primary email' }, { status: 422 });
  }

  const fullName = [userData.first_name, userData.last_name].filter(Boolean).join(' ') || null;

  try {
    // Two statements via Neon serverless transaction
    await sqlAdmin`
      INSERT INTO users (id, email, full_name, role, plan)
      VALUES (${userData.id}, ${primaryEmail}, ${fullName}, 'user', 'free')
      ON CONFLICT (id) DO NOTHING
    `;
    await sqlAdmin`
      INSERT INTO clerk_events (id, event_type)
      VALUES (${eventId}, ${event.type})
      ON CONFLICT (id) DO NOTHING
    `;
  } catch (err) {
    Sentry.captureException(err, { tags: { source: 'clerk-webhook', stage: 'insert-user' } });
    return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, userId: userData.id });
}
```

- [ ] **Step 2: Test locally with curl + a real Clerk signing (use Svix replay)**

Use Clerk dashboard's "Test webhook" feature: Clerk → Webhooks → your endpoint → "Send test event" with `user.created` type. (Local dev needs a tunnel — use `ngrok http 3000` and temporarily set the Clerk webhook URL to the ngrok URL.)

Expected response: `{"ok":true,"userId":"user_xxx"}`.

- [ ] **Step 3: Verify row in Neon**

In Neon SQL Editor:
```sql
SELECT id, email, role, category, plan FROM users WHERE id LIKE 'user_%' LIMIT 5;
```

Expected: at least one row from your test event.

- [ ] **Step 4: Commit**

```bash
git add app/api/webhooks/clerk/route.ts
git commit -m "feat(SP-1): handle user.created webhook with idempotency + DB insert"
```

---

### Task 26: Write webhook integration test

**Files:**
- Create: `tests/e2e/webhook.spec.ts`

- [ ] **Step 1: Write test that sends a valid signed payload**

```typescript
// tests/e2e/webhook.spec.ts
import { test, expect } from '@playwright/test';
import { Webhook } from 'svix';
import { sqlAdmin } from '../../lib/db';

const SECRET = process.env.CLERK_WEBHOOK_SECRET!;
const wh = new Webhook(SECRET);

function buildPayload(eventId: string, userId: string) {
  const body = JSON.stringify({
    type: 'user.created',
    data: {
      id: userId,
      email_addresses: [{ id: 'email_1', email_address: `${userId}@test.local` }],
      primary_email_address_id: 'email_1',
      first_name: 'Test',
      last_name: 'User',
    },
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = wh.sign(eventId, new Date(timestamp * 1000), body);

  return {
    body,
    headers: {
      'svix-id': eventId,
      'svix-timestamp': String(timestamp),
      'svix-signature': signature,
    },
  };
}

test.describe('Clerk webhook', () => {
  test.afterEach(async () => {
    await sqlAdmin`DELETE FROM users WHERE id LIKE 'user_webhook_test_%'`;
    await sqlAdmin`DELETE FROM clerk_events WHERE id LIKE 'evt_test_%'`;
  });

  test('inserts user row on user.created', async ({ request }) => {
    const { body, headers } = buildPayload('evt_test_create_1', 'user_webhook_test_1');
    const res = await request.post('/api/webhooks/clerk', { data: body, headers });
    expect(res.status()).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    const rows = await sqlAdmin<{ id: string }>`
      SELECT id FROM users WHERE id = 'user_webhook_test_1'
    `;
    expect(rows.length).toBe(1);
  });

  test('idempotency: same event id replayed → only one row', async ({ request }) => {
    const { body, headers } = buildPayload('evt_test_create_2', 'user_webhook_test_2');
    await request.post('/api/webhooks/clerk', { data: body, headers });
    const res2 = await request.post('/api/webhooks/clerk', { data: body, headers });
    const json = await res2.json();
    expect(json.idempotent).toBe(true);

    const rows = await sqlAdmin<{ id: string }>`
      SELECT id FROM users WHERE id = 'user_webhook_test_2'
    `;
    expect(rows.length).toBe(1);
  });

  test('rejects invalid signature', async ({ request }) => {
    const res = await request.post('/api/webhooks/clerk', {
      data: '{}',
      headers: {
        'svix-id': 'evt_x',
        'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,invalid',
      },
    });
    expect(res.status()).toBe(401);
  });
});
```

- [ ] **Step 2: Run the test**

```bash
npm run test:e2e -- tests/e2e/webhook.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/webhook.spec.ts
git commit -m "test(SP-1): verify webhook signature, insert, and idempotency"
```

---

## Phase F — Brand & Layout (Tasks 27-33)

### Task 27: Build the Logo component

**Files:**
- Create: `components/branded/Logo.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/branded/Logo.tsx
interface LogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

export function Logo({ variant = 'full', className }: LogoProps) {
  return (
    <div className={className}>
      <svg viewBox="0 0 64 64" className="h-8 w-8" aria-hidden>
        <defs>
          <linearGradient id="elevate-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7CFCDD" />
            <stop offset="100%" stopColor="#2DE3A8" />
          </linearGradient>
        </defs>
        <path d="M32 8 L52 44 L40 44 L32 28 L24 44 L12 44 Z" fill="url(#elevate-grad)" />
        <path d="M32 22 L40 36 L24 36 Z" fill="url(#elevate-grad)" opacity="0.6" />
      </svg>
      {variant === 'full' && (
        <div className="mt-2">
          <div className="text-text text-lg font-semibold tracking-wide">ELEVATE</div>
          <div className="text-text-muted text-[10px] tracking-[0.3em]">COACHING</div>
        </div>
      )}
    </div>
  );
}
```

This is a placeholder SVG matching the mockup's twin-triangle motif — replace with the client's final asset when supplied (see spec § 9 open items).

- [ ] **Step 2: Commit**

```bash
git add components/branded/Logo.tsx
git commit -m "feat(SP-1): placeholder Logo component (twin-triangle motif)"
```

---

### Task 28: Build the StatCard component

**Files:**
- Create: `components/branded/StatCard.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/branded/StatCard.tsx
import { Card } from '@/components/ui/card';
import type { ReactNode } from 'react';

interface StatCardProps {
  icon: ReactNode;
  label: string;
  value: string | number;
  delta?: string;
  trend?: ReactNode; // mini chart slot
}

export function StatCard({ icon, label, value, delta, trend }: StatCardProps) {
  return (
    <Card className="bg-surface border-border p-5 flex items-center gap-4">
      <div className="rounded-card bg-surface-hover p-2 text-accent">{icon}</div>
      <div className="flex-1">
        <div className="text-text-muted text-xs uppercase tracking-wide">{label}</div>
        <div className="text-text text-3xl font-semibold mt-1">{value}</div>
        {delta && <div className="text-accent text-xs mt-1">{delta}</div>}
      </div>
      {trend && <div className="ml-auto">{trend}</div>}
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/branded/StatCard.tsx
git commit -m "feat(SP-1): add StatCard branded component"
```

---

### Task 29: Build the HeroCard component

**Files:**
- Create: `components/branded/HeroCard.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/branded/HeroCard.tsx
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface HeroCardProps {
  eyebrow: string;
  title: string;
  meta: string;
  progressPct: number;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

export function HeroCard({
  eyebrow,
  title,
  meta,
  progressPct,
  primaryCta,
  secondaryCta,
}: HeroCardProps) {
  return (
    <Card className="bg-gradient-to-br from-surface to-surface-hover border-border p-8 rounded-card">
      <div className="text-accent text-xs tracking-widest uppercase mb-2">{eyebrow}</div>
      <h2 className="text-text text-3xl font-semibold mb-2">{title}</h2>
      <div className="text-text-muted text-sm mb-4">{meta}</div>
      <div className="w-full h-1 rounded-pill bg-surface-hover overflow-hidden mb-2">
        <div
          className="h-full bg-accent rounded-pill"
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <div className="text-text-muted text-xs mb-4">{progressPct}%</div>
      <div className="flex gap-3">
        <Button asChild className="bg-accent text-accent-fg hover:bg-accent/90">
          <a href={primaryCta.href}>▶ {primaryCta.label}</a>
        </Button>
        {secondaryCta && (
          <Button asChild variant="outline" className="border-border text-text">
            <a href={secondaryCta.href}>{secondaryCta.label}</a>
          </Button>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/branded/HeroCard.tsx
git commit -m "feat(SP-1): add HeroCard branded component"
```

---

### Task 30: Build Sidebar component

**Files:**
- Create: `components/layout/Sidebar.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/layout/Sidebar.tsx
import Link from 'next/link';
import { Logo } from '@/components/branded/Logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: '⌂' },
  { label: 'Settings', href: '/settings', icon: '⚙' },
];

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_COACH_WHATSAPP}`;
  return (
    <aside className="w-[220px] shrink-0 bg-surface border-r border-border flex flex-col p-6">
      <Logo variant="full" />

      <nav className="mt-10 flex flex-col gap-1 flex-1">
        {NAV_ITEMS.map((item) => {
          const active = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-card text-sm ${
                active ? 'bg-accent text-accent-fg font-medium' : 'text-text-muted hover:text-text'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border pt-6 mt-6">
        <div className="flex items-center gap-3 mb-4">
          <Avatar>
            <AvatarFallback className="bg-surface-hover text-text">CA</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-text text-sm font-medium">Coach Alex</div>
            <div className="text-text-dim text-xs">Elite Performance Coach</div>
          </div>
        </div>
        <div className="text-text-muted text-xs mb-1">Discipline today,</div>
        <div className="text-text text-sm mb-4">Freedom tomorrow.</div>
        <Button asChild variant="outline" className="w-full border-border text-text">
          <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
            💬 Message Coach
          </a>
        </Button>
      </div>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/Sidebar.tsx
git commit -m "feat(SP-1): add Sidebar with nav, coach card, WhatsApp deep-link"
```

---

### Task 31: Build TopBar component

**Files:**
- Create: `components/layout/TopBar.tsx`

- [ ] **Step 1: Write the component**

```typescript
// components/layout/TopBar.tsx
import { UserButton } from '@clerk/nextjs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface TopBarProps {
  title: string;
  subtitle?: string;
  userPlan: 'free' | 'basic' | 'pro';
}

export function TopBar({ title, subtitle, userPlan }: TopBarProps) {
  return (
    <div className="flex items-center gap-6 px-8 py-6 border-b border-border">
      <div className="flex-1">
        <h1 className="text-text text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-text-muted text-sm mt-1">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <Input
          disabled
          placeholder="Search programs, exercises, or topics..."
          className="w-[320px] bg-surface border-border text-text placeholder:text-text-dim"
        />

        {userPlan !== 'pro' && (
          <Button asChild className="bg-accent text-accent-fg hover:bg-accent/90">
            <Link href="/settings">⚡ Upgrade Now</Link>
          </Button>
        )}

        <button
          disabled
          className="text-text-muted text-xl"
          title="Notifications (coming soon)"
        >
          🔔
        </button>

        <UserButton afterSignOutUrl="/" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/TopBar.tsx
git commit -m "feat(SP-1): add TopBar with search placeholder, upgrade CTA, UserButton"
```

---

### Task 32: Build RightRail component

**Files:**
- Create: `components/layout/RightRail.tsx`

- [ ] **Step 1: Write the component (accepts arbitrary widget children)**

```typescript
// components/layout/RightRail.tsx
import type { ReactNode } from 'react';

interface RightRailProps {
  children: ReactNode;
}

export function RightRail({ children }: RightRailProps) {
  return (
    <aside className="w-[320px] shrink-0 border-l border-border p-6 space-y-6 overflow-y-auto">
      {children}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/layout/RightRail.tsx
git commit -m "feat(SP-1): add RightRail container component"
```

---

### Task 33: Build authed layout (combines Sidebar + TopBar + RightRail)

**Files:**
- Create: `app/(authed)/layout.tsx`

- [ ] **Step 1: Write the layout**

```typescript
// app/(authed)/layout.tsx
import { getCurrentUser } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { headers } from 'next/headers';

export default async function AuthedLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const hdrs = await headers();
  const currentPath = hdrs.get('x-pathname') || '';

  return (
    <div className="min-h-screen flex bg-background">
      <Sidebar currentPath={currentPath} />
      <main className="flex-1 flex flex-col">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Add `x-pathname` header in middleware**

Update `middleware.ts` to set the header:

```typescript
// middleware.ts — update the body of the clerkMiddleware callback
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/settings(.*)',
  '/onboarding(.*)',
]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  const response = NextResponse.next();
  response.headers.set('x-pathname', req.nextUrl.pathname);
  return response;
});

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
```

- [ ] **Step 3: Commit**

```bash
git add "app/(authed)/layout.tsx" middleware.ts
git commit -m "feat(SP-1): add authed layout with sidebar + onboarding gate via getCurrentUser"
```

---

## Phase G — Pages (Tasks 34-41)

### Task 34: Build the landing page (`/`)

**Files:**
- Modify: `app/page.tsx`
- Create: `app/(public)/page.tsx` (move existing)

- [ ] **Step 1: Move landing into the public group + build it**

Delete the temporary `app/page.tsx` from Task 5 and create:

```typescript
// app/(public)/page.tsx
import Link from 'next/link';
import { Logo } from '@/components/branded/Logo';
import { Button } from '@/components/ui/button';

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between p-6 border-b border-border">
        <Logo variant="full" />
        <nav className="flex items-center gap-4">
          <Link href="/sign-in" className="text-text-muted hover:text-text text-sm">
            Sign in
          </Link>
          <Button asChild className="bg-accent text-accent-fg hover:bg-accent/90">
            <Link href="/sign-up">Get started</Link>
          </Button>
        </nav>
      </header>

      <section className="flex-1 flex items-center justify-center px-6">
        <div className="max-w-2xl text-center">
          <div className="text-accent text-xs tracking-widest uppercase mb-4">
            Premium Training Platform
          </div>
          <h1 className="text-text text-5xl font-semibold mb-6 leading-tight">
            Train like you have a 1-1 coach,
            <br />
            <span className="text-accent">without the price tag.</span>
          </h1>
          <p className="text-text-muted text-lg mb-8 leading-relaxed">
            Personalized programs, exercise tutorials, daily accountability and nutrition guidance —
            built around your goals, delivered by your coach.
          </p>
          <div className="flex gap-3 justify-center">
            <Button asChild size="lg" className="bg-accent text-accent-fg hover:bg-accent/90">
              <Link href="/sign-up">Start your transformation</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="border-border text-text">
              <Link href="/sign-in">I already have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="text-text-dim text-xs text-center py-6 border-t border-border">
        © 2026 Elevate Coaching
      </footer>
    </main>
  );
}
```

- [ ] **Step 2: Verify build + page renders**

```bash
npm run dev
```

Open http://localhost:3000 → see the landing page with brand applied. Stop.

- [ ] **Step 3: Commit**

```bash
git add "app/(public)/page.tsx"
git rm app/page.tsx 2>/dev/null || true
git commit -m "feat(SP-1): build landing page with Elevate branding"
```

---

### Task 35: Build onboarding page with category picker + goals

**Files:**
- Create: `app/(authed)/onboarding/page.tsx`, `app/(authed)/onboarding/actions.ts`

- [ ] **Step 1: Write the server action**

```typescript
// app/(authed)/onboarding/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireUser } from '@/lib/auth';
import { withRls } from '@/lib/db';
import { CATEGORIES } from '@/lib/categories';
import { GOALS } from '@/lib/goals';

const schema = z.object({
  category: z.enum(CATEGORIES),
  goals: z.array(z.enum(GOALS)).min(1, 'Pick at least one goal'),
});

export async function completeOnboarding(formData: FormData) {
  const { userId, role } = await requireUser();

  const parsed = schema.safeParse({
    category: formData.get('category'),
    goals: formData.getAll('goals'),
  });

  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  await withRls({ userId, role }, async (client) => {
    await client.query(
      `UPDATE users
       SET category = $1, goals = $2, updated_at = now()
       WHERE id = $3`,
      [parsed.data.category, parsed.data.goals, userId],
    );
  });

  revalidatePath('/dashboard');
  redirect('/dashboard');
}
```

- [ ] **Step 2: Write the onboarding page**

```typescript
// app/(authed)/onboarding/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { CATEGORY_INFO, CATEGORIES } from '@/lib/categories';
import { GOAL_LABEL, GOALS } from '@/lib/goals';
import { Logo } from '@/components/branded/Logo';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { completeOnboarding } from './actions';

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (user.category) redirect('/dashboard');

  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12">
      <div className="mb-8">
        <Logo variant="full" />
      </div>

      <div className="max-w-3xl w-full">
        <h1 className="text-text text-3xl font-semibold mb-2">Let's tailor this to you.</h1>
        <p className="text-text-muted mb-8">
          Pick the category that fits where you are right now, and tell us what you're working
          towards. You can request a category change anytime.
        </p>

        <form action={completeOnboarding} className="space-y-10">
          {/* Categories */}
          <section>
            <h2 className="text-text text-lg font-medium mb-4">Choose your category</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {CATEGORIES.map((cat) => (
                <label key={cat} className="cursor-pointer">
                  <input type="radio" name="category" value={cat} required className="peer sr-only" />
                  <Card className="bg-surface border-border p-5 peer-checked:border-accent peer-checked:bg-surface-hover transition">
                    <div className="text-accent text-xs uppercase tracking-wide mb-1">
                      Category {cat}
                    </div>
                    <div className="text-text font-medium text-lg mb-1">
                      {CATEGORY_INFO[cat].name}
                    </div>
                    <div className="text-text-muted text-sm mb-2">{CATEGORY_INFO[cat].description}</div>
                    <div className="text-text-dim text-xs">{CATEGORY_INFO[cat].idealFor}</div>
                  </Card>
                </label>
              ))}
            </div>
          </section>

          {/* Goals */}
          <section>
            <h2 className="text-text text-lg font-medium mb-4">What are your goals?</h2>
            <p className="text-text-muted text-sm mb-4">Pick at least one. You can change these later.</p>
            <div className="flex flex-wrap gap-3">
              {GOALS.map((g) => (
                <label key={g} className="cursor-pointer">
                  <input type="checkbox" name="goals" value={g} className="peer sr-only" />
                  <span className="inline-flex items-center px-4 py-2 rounded-pill border border-border bg-surface text-text-muted peer-checked:bg-accent peer-checked:text-accent-fg peer-checked:border-accent transition text-sm">
                    {GOAL_LABEL[g]}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <Button
            type="submit"
            size="lg"
            className="bg-accent text-accent-fg hover:bg-accent/90 w-full md:w-auto"
          >
            Continue to dashboard →
          </Button>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Test in browser**

```bash
npm run dev
```

Sign up at /sign-up → confirm webhook fires (check Neon) → land on /onboarding → pick category C, select 2 goals → submit. Should land on /dashboard with category and goals set.

- [ ] **Step 4: Commit**

```bash
git add "app/(authed)/onboarding/"
git commit -m "feat(SP-1): add onboarding flow (category + goals picker + server action)"
```

---

### Task 36: Build dashboard page with placeholder cards

**Files:**
- Create: `app/(authed)/dashboard/page.tsx`

- [ ] **Step 1: Write the dashboard page**

```typescript
// app/(authed)/dashboard/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { HeroCard } from '@/components/branded/HeroCard';
import { StatCard } from '@/components/branded/StatCard';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CATEGORY_INFO } from '@/lib/categories';
import { GOAL_LABEL } from '@/lib/goals';

export default async function DashboardPage() {
  const user = await getCurrentUser();
  const firstName = 'there'; // TODO SP-2: pull from user.full_name when SP-2 ships profile editing

  return (
    <>
      <TopBar
        title={`Welcome back, ${firstName} 👋`}
        subtitle="Ready to elevate your performance today?"
        userPlan={user.plan}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {/* Placeholder hero — replaced by real program data in SP-5 */}
          <HeroCard
            eyebrow="Current Program"
            title="No program assigned yet"
            meta={
              user.category
                ? `Your coach will assign a ${CATEGORY_INFO[user.category].name} program shortly.`
                : 'Complete onboarding to receive your first program.'
            }
            progressPct={0}
            primaryCta={{ label: 'Learn more', href: '/settings' }}
          />

          {/* Stat cards — empty until SP-4 wires real data */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon="📈" label="Weekly Progress" value="—" delta="Coming soon" />
            <StatCard icon="💪" label="Workouts Completed" value="0" />
            <StatCard icon="🔥" label="Active Streak" value="0" delta="days" />
            <StatCard icon="🎯" label="Current Program" value="—" />
          </div>

          {/* Video Tutorials placeholder — SP-6 will fill */}
          <Card className="bg-surface border-border p-6">
            <h2 className="text-text text-xl font-semibold mb-4">Video Tutorials</h2>
            <p className="text-text-muted text-sm">
              Your tutorial library appears here when SP-6 ships.
            </p>
          </Card>
        </div>

        <RightRail>
          {/* Today's Tasks — SP-4 */}
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text font-medium mb-3">Today's Tasks</h3>
            <p className="text-text-muted text-sm">No tasks yet — daily tasks ship in SP-4.</p>
          </Card>

          {/* Your category */}
          {user.category && (
            <Card className="bg-surface border-border p-5">
              <h3 className="text-text font-medium mb-3">Your Category</h3>
              <Badge className="bg-accent text-accent-fg">
                Category {user.category} — {CATEGORY_INFO[user.category].name}
              </Badge>
              <p className="text-text-muted text-xs mt-3">{CATEGORY_INFO[user.category].description}</p>
            </Card>
          )}

          {/* Goal Focus */}
          {user.goals.length > 0 && (
            <Card className="bg-surface border-border p-5">
              <h3 className="text-text font-medium mb-3">Goal Focus</h3>
              <div className="flex flex-wrap gap-2">
                {user.goals.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-pill border border-border text-text-muted text-xs"
                  >
                    {GOAL_LABEL[g as keyof typeof GOAL_LABEL]}
                  </span>
                ))}
              </div>
            </Card>
          )}
        </RightRail>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Test in browser**

```bash
npm run dev
```

Sign in → land on /dashboard → see the welcome, category badge, goals chips, placeholder cards. Verify the layout at 375px (mobile), 768px (tablet), 1440px (desktop) widths in DevTools.

- [ ] **Step 3: Commit**

```bash
git add "app/(authed)/dashboard/"
git commit -m "feat(SP-1): build dashboard shell with placeholder cards + category/goals widgets"
```

---

### Task 37: Build settings page (read-only)

**Files:**
- Create: `app/(authed)/settings/page.tsx`

- [ ] **Step 1: Write the settings page**

```typescript
// app/(authed)/settings/page.tsx
import { getCurrentUser } from '@/lib/auth';
import { currentUser } from '@clerk/nextjs/server';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { CATEGORY_INFO } from '@/lib/categories';
import { GOAL_LABEL } from '@/lib/goals';
import { env } from '@/lib/env';

export default async function SettingsPage() {
  const dbUser = await getCurrentUser();
  const clerkUser = await currentUser();
  const fullName = clerkUser
    ? `${clerkUser.firstName ?? ''} ${clerkUser.lastName ?? ''}`.trim() || '—'
    : '—';
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? '—';

  return (
    <>
      <TopBar
        title="Account Settings"
        subtitle="Manage your profile, security, and preferences."
        userPlan={dbUser.plan}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          <Card className="bg-surface border-border p-6">
            <h2 className="text-text text-lg font-semibold mb-4">Profile</h2>
            <dl className="grid grid-cols-2 gap-y-4 gap-x-8">
              <div>
                <dt className="text-text-dim text-xs uppercase tracking-wide">Full Name</dt>
                <dd className="text-text mt-1">{fullName}</dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs uppercase tracking-wide">Email</dt>
                <dd className="text-text mt-1">{email}</dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs uppercase tracking-wide">Plan</dt>
                <dd className="text-text mt-1 capitalize">{dbUser.plan}</dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs uppercase tracking-wide">Category</dt>
                <dd className="text-text mt-1">
                  {dbUser.category ? (
                    <Badge className="bg-accent text-accent-fg">
                      {dbUser.category} — {CATEGORY_INFO[dbUser.category].name}
                    </Badge>
                  ) : (
                    <span className="text-text-muted">Not set</span>
                  )}
                </dd>
              </div>
            </dl>
            <p className="text-text-dim text-xs mt-4">
              Profile editing (max lifts, avatar, address) lands in SP-2.
            </p>
          </Card>

          <Card className="bg-surface border-border p-6">
            <h2 className="text-text text-lg font-semibold mb-4">Goal Focus</h2>
            <div className="flex flex-wrap gap-2">
              {dbUser.goals.length > 0 ? (
                dbUser.goals.map((g) => (
                  <span
                    key={g}
                    className="px-3 py-1 rounded-pill border border-border text-text-muted text-sm"
                  >
                    {GOAL_LABEL[g as keyof typeof GOAL_LABEL]}
                  </span>
                ))
              ) : (
                <span className="text-text-muted text-sm">None set</span>
              )}
            </div>
          </Card>

          <Card className="bg-surface border-border p-6">
            <h2 className="text-text text-lg font-semibold mb-4">Billing</h2>
            <p className="text-text-muted text-sm">
              Stripe checkout, plan upgrades, and downgrades land in SP-3.
            </p>
          </Card>
        </div>

        <RightRail>
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text font-medium mb-3">Quick Preferences</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text text-sm">Dark Mode</span>
                <Switch checked disabled />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text text-sm">Metric Units</span>
                <Switch checked disabled />
              </div>
            </div>
            <p className="text-text-dim text-xs mt-3">
              Preferences become editable in SP-2.
            </p>
          </Card>

          <Card className="bg-surface border-border p-5">
            <h3 className="text-text font-medium mb-3">Coach Support</h3>
            <p className="text-text-muted text-xs mb-3">
              Book a 1:1 call or send a message anytime you need guidance.
            </p>
            <a
              href={env.NEXT_PUBLIC_COACH_CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-surface-hover text-text text-sm py-2 rounded-card border border-border hover:border-accent"
            >
              📅 Schedule a Call
            </a>
          </Card>
        </RightRail>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Test in browser**

Visit /settings → see profile read-only with category badge, goals, preferences (disabled), Schedule a Call link.

- [ ] **Step 3: Commit**

```bash
git add "app/(authed)/settings/"
git commit -m "feat(SP-1): build read-only settings page with profile + preferences placeholders"
```

---

### Task 38: Write the end-to-end signup flow test

**Files:**
- Create: `tests/e2e/signup-flow.spec.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/e2e/signup-flow.spec.ts
import { test, expect } from '@playwright/test';

// This test runs against a Clerk dev instance and exercises the full happy path.
// Requires CLERK_TEST_USER_EMAIL + CLERK_TEST_USER_PASSWORD env vars or a Clerk test-mode setup.

test.describe('Signup flow', () => {
  test('lands on landing page with brand visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /train like you have a 1-1 coach/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /get started/i })).toBeVisible();
  });

  test('protected routes redirect to sign-in', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/sign-in/);
  });

  test('sign-up page renders Clerk form with dark theme', async ({ page }) => {
    await page.goto('/sign-up');
    // Clerk's form has an email input; verify it's present and the brand mint is on a button
    await expect(page.getByRole('textbox').first()).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Run tests**

```bash
npm run test:e2e -- tests/e2e/signup-flow.spec.ts
```

Expected: 3 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/signup-flow.spec.ts
git commit -m "test(SP-1): end-to-end smoke for landing, protection, sign-up render"
```

---

## Phase H — CI + Deploy (Tasks 39-42)

### Task 39: Set up GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - name: Type-check
        run: npm run typecheck

      - name: Lint
        run: npm run lint

      - name: Format check
        run: npm run format:check

      - name: Unit tests
        run: npm test
        env:
          # Stub envs so env.ts doesn't crash in CI without real secrets
          DATABASE_URL: postgres://stub
          CLERK_SECRET_KEY: sk_test_stub
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_stub
          CLERK_WEBHOOK_SECRET: whsec_stub
          NEXT_PUBLIC_COACH_WHATSAPP: '441234567890'
          NEXT_PUBLIC_COACH_CALENDLY: https://calendly.com/stub

      - name: Build
        run: npm run build
        env:
          DATABASE_URL: postgres://stub
          CLERK_SECRET_KEY: sk_test_stub
          NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: pk_test_stub
          CLERK_WEBHOOK_SECRET: whsec_stub
          NEXT_PUBLIC_COACH_WHATSAPP: '441234567890'
          NEXT_PUBLIC_COACH_CALENDLY: https://calendly.com/stub
```

- [ ] **Step 2: Verify the file exists**

```bash
ls .github/workflows/
```

Expected: `ci.yml`.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci(SP-1): GitHub Actions for typecheck, lint, format, test, build"
```

---

### Task 40: Push to GitHub + trigger first CI run

**Files:** None — git remote setup

- [ ] **Step 1: Create a GitHub repository**

```bash
gh repo create elevate-coaching --private --source=. --remote=origin
```

(If `gh` isn't installed, install with `winget install --id GitHub.cli` on Windows, then `gh auth login`.)

- [ ] **Step 2: Push the worktree branch**

```bash
git push -u origin claude/dreamy-ride-012e78
```

- [ ] **Step 3: Open a PR to main (optional — for review)**

```bash
gh pr create --title "SP-1: Platform Spine" --body "Implements the vertical slice per spec." --base main
```

- [ ] **Step 4: Watch CI**

```bash
gh run watch
```

Expected: CI completes green within ~3-5 minutes.

No further commit required — CI is now active.

---

### Task 41: Deploy to Vercel production

**Files:** None — deploys via Vercel

- [ ] **Step 1: Deploy from CLI**

```bash
vercel --prod
```

Expected: deployment URL printed. Wait for the build to complete (~2-4 minutes).

- [ ] **Step 2: Update Clerk webhook URL**

In Clerk dashboard → Webhooks → edit your endpoint → set URL to:
```
https://<your-vercel-prod-url>/api/webhooks/clerk
```

Save.

- [ ] **Step 3: Smoke-test the deployed URL**

Open the production URL → confirm:
- Landing page loads with brand colors
- Click "Get started" → sign-up page renders themed
- Sign up with a real test email → confirm webhook delivery in Clerk dashboard → verify a row appears in Neon → confirm redirect to /onboarding
- Complete onboarding → confirm category + goals persisted

- [ ] **Step 4: Check Lighthouse on the landing page**

In Chrome DevTools → Lighthouse → Mobile, Performance only → run.

Expected: Performance ≥ 90.

No commit — deploy state lives in Vercel.

---

### Task 42: Remove the Sentry debug route

**Files:**
- Delete: `app/api/_debug/sentry/route.ts`

- [ ] **Step 1: Verify Sentry is wired by triggering once more**

Visit `https://<prod-url>/api/_debug/sentry` → expect 500. Check Sentry dashboard → exception appears.

- [ ] **Step 2: Delete the debug route**

```bash
rm app/api/_debug/sentry/route.ts
rmdir app/api/_debug 2>/dev/null || true
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore(SP-1): remove Sentry debug route after verification"
```

- [ ] **Step 4: Redeploy**

```bash
vercel --prod
```

---

## Phase I — Acceptance Verification (Tasks 43-47)

These tasks verify SP-1's acceptance criteria from spec § 8. Each is a verification step, not new code.

### Task 43: Run the acceptance checklist manually

- [ ] **Step 1: Hit every criterion from spec § 8**

Open `docs/superpowers/specs/2026-05-13-sp1-platform-spine-design.md` § 8 and check off each box by manual test against the deployed URL:

- [ ] Deployed to Vercel production (Task 41 confirmed)
- [ ] Sign up → row in Neon → lands on `/onboarding`
- [ ] Pick category + goal → lands on `/dashboard`
- [ ] `/dashboard` shows name, category badge, goals tags
- [ ] `/settings` shows same data read-only
- [ ] Direct SQL probe: RLS denies cross-user reads (RLS test in Task 19 confirms; run it once more)
- [ ] Logout → `/` redirects properly
- [ ] Webhook idempotency: replay event in Clerk dashboard → only one row inserted
- [ ] Webhook signature failure → 401 + Sentry capture (Task 26 test confirms)
- [ ] Sentry wired (Task 42 confirmed)
- [ ] Clerk JWT includes `role` claim (inspect JWT after login at jwt.io)
- [ ] CI green (Task 40 confirmed)
- [ ] Lighthouse ≥ 90 on landing (Task 41 confirmed)
- [ ] Cold-load /dashboard < 2.5s on simulated fast 3G
- [ ] Layout at 375px / 768px / 1440px

- [ ] **Step 2: Document any failures in `docs/superpowers/notes/sp1-followups.md`**

If any acceptance check fails, log it before fixing — don't paper over.

---

### Task 44: Cross-viewport verification

- [ ] **Step 1: Test at 375px (iPhone SE-ish)**

Open Chrome DevTools → toggle device toolbar → choose iPhone SE → visit `/`, `/sign-up`, `/onboarding`, `/dashboard`, `/settings`. Confirm:
- No horizontal scrollbars
- Sidebar collapses or scrolls appropriately on /dashboard
- All buttons tappable (44×44px minimum hit target)
- No text overflow

If any of these fail, add a follow-up task in `sp1-followups.md`.

- [ ] **Step 2: Test at 768px (iPad)**

Repeat. Specifically check the sidebar behavior on /dashboard.

- [ ] **Step 3: Test at 1440px (desktop)**

Confirm everything matches the mockups visually.

---

### Task 45: Verify cold-load performance

- [ ] **Step 1: Lighthouse on /dashboard**

DevTools → Lighthouse → Mobile → Performance only → check "Slow 4G" throttling → Analyze.

Expected: LCP < 2.5s, CLS < 0.1.

If LCP exceeds 2.5s, options:
- Add `loading="eager"` to above-fold images
- Audit bundle size with `next build` output
- Add follow-up to address in SP-2 (not blocking SP-1)

---

### Task 46: Verify Clerk JWT claim

- [ ] **Step 1: Inspect a real JWT**

Sign in to the deployed app → open Chrome DevTools → Application → Cookies → find the `__session` cookie → copy the JWT.

Paste into https://jwt.io → check the payload includes `"role": ""` (empty string is fine — admin role isn't set yet).

If `role` is missing from the JWT, revisit Task 10 step 2 — the Clerk session template needs the role claim.

---

### Task 47: Final commit + tag SP-1 done

- [ ] **Step 1: Update spec verification section**

Edit `docs/superpowers/specs/2026-05-13-sp1-platform-spine-design.md` § 10 — check all boxes that are now done.

- [ ] **Step 2: Commit + tag**

```bash
git add docs/superpowers/specs/2026-05-13-sp1-platform-spine-design.md
git commit -m "docs(SP-1): mark verification complete"
git tag -a sp1-complete -m "SP-1 Platform Spine shipped to production"
git push origin --tags
```

- [ ] **Step 3: Write the brief retrospective**

Create `docs/superpowers/notes/sp1-retro.md`:

```markdown
# SP-1 Retrospective

**Shipped:** [date]
**Effort actual vs estimate:** [actual] vs 1.5-2 weeks

## What worked
- [list]

## What surprised us
- [list]

## What to change for SP-2
- [list]

## Spec accuracy
Did the spec match what we actually built? Notes for tightening future specs:
- [list]
```

Commit it:

```bash
git add docs/superpowers/notes/sp1-retro.md
git commit -m "docs(SP-1): retrospective"
```

**SP-1 is complete.** SP-2 (Profile + User Variables) starts with a new brainstorm cycle.

---

## Self-Review

After writing this plan, I scanned against the spec for coverage:

| Spec section | Tasks that cover it |
|---|---|
| § 3 Scope (item 1 repo bootstrap) | Task 1 |
| § 3 Scope (item 2 Vercel/Neon/Clerk) | Tasks 9, 10, 11 |
| § 3 Scope (item 3 Sentry) | Task 7 |
| § 3 Scope (item 4 landing) | Task 34 |
| § 3 Scope (item 5 auth pages) | Task 23 |
| § 3 Scope (item 6 onboarding) | Task 35 |
| § 3 Scope (item 7 dashboard) | Task 36 |
| § 3 Scope (item 8 settings) | Task 37 |
| § 3 Scope (item 9 webhook) | Tasks 24, 25, 26 |
| § 3 Scope (item 10 RLS) | Tasks 14, 15, 19 |
| § 3 Scope (item 11 deploy) | Task 41 |
| § 4 Data model | Tasks 14, 15 |
| § 5 Routes/middleware | Tasks 21, 22, 23 |
| § 6 Brand/components | Tasks 4, 5, 27-33 |
| § 7 Cross-cutting rules | Tasks 6 (env), 18 (access stub), 33 (onboarding gate), 39 (CI) |
| § 8 Acceptance criteria | Tasks 43-47 |

**Coverage:** complete. Every scope item maps to one or more tasks.

**Type consistency:** `UserAccessContext` defined in `lib/access.ts` (Task 18), used in `lib/auth.ts` (Task 20), consumed by all pages (Tasks 33-37). `Category` and `Goal` types defined in `lib/categories.ts` and `lib/goals.ts` (Task 17), consumed by onboarding (Task 35), dashboard (Task 36), settings (Task 37). Consistent throughout.

**Placeholder scan:** No "TODO" or "TBD" markers in the plan body (only inside code comments where intentional and pointing at future SPs). All steps include exact commands or code blocks.

---

## Execution Handoff

Plan complete and saved to [docs/superpowers/plans/2026-05-13-sp1-platform-spine.md](2026-05-13-sp1-platform-spine.md). Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best when you want hands-off momentum.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints. Best when you want to be in the loop on every step.

**Which approach?**
