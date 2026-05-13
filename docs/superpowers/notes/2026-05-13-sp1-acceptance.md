# SP-1 Acceptance Checklist

**Adapted from the original plan's Task 43 to reflect the Clerk→Supabase
pivot and the Path A scope cut. Items marked N/A are not applicable
post-pivot; items marked SP-2 were deferred by Path A and roll into
the next sprint's acceptance.**

Mark each box ✅ as it's verified in the live deployment
(`https://elevate-coaching-two.vercel.app`).

## Already verified (automated / done this session)

- [x] Deployed to Vercel production (preview-url alias serves
      `main` HEAD; `npx vercel ls` confirms `Ready`)
- [x] Sentry wired (Sentry config in `sentry.{client,server,edge}.config.ts`;
      debug route used to confirm capture, now removed in Task 42)
- [x] CI green (GitHub Actions `ci.yml` runs lint · typecheck ·
      format · vitest · build · Playwright e2e on every PR + push to
      main; first run triggered by commit `74bc954`)
- [x] Direct SQL probe: RLS denies cross-user reads (Phase C task 19's
      RLS test passed at apply time; profile-fetch fix shipped in
      migration `20260513151506_fix_profiles_rls_recursion.sql` —
      proven by the in-flight login-restored verification)
- [x] Inter font actually applies (commit `7fcbd8e` fixed the
      self-reference bug in `--font-sans` / `--font-heading`; live CSS
      now serves a valid Inter fallback stack)

## To verify manually (Jack)

### Auth happy path

- [ ] Visit `/sign-up` → fill the form with a fresh email → submit.
      Expected: success state telling you to confirm via email.
- [ ] Open the confirmation email, click the link → land back on the
      app authenticated.
- [ ] Land on `/dashboard` (not on `/onboarding` — that page doesn't
      exist yet by Path A).
- [ ] Sign out (avatar menu → Sign out) → redirected to `/` landing.
- [ ] Visit `/dashboard` while signed out → 307 redirect to `/sign-in`
      (already proven by Playwright test 2).
- [ ] Visit `/sign-in` while already signed in → 307 redirect to
      `/dashboard` (middleware enforces this).

### Visual cross-viewport

Open Chrome DevTools → device toolbar:

- [ ] **375px (iPhone SE)**: visit `/`, `/sign-up`, `/sign-in`,
      `/dashboard`, `/settings`. No horizontal scroll. Sidebar may
      hide / drawer (current build keeps it visible — known limitation,
      addressed in SP-2 with a hamburger).
- [ ] **768px (iPad)**: same routes. Sidebar visible. Cards stack 2-up.
- [ ] **1440px (desktop)**: matches the SP-1 mockups visually
      (sidebar + main + right rail).

### Performance (Lighthouse)

DevTools → Lighthouse → Mobile → Performance → Slow 4G → Analyze.

- [ ] **Landing (`/`)**: LCP < 2.5s, CLS < 0.1, Performance score ≥ 90.
      If LCP exceeds 2.5s, log it in `sp1-followups.md` — not blocking,
      tighten in SP-2.
- [ ] **Dashboard (`/dashboard`)**: LCP < 2.5s, CLS < 0.1. Sign in
      first; Lighthouse will follow the auth cookie.

### Dashboard sanity

- [ ] Hover a StatCard → it lifts and the chart visual scales slightly.
- [ ] Hover a Video Tutorial card → thumbnail icon scales + mint play
      badge fades in.
- [ ] Toggle 7D / 30D / 90D on Performance Overview → big number and
      sparkline both update.
- [ ] Click the Dashboard nav row → row stays active (highlighted with
      mint left bar + gradient). Confirmed fixed in `461abc9`.

### Settings sanity

- [ ] Visit `/settings` → profile card shows name (or `—`), email,
      plan tier pill, role.
- [ ] Click "Schedule a Call" → opens Calendly link in a new tab.
- [ ] Avatar menu → "Settings" → reloads settings page (no JS error).
- [ ] Avatar menu → "Sign out" → returns to `/`.

## Not applicable post-pivot

- ~~Webhook idempotency: replay event in Clerk dashboard~~ — no Clerk webhook.
  Replaced by the Supabase `handle_new_user` trigger which is INSERT-ON-CONFLICT
  by construction. Phase C migration handles this.
- ~~Webhook signature failure → 401 + Sentry capture~~ — N/A.
- ~~Clerk JWT includes `role` claim~~ — N/A. Role lives in the
  `profiles.role` column and is enforced via Supabase RLS, not JWT
  claim. Verified via `lib/auth.ts`'s `requireCoach()` flow.

## Deferred to SP-2 (Path A choice)

These items from the original SP-1 spec § 8 are explicitly out of
scope until the next sprint:

- ~~Sign up → row in DB → lands on `/onboarding`~~ — onboarding flow
  not built; users go straight to `/dashboard` after confirming email.
- ~~Pick category + goal → lands on `/dashboard`~~ — same.
- ~~`/dashboard` shows category badge, goals tags~~ — dashboard rail
  uses Today's Tasks / Weekly Schedule / Performance Overview instead
  (rich demo data per the SP-1 mockups). Real category/goals widgets
  arrive in SP-2.
- ~~`/settings` shows the same category + goals as dashboard~~ — same.
  The plan-tier pill on the profile card is the visible equivalent
  until SP-2 wires the rest.

## Sign-off

Once every checked box above is ticked, mark this file's first heading:

```
# SP-1 Acceptance Checklist ✅
```

…and push. The `sp1-complete` git tag exists from Task 47 — re-tag if
you want to capture the moment all manual checks passed (`git tag -a
sp1-verified -m "All manual acceptance checks passed"`).
