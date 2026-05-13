import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestCategoryChangeInitialState } from '@/app/(authed)/settings/state';

/**
 * Tests for app/(authed)/settings/actions.ts — requestCategoryChangeAction.
 *
 * Same mocking skeleton as tests/lib/auth.test.ts and
 * tests/app/onboarding-actions.test.ts: createSupabaseServerClient → a
 * chainable mock; next/navigation.redirect → throws a marker error so we
 * can assert on the redirect path.
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

interface MockOpts {
  user: { id: string } | null;
  profile?: { category: string | null } | null;
  profileError?: { message: string } | null;
  insertError?: { message: string } | null;
}

function makeSupabaseMock(opts: MockOpts) {
  // .from('profiles').select('category').eq('id', x).single() → profile row
  const profileSingle = vi.fn(async () => ({
    data: opts.profile ?? null,
    error: opts.profileError ?? (opts.profile ? null : { message: 'no row' }),
  }));
  const profileEq = vi.fn(() => ({ single: profileSingle }));
  const profileSelect = vi.fn(() => ({ eq: profileEq }));

  // .from('category_change_requests').insert(...) → { error }
  const ccrInsert = vi.fn(async () => ({ error: opts.insertError ?? null }));

  const fromFn = vi.fn((table: string) => {
    if (table === 'profiles') return { select: profileSelect };
    if (table === 'category_change_requests') return { insert: ccrInsert };
    throw new Error(`unexpected table: ${table}`);
  });

  return {
    client: {
      auth: {
        getUser: vi.fn(async () => ({ data: { user: opts.user }, error: null })),
      },
      from: fromFn,
    },
    fromFn,
    profileSelect,
    profileEq,
    profileSingle,
    ccrInsert,
  };
}

const mocks = vi.hoisted(() => ({
  createSupabaseServerClient: vi.fn(),
  redirect: vi.fn((path: string) => {
    throw new RedirectError(path);
  }),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: mocks.createSupabaseServerClient,
  createSupabaseAdminClient: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  redirect: mocks.redirect,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.revalidatePath,
}));

beforeEach(() => {
  mocks.createSupabaseServerClient.mockReset();
  mocks.redirect.mockClear();
  mocks.revalidatePath.mockClear();
  mocks.redirect.mockImplementation((path: string) => {
    throw new RedirectError(path);
  });
});

afterEach(() => {
  vi.resetModules();
});

describe('app/(authed)/settings/actions', () => {
  describe('requestCategoryChangeAction', () => {
    it('rejects an invalid requested_category', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      const result = await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'Z' }),
      );
      expect(result.status).toBe('error');
    });

    it('rejects when reason exceeds 500 chars', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue({});
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      const longReason = 'x'.repeat(501);
      const result = await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'B', reason: longReason }),
      );
      expect(result.status).toBe('error');
    });

    it('redirects to /sign-in when there is no session', async () => {
      const mock = makeSupabaseMock({ user: null });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      await expect(
        requestCategoryChangeAction(
          requestCategoryChangeInitialState,
          makeFormData({ requested_category: 'B' }),
        ),
      ).rejects.toThrow('NEXT_REDIRECT;/sign-in');
    });

    it('redirects to /onboarding when the user has no category yet', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        profile: { category: null },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      await expect(
        requestCategoryChangeAction(
          requestCategoryChangeInitialState,
          makeFormData({ requested_category: 'B' }),
        ),
      ).rejects.toThrow('NEXT_REDIRECT;/onboarding');
    });

    it('rejects when the user requests their existing category', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        profile: { category: 'B' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      const result = await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'B' }),
      );
      expect(result.status).toBe('error');
      expect(result.error).toMatch(/already in that category/i);
    });

    it('inserts the request and returns success when valid', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        profile: { category: 'A' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      const result = await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'C', reason: 'Hit a plateau, ready to push.' }),
      );

      expect(result.status).toBe('success');
      expect(mock.ccrInsert).toHaveBeenCalledWith({
        user_id: 'user-1',
        current_category: 'A',
        requested_category: 'C',
        reason: 'Hit a plateau, ready to push.',
      });
      expect(mocks.revalidatePath).toHaveBeenCalledWith('/settings');
    });

    it('normalises an empty reason to null', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        profile: { category: 'A' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'C', reason: '' }),
      );
      expect(mock.ccrInsert).toHaveBeenCalledWith(expect.objectContaining({ reason: null }));
    });

    it('returns an error when the insert fails', async () => {
      const mock = makeSupabaseMock({
        user: { id: 'user-1' },
        profile: { category: 'A' },
        insertError: { message: 'rls violation' },
      });
      mocks.createSupabaseServerClient.mockResolvedValue(mock.client);
      const { requestCategoryChangeAction } = await import('@/app/(authed)/settings/actions');
      const result = await requestCategoryChangeAction(
        requestCategoryChangeInitialState,
        makeFormData({ requested_category: 'C' }),
      );
      expect(result.status).toBe('error');
    });
  });
});
