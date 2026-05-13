# SP-1: Platform Spine — Design

**Project:** Elevate Coaching — premium training platform
**Sub-project:** SP-1 of 8 (Platform Spine — the vertical slice)
**Date:** 2026-05-13
**Status:** Approved, ready for implementation plan
**Owner:** Jack
**Effort estimate:** 1.5–2 weeks

---

## 1. Context

Elevate Coaching is a premium training platform for a fitness coach with a target of 400+ active monthly paying users across three subscription tiers (Free, Basic £150/mo, Pro £300/mo). The product makes each user feel personally coached while the actual coach manages content via four user categories (A/B/C/D).

The full project decomposes into **eight sub-projects**, executed sequentially with each one fully shipped + verified before the next begins. This document is the design for **SP-1 only** — the vertical slice that proves the stack works end-to-end before any content module is built.

### The 8-sub-project sequence

```
SP-1 Platform Spine        → THIS DOC
SP-2 Profile + Variables
SP-3 Stripe + Plan Gating
SP-4 Dashboard + Tasks
SP-5 Workout Programs (read)
SP-6 Tutorial Library
SP-7 Admin Panel v1
SP-8 Nutrition + Progress
```

---

## 2. Locked decisions from brainstorm

| #   | Decision                  | Choice                                                                                                                            |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Category assignment model | **Self-pick at signup + request-change** — user picks during onboarding; coach approves change requests                           |
| Q2  | Stack                     | **Next.js 16 App Router on Vercel + Neon Postgres + Clerk + Stripe + Cloudflare Stream + Vercel Blob + shadcn/ui**                |
| Q3  | Video provider            | **Cloudflare Stream** — signed URLs, watermarking, 5× cheaper than Mux at every scale                                             |
| Q4  | Max lifts schema          | **DEFERRED to coach.** Default = Big 4 (Squat / Bench / Deadlift / Overhead Press) + % of 1RM. Blocks SP-2, not SP-1.             |
| Q5  | Free tier scope           | **Limited taste** — dashboard, 3 starter tutorials, Week 1 of intro program, 2 daily tasks/day, no nutrition                      |
| Q6  | Admin model               | **Single coach now**, but use a `role` column (`'user' \| 'admin'`) — adding more roles later is a 1-line migration               |
| Q7  | "Message Coach" button    | **WhatsApp deep-link.** No in-app chat in v1 (brief says phase 2).                                                                |
| Q8  | Goals vs Categories       | **Two separate axes.** Category = admin-assigned, gates access. Goals = user-selected multi-tag, influences recommendations only. |
| Q9  | "Schedule a Call" button  | **Calendly / Cal.com link.** No in-app booking in v1.                                                                             |

---

## 3. Scope

### What SP-1 ships

1. Repo bootstrapped: Next.js 16 + TypeScript + Tailwind + shadcn/ui + ESLint + Prettier + CI
2. Vercel project + Neon Postgres + Clerk app provisioned and linked
3. Sentry installed (error tracking — foundational; later SPs assume it exists)
4. Marketing landing page at `/` with Elevate branding
5. Auth pages `/sign-in` and `/sign-up` (Clerk hosted UI with `appearance` config wired to Elevate Tailwind tokens — dark background, mint-teal accent, matching border radius)
6. Onboarding flow at `/onboarding` — category picker (A/B/C/D with descriptions) + goals multi-select
7. Authenticated dashboard at `/dashboard` — sidebar + top bar + placeholder cards
8. Settings page at `/settings` — read-only profile view, sidebar widgets
9. Clerk webhook at `/api/webhooks/clerk` — handles `user.created` only in SP-1. `user.updated` (email/name sync) and `user.deleted` (account deletion / GDPR) explicitly deferred to SP-2.
10. Postgres RLS — user reads only their own row, admin reads all
11. Deployed to Vercel production

### Explicitly out of scope (lives in later SPs)

- Stripe billing — SP-3 (`plan` column exists but is always `'free'`)
- Profile editing + max lifts — SP-2
- Daily tasks logic + real dashboard metrics — SP-4
- Workout programs — SP-5
- Video tutorials — SP-6
- Admin panel — SP-7
- Nutrition plans — SP-8
- Category change request UI — SP-2 (the table exists in SP-1; the request flow ships later)

---

## 4. Data model

Three tables. Every later table FKs to `users`.

```sql
-- One row per Clerk user; the Clerk user id is the primary key
CREATE TABLE users (
  id            TEXT PRIMARY KEY,                  -- Clerk user_xxx
  email         TEXT NOT NULL,
  full_name     TEXT,
  role          TEXT NOT NULL DEFAULT 'user',      -- 'user' | 'admin'
  category      TEXT,                              -- 'A' | 'B' | 'C' | 'D' | NULL until onboarded
  goals         TEXT[] NOT NULL DEFAULT '{}',      -- e.g. ['muscle_gain', 'strength']
  plan          TEXT NOT NULL DEFAULT 'free',      -- 'free' | 'basic' | 'pro' (Stripe writes in SP-3)
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_active   TIMESTAMPTZ
);

CREATE INDEX users_category_idx ON users(category);
CREATE INDEX users_plan_idx ON users(plan);
CREATE INDEX users_role_idx ON users(role) WHERE role = 'admin';

-- Category-change requests (table now; UI in SP-2)
CREATE TABLE category_change_requests (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  current_category    TEXT,
  requested_category  TEXT NOT NULL,
  reason              TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',   -- 'pending' | 'approved' | 'denied'
  reviewed_by         TEXT REFERENCES users(id),
  reviewed_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX category_change_requests_status_idx ON category_change_requests(status) WHERE status = 'pending';

-- Idempotency log for Clerk webhook events
CREATE TABLE clerk_events (
  id            TEXT PRIMARY KEY,                  -- Svix event id from webhook header
  event_type    TEXT NOT NULL,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

### RLS policies

Row-Level Security reads two Postgres session GUCs that the app sets per-connection from the Clerk JWT:

- `app.user_id` — the authenticated Clerk user id
- `app.user_role` — `'user'` or `'admin'` (cached in Clerk's `publicMetadata.role`, so it lives in the JWT — zero DB lookup to know if someone is admin)

```sql
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

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

-- INSERT is webhook-only; webhook connection uses a service role that bypasses RLS
-- DELETE is admin-only; same pattern

ALTER TABLE category_change_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY ccr_self_read ON category_change_requests FOR SELECT
  USING (
    user_id = current_setting('app.user_id', true)
    OR current_setting('app.user_role', true) = 'admin'
  );

CREATE POLICY ccr_self_insert ON category_change_requests FOR INSERT
  WITH CHECK (user_id = current_setting('app.user_id', true));

-- Only admins can update (approve/deny)
CREATE POLICY ccr_admin_update ON category_change_requests FOR UPDATE
  USING (current_setting('app.user_role', true) = 'admin');

-- clerk_events: service role only, no public access
ALTER TABLE clerk_events ENABLE ROW LEVEL SECURITY;
```

The app uses a wrapper around the Neon client that sets `app.user_id` and `app.user_role` at the start of every authenticated query, then resets them after.

---

## 5. Routes & user flows

```
ROUTE                       AUTH        DESCRIPTION
/                           public      Marketing landing
/sign-in                    public      Clerk-hosted sign-in (themed)
/sign-up                    public      Clerk-hosted sign-up (themed)
/onboarding                 required    Category + goals picker; redirects to /dashboard once category set
/dashboard                  required    Main dashboard shell; redirects to /onboarding if category IS NULL
/settings                   required    Read-only profile view
/api/webhooks/clerk         signature   Clerk webhook handler (verifies Svix signature)
```

### Middleware (`middleware.ts`)

- Clerk middleware enforces auth on `/dashboard`, `/settings`, `/onboarding`
- Public routes: `/`, `/sign-in`, `/sign-up`, `/api/webhooks/clerk`, all `_next/*`

### Onboarding gate

- After Clerk creates a user, the webhook inserts a `users` row with `category = NULL`
- The `/dashboard` route's layout reads `user.category`; if NULL → server-side redirect to `/onboarding`
- `/onboarding` posts category + goals to a server action → updates row → redirects to `/dashboard`

### Sign-up sequence (happy path)

1. User on `/sign-up` (Clerk hosted UI)
2. Clerk creates user → fires `user.created` webhook to our endpoint
3. `/api/webhooks/clerk`:
   - Verifies Svix signature against `CLERK_WEBHOOK_SECRET`
   - Idempotency check: if `clerk_events.id` already exists → return 200 (no-op)
   - Otherwise insert `users` row (`role='user'`, `category=NULL`, `plan='free'`) + insert `clerk_events` row in same transaction
   - Returns 200
4. User redirected to `/onboarding`
5. User picks category + selects ≥1 goal → server action updates `users` row
6. Redirected to `/dashboard`

### Sign-in sequence (returning user)

1. `/sign-in` → Clerk auth → middleware checks session
2. Server reads `users.category`; if NULL → `/onboarding`, else `/dashboard`

### Error paths

- **Clerk webhook fails before user row exists** — user lands on `/onboarding` and sees a "syncing your account" state with a retry. After 5s of polling, if still no row, show "Something went wrong — contact support" and surface a button to manually re-trigger via a fallback API call.
- **RLS denies a query** — server logs the deny + returns a generic 403/404 to the client (never reveal "this row exists but you can't see it")
- **Webhook signature invalid** — return 401, capture exception in Sentry
- **Webhook idempotency hit** — return 200 (Stripe-style)
- **Webhook event types other than `user.created`** — return 200 with a "skipped: not handled in SP-1" log entry; `user.updated` and `user.deleted` ship in SP-2

---

## 6. Brand & component system

### Tailwind tokens (`tailwind.config.ts`)

```ts
colors: {
  background:     '#0A0B0B',
  surface:        '#15181A',
  'surface-hover':'#1B1F22',
  border:         'rgba(255,255,255,0.06)',
  accent:         '#2DE3A8',        // mint-teal — CTAs, progress, active states
  'accent-fg':    '#003D2B',
  text:           '#FFFFFF',
  'text-muted':   '#9CA3AF',
  'text-dim':     '#6B7280',
  danger:         '#EF4444',
  success:        '#10B981',
  warning:        '#F59E0B',
},
borderRadius: {
  card: '14px',
  pill: '999px',
}
```

### Typography

- Default: **Inter** (Variable, via `next/font`)
- Swap when client confirms exact font from mockups (likely a similar grotesque)

### shadcn primitives installed in SP-1

`Button`, `Card`, `Input`, `Label`, `Select`, `Switch`, `Badge`, `Avatar`, `DropdownMenu`, `NavigationMenu`, `Separator`, `Toast`

### Layout shell (`app/(authed)/layout.tsx`)

Three-column layout matching the mockups:

- **Left sidebar** (~220px fixed)
  - Logo at top
  - Nav (Dashboard / Settings only in SP-1; more items appear as later SPs land)
  - Bottom: coach card (placeholder photo + name + role) + "Discipline today / Freedom tomorrow" quote with signature placeholder
  - Bottom-most: "Message Coach" button → `https://wa.me/{coachPhoneFromEnv}` deep-link
- **Top bar**
  - Page title + subtitle (left)
  - Search bar (disabled placeholder in SP-1)
  - "Upgrade Now" CTA — visible only when `user.plan !== 'pro'`
  - Notification bell (disabled placeholder)
  - Avatar + dropdown (Sign out, Settings link)
- **Main area** — fluid, scrollable
- **Right rail** (~320px fixed) — contextual widgets per page

### File structure

```
app/
  (public)/
    page.tsx                  # landing
    sign-in/[[...rest]]/page.tsx
    sign-up/[[...rest]]/page.tsx
  (authed)/
    layout.tsx                # shell with sidebar + top bar + right rail
    onboarding/page.tsx
    dashboard/page.tsx
    settings/page.tsx
  api/
    webhooks/clerk/route.ts

components/
  ui/                         # shadcn primitives
  layout/
    Sidebar.tsx
    TopBar.tsx
    RightRail.tsx
  branded/
    Logo.tsx
    HeroCard.tsx              # the big "Current Program" card pattern from the mockup
    StatCard.tsx              # icon + label + big number + delta pattern
    PreferenceToggle.tsx

lib/
  db.ts                       # Neon client + RLS GUC helper
  auth.ts                     # requireUser(), requireRole('admin')
  env.ts                      # zod-validated env vars

middleware.ts
```

---

## 7. Cross-cutting design rules (locked now, applied by every later SP)

These are the architectural patterns SP-1 establishes that every later sub-project follows:

1. **Single `canAccess(user, contentItem)` resolver.** Plan × Category × per-user overrides go through one function. UI and API both call it. (SP-3 introduces this; SP-1 stubs the file.)
2. **One `progress_events` table for all completion semantics.** Don't scatter "completed" across modules. (Introduced in SP-4/5; SP-1 documents the pattern.)
3. **Subscription as state, not boolean.** Plan access is `(plan, status, current_period_end, grace_until)`, not `(plan, active_bool)`. (SP-3 introduces; SP-1 stubs columns.)
4. **All env vars validated by zod at startup.** Fail fast if a secret is missing in production.
5. **Mobile-first responsive.** Test at 375px / 768px / 1440px on every page in every SP. Users live in the gym on phones.
6. **No client-side data fetching for protected data.** Server Components read from Neon; client components receive data as props or via server actions. RLS is enforced by Postgres, not by client code.

---

## 8. Acceptance criteria

SP-1 is **done** when all of these are true:

- [ ] Deployed to Vercel production at a real URL (placeholder domain OK)
- [ ] User signs up via Clerk → row appears in Neon `users` table → lands on `/onboarding`
- [ ] User picks category + ≥1 goal on `/onboarding` → lands on `/dashboard`
- [ ] `/dashboard` shows user's name, category badge, goals tags
- [ ] `/settings` shows the same data read-only
- [ ] Direct SQL probe: querying another user's row with session A's GUCs returns zero rows (RLS works)
- [ ] Sign out → `/` and any protected route redirects to `/sign-in`
- [ ] Webhook idempotency: replay the same `user.created` event twice → only one row inserted
- [ ] Webhook signature failure → returns 401 + Sentry captures the exception
- [ ] Sentry is wired up — deliberate `throw new Error('test')` on a debug route appears in the Sentry dashboard
- [ ] Clerk JWT template includes `publicMetadata.role` (verified by inspecting a real JWT after login)
- [ ] CI green: `next build` + `tsc --noEmit` + `eslint` + (any unit tests added)
- [ ] Lighthouse Performance ≥ 90 on `/` (mobile, simulated fast 3G)
- [ ] Cold-load `/dashboard` < 2.5s on simulated fast 3G
- [ ] Layout works correctly at 375px / 768px / 1440px viewport widths
- [ ] All env vars validated at startup; missing var → server crashes loud, not silent

---

## 9. Risks & open items

### Open items (must be resolved before SP-2 starts, not blocking SP-1)

- **Q4 — Max lifts schema.** Coach needs to confirm: which lifts to track and whether programs use % of 1RM, RPE, or raw weights. Default assumption: Big 4 + % of 1RM. Blocks SP-2's profile editor.
- **Final brand font.** Inter as starting default; swap once client confirms the mockup's exact font.
- **Logo asset.** Use a temporary SVG matching the mockup's triangle motif; replace with client's final logo file when supplied.
- **Coach's WhatsApp number + Calendly URL.** Will be env vars (`NEXT_PUBLIC_COACH_WHATSAPP`, `NEXT_PUBLIC_COACH_CALENDLY`). Placeholder values ship in SP-1; real values added by client.

### Known risks for SP-1

- **Clerk JWT does not include `role` by default.** Must configure a JWT template in Clerk's dashboard to include `publicMetadata.role` in the session token. If skipped, RLS admin policies don't work. Mitigation: include this in the implementation plan's setup checklist with verification step.
- **Webhook + DB transaction integrity.** If the `users` insert succeeds but `clerk_events` insert fails (or vice versa), we end up in a broken state. Mitigation: both inserts in one transaction; if anything fails, return 5xx and let Clerk retry.
- **Onboarding can be skipped if the user closes the tab mid-flow.** They come back to `/dashboard`, get bounced to `/onboarding` because `category IS NULL` — but only if they go to the dashboard. Mitigation: on Clerk callback, server-side check forces `/onboarding` until category is set.
- **RLS GUC reset between connections.** With connection pooling (PgBouncer / Neon's pooler), a connection may leak state. Mitigation: use `SET LOCAL` (transaction-scoped) not `SET` (session-scoped), and wrap every query in a transaction.

---

## 10. Verification before this spec is considered "done planning"

- [x] Multi-agent assessment complete (architecture, sequencing, risks)
- [x] All 9 brainstorm questions answered or explicitly deferred
- [x] Approach (A — full slice with placeholders) selected
- [x] All five design sections reviewed and approved by user
- [ ] Spec written and committed (this file)
- [ ] Spec self-reviewed for placeholders, internal consistency, scope, ambiguity
- [ ] User reviews this written spec
- [ ] Implementation plan created (next step — via writing-plans skill)

---

## 11. References

- Brief: pasted by user 2026-05-13 (project brief v1.0)
- Design mockups: 3 screens (Dashboard, Programs Library, Account Settings) + Elevate Coaching logo provided by client
- Multi-agent assessment: produced 2026-05-13 by parallel Plan + general-purpose agents
- Brand: Elevate Coaching — dark theme, mint-teal accent (#2DE3A8), twin-triangle logo
