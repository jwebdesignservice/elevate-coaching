# SP-2 Handover

**Status:** Code complete on branch `sp2-profile-variables`.
**Final HEAD:** see `git log sp2-profile-variables`.
**Open requirement:** the SP-2 migration has not yet been applied to the
live Supabase project. See §1 below.

## What shipped

The first piece of real product data: training category. End-to-end —
schema, taxonomy module, onboarding flow with gate, settings card with
coach-reviewed change-request flow, dashboard eyebrow, mobile sidebar
drawer, and 44 unit tests.

Commit-by-commit:

| Commit | Phase | Summary |
| --- | --- | --- |
| `9954f8f` | Spec | Design doc + locked decisions |
| `e901708` | A | Schema migration + types regen |
| `5004ac9` | B | `lib/categories.ts` + 21 unit tests |
| `88089cc` | C | Onboarding route, action, gate, e2e smoke |
| `b85b495` | D | Settings category card + change-request flow |
| `49352fb` | E | Dashboard eyebrow → real category |
| `a48e117` | F | Mobile sidebar drawer + responsive shell polish |
| `d633565` | G | Prettier + Supabase TS write-cast pattern |

## 1. CRITICAL — migration not applied to live project

The new SQL migration

```
supabase/migrations/20260513184100_sp2_category_and_change_requests.sql
```

is committed but **has not been pushed to the live Supabase project**.
Reason: the local environment running this work had no Supabase CLI
installed (disk pressure prevented `npx supabase`) and the Supabase MCP
in scope did not have access to project ref `zptxhbblbcaliwezltzp`.

To apply:

```bash
# install CLI if needed
npm install -g supabase

# link to the project (only needed once)
supabase login
supabase link --project-ref zptxhbblbcaliwezltzp

# push the migration
supabase db push
```

OR upload the SQL via the Supabase dashboard SQL editor.

After applying, regenerate types to verify parity with the hand-crafted
version:

```bash
supabase gen types typescript --linked > lib/supabase/database.types.ts
```

If the generated file differs, commit the regenerated version. The
hand-crafted edits match the structural shape of the previous SP-1 types
file (Tables / Row / Insert / Update / Relationships / Enums) but a
Supabase gen-types run may include richer Relationships entries or other
metadata.

## 2. Supabase TS write-cast pattern

`@supabase/postgrest-js` v2.105 in this project types write builders
(`.update()`, `.insert()`) as `never` against the `Database` type from
`lib/supabase/database.types.ts`. This is the same upstream inference
quirk that SP-1 worked around with `as Profile` on read results
(see [lib/auth.ts:42](../../../lib/auth.ts)).

The pattern adopted in SP-2:

- **Reads:** destructure data, then cast to the expected row shape.
  ```ts
  const { data: profileRaw } = await supabase.from('profiles').select('category').eq('id', uid).single();
  const profile = profileRaw as { category: Category | null };
  ```
- **Writes:** cast the payload to `never`.
  ```ts
  await supabase.from('profiles').update({ category } as never).eq('id', uid);
  ```

This is a temporary pattern. When the upstream package fixes the
inference (or when the project upgrades to a version that doesn't have
the issue), the casts can be ripped out cleanly with a find-and-replace.

## 3. What works locally

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm run format:check` — clean
- `npm test` — 44 / 44 vitest tests pass
- `npm run build` — production build succeeds; all routes in the
  expected static / dynamic split

## 4. What didn't run locally

- **Playwright e2e** — the existing `signup-flow.spec.ts` plus the new
  `onboarding.spec.ts` smoke. Local disk was at 100% (~170 MB free) and
  Playwright wants to download browser binaries (~200 MB) on first run;
  pushing without local e2e for CI to catch.
- **Authenticated e2e flow** (sign-up → email-confirm → onboarding pick
  → dashboard eyebrow renders) — would need a Supabase admin fixture to
  auto-confirm test emails. The spec mentions this fixture lives in
  `tests/e2e/fixtures.ts` once it ships; not in scope for SP-2.

## 5. What to verify on the live project after migration apply

Once the migration runs, manual verification checklist:

- [ ] Sign up a fresh account → email confirmation → sign in → lands on
      `/onboarding` (not `/dashboard`).
- [ ] Pick "Beginner" → lands on `/dashboard`. Eyebrow on the program
      hero reads "Category A · Beginner".
- [ ] Navigate to `/settings`. See the category card with the same code
      + name + description.
- [ ] Click "Request change" → pick "Strength" → optional reason →
      submit. See the green success line + pending-status banner replaces
      the button.
- [ ] As the coach (any account with `profiles.role = 'coach'`), open
      Supabase Studio, view `category_change_requests`. Approve a row
      via two SQL statements:
      ```sql
      update public.category_change_requests
        set status='approved', resolved_at=now(), resolved_by='<coach uuid>'
        where id='<request id>';
      update public.profiles
        set category='<requested>' where id='<user id>';
      ```
- [ ] Sign-in as the requester → dashboard eyebrow reflects the new
      category, settings card shows it, pending banner is gone.
- [ ] Open the site on a mobile viewport (375px). Hamburger appears
      top-left, sidebar is hidden, TopBar title doesn't collide with the
      hamburger. Tapping hamburger slides the drawer in; backdrop / ESC
      / nav-link tap closes it.

## 6. Known follow-ups (not blocking SP-2 merge)

These are documented for future sprints rather than fixed here:

1. **Hand-crafted types vs `supabase gen types` parity.** Run the gen
   types command after applying the migration; commit any drift.
2. **`as never` write casts.** Track upstream Supabase TS fix; rip out
   when possible. One-line PR.
3. **e2e auth fixture.** Build `tests/e2e/fixtures.ts` with Supabase
   admin auto-confirm so SP-2's full sign-up→onboarding→dashboard flow
   is covered by automation. Likely happens alongside SP-3 (Stripe e2e
   has the same need).
4. **`@neondatabase/serverless` dep.** Still in package.json from before
   the Supabase pivot. SP-1 retro flagged; 1-line removal PR.
5. **`middleware.ts` → `proxy.ts` migration.** Next.js 16 build warns;
   functional today but should be migrated.
6. **Vercel preview env vars.** Still not set; PR preview deploys will
   crash at runtime.

## 7. Spec accuracy

`docs/superpowers/specs/2026-05-13-sp2-profile-variables-design.md` was
followed closely. One inline divergence:

- §5 spec'd the change-request RLS coach policies as
  `exists (select 1 from public.profiles me where ... role = 'coach')`.
  The actual migration uses the SP-1-introduced `public.is_coach()`
  SECURITY DEFINER helper instead. Same end result, but `is_coach()` is
  immune to the RLS recursion footgun that SP-1's
  `20260513151506_fix_profiles_rls_recursion.sql` had to patch. The
  spec's chosen approach would have re-triggered that bug; the
  implementation is correct.

This is noted in the migration's leading comment block.
