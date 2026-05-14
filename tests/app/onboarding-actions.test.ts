import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { onboardingInitialState } from '@/app/onboarding/state';

/**
 * Tests for app/onboarding/actions.ts — completeOnboardingAction.
 *
 * The action's two side effects (DB update + redirect) are both stubbed:
 *   - createSupabaseServerClient → returns a chained mock that records the
 *     filter chain (.from → .update → .eq → .is). The terminal .is() returns
 *     the configured error or null.
 *   - redirect from next/navigation → throws a marker error so the test can
 *     assert the path. (Next does this in production too — redirect() never
 *     "returns".)
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

const VALID_DATA = { category: 'B', experience_level: 'intermediate' };

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
  describe('completeOnboardingAction', () => {
    it('returns an error state when no fields are submitted', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      const result = await completeOnboardingAction(onboardingInitialState, makeFormData({}));
      expect(result.status).toBe('error');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });

    it('returns an error state when category is invalid', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      const result = await completeOnboardingAction(
        onboardingInitialState,
        makeFormData({ category: 'Z', experience_level: 'beginner' }),
      );
      expect(result.status).toBe('error');
    });

    it('returns an error state when experience_level is missing', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      const result = await completeOnboardingAction(
        onboardingInitialState,
        makeFormData({ category: 'A' }),
      );
      expect(result.status).toBe('error');
    });

    it('redirects to /sign-in when there is no session', async () => {
      const mock = makeSupabaseMock({ user: null });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      await expect(
        completeOnboardingAction(onboardingInitialState, makeFormData(VALID_DATA)),
      ).rejects.toThrow('NEXT_REDIRECT;/sign-in');
    });

    it('writes profile fields and redirects to /dashboard on success', async () => {
      const mock = makeSupabaseMock({ user: { id: 'user-1' } });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      await expect(
        completeOnboardingAction(onboardingInitialState, makeFormData(VALID_DATA)),
      ).rejects.toThrow('NEXT_REDIRECT;/dashboard');

      expect(mock.fromFn).toHaveBeenCalledWith('profiles');
      // The update payload must include category and experience_level
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload = (mock.updateFn.mock.calls as any)[0][0];
      expect(updatePayload).toMatchObject({ category: 'B', experience_level: 'intermediate' });
      expect(mock.eqFn).toHaveBeenCalledWith('id', 'user-1');
      expect(mock.isFn).toHaveBeenCalledWith('category', null);
    });

    it('saves optional max lift values when provided', async () => {
      const mock = makeSupabaseMock({ user: { id: 'user-1' } });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      await expect(
        completeOnboardingAction(
          onboardingInitialState,
          makeFormData({
            ...VALID_DATA,
            max_lift_squat: '140',
            max_lift_bench: '100',
            max_lift_deadlift: '180',
            max_lift_ohp: '70',
          }),
        ),
      ).rejects.toThrow('NEXT_REDIRECT;/dashboard');

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updatePayload = (mock.updateFn.mock.calls as any)[0][0];
      expect(updatePayload).toMatchObject({
        max_lift_squat: 140,
        max_lift_bench: 100,
        max_lift_deadlift: 180,
        max_lift_ohp: 70,
      });
    });

    it('returns an error state when the DB write fails', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        updateError: { message: 'rls violation' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { completeOnboardingAction } = await import('@/app/onboarding/actions');
      const result = await completeOnboardingAction(
        onboardingInitialState,
        makeFormData(VALID_DATA),
      );
      expect(result.status).toBe('error');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });
});
