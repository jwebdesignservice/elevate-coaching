import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onboardingInitialState } from '@/app/onboarding/state';

/**
 * Tests for app/onboarding/actions.ts — setCategoryAction.
 *
 * The action's two side effects (DB update + redirect) are both stubbed:
 *   - createSupabaseServerClient → returns a chained mock that records the
 *     filter chain (.from → .update → .eq → .is). The terminal .is() returns
 *     the configured error or null.
 *   - redirect from next/navigation → throws a marker error so the test can
 *     assert the path. (Next does this in production too — redirect() never
 *     "returns".)
 *
 * See tests/lib/auth.test.ts for the same mock skeleton applied to lib/auth.
 */

class RedirectError extends Error {
  constructor(public digest: string) {
    super(`NEXT_REDIRECT;${digest}`);
  }
}

function makeFormData(entries: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

interface UpdateOpts {
  user: { id: string } | null;
  updateError?: { message: string } | null;
}

function makeSupabaseMock(opts: UpdateOpts) {
  const isFn = vi.fn(async () => ({ error: opts.updateError ?? null }));
  const eqFn = vi.fn(() => ({ is: isFn }));
  const updateFn = vi.fn(() => ({ eq: eqFn }));
  const fromFn = vi.fn(() => ({ update: updateFn }));

  return {
    client: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: opts.user }, error: null })),
      },
      from: fromFn,
    },
    fromFn,
    updateFn,
    eqFn,
    isFn,
  };
}

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new RedirectError(path);
  }),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

beforeEach(() => {
  mocks.createSupabaseServerClient.mockReset();
  mocks.redirect.mockClear();
  mocks.redirect.mockImplementation((path: string) => {
    throw new RedirectError(path);
  });
});

afterEach(() => {
  vi.resetModules();
});

describe('app/onboarding/actions', () => {
  describe('setCategoryAction', () => {
    it('returns an error state when no category is submitted', async () => {
      // No call into Supabase expected when validation fails.
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { setCategoryAction } = await import('@/app/onboarding/actions');
      const result = await setCategoryAction(onboardingInitialState, makeFormData({}));
      expect(result.status).toBe('error');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it('returns an error state when category is invalid', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { setCategoryAction } = await import('@/app/onboarding/actions');
      const result = await setCategoryAction(
        onboardingInitialState,
        makeFormData({ category: 'Z' }),
      );
      expect(result.status).toBe('error');
    });

    it('redirects to /sign-in when there is no session', async () => {
      const mock = makeSupabaseMock({ user: null });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { setCategoryAction } = await import('@/app/onboarding/actions');
      await expect(
        setCategoryAction(onboardingInitialState, makeFormData({ category: 'A' })),
      ).rejects.toThrow('NEXT_REDIRECT;/sign-in');
    });

    it('writes the category and redirects to /dashboard on success', async () => {
      const mock = makeSupabaseMock({ user: { id: 'user-1' } });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { setCategoryAction } = await import('@/app/onboarding/actions');
      await expect(
        setCategoryAction(onboardingInitialState, makeFormData({ category: 'B' })),
      ).rejects.toThrow('NEXT_REDIRECT;/dashboard');

      // Check the filter chain: profiles → update({category:'B'}) → eq(id, 'user-1') → is(category, null)
      expect(mock.fromFn).toHaveBeenCalledWith('profiles');
      expect(mock.updateFn).toHaveBeenCalledWith({ category: 'B' });
      expect(mock.eqFn).toHaveBeenCalledWith('id', 'user-1');
      expect(mock.isFn).toHaveBeenCalledWith('category', null);
    });

    it('returns an error state when the DB write fails', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        updateError: { message: 'rls violation' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { setCategoryAction } = await import('@/app/onboarding/actions');
      const result = await setCategoryAction(
        onboardingInitialState,
        makeFormData({ category: 'C' }),
      );
      expect(result.status).toBe('error');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });
});
