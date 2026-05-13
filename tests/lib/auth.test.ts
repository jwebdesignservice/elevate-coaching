import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for lib/auth.ts.
 *
 * `redirect()` from `next/navigation` throws a `NEXT_REDIRECT` sentinel error
 * in real Next runtime. In the unit-test environment it's mocked to throw an
 * identifiable error so we can assert the path.
 */

class RedirectError extends Error {
  constructor(public digest: string) {
    super(`NEXT_REDIRECT;${digest}`);
  }
}

// Helpers to build the mock Supabase server client shape that lib/auth.ts uses.
type MockProfile = {
  id: string;
  email: string;
  name: string | null;
  role: 'user' | 'coach';
  subscription_tier: 'free' | 'basic' | 'pro';
  created_at: string;
  updated_at: string;
};

function makeSupabaseMock(opts: {
  user: { id: string } | null;
  profile?: MockProfile | null;
  profileError?: { message: string } | null;
}) {
  const singleResult = {
    data: opts.profile ?? null,
    error: opts.profileError ?? (opts.profile ? null : { message: 'not found' }),
  };
  const eq = vi.fn(() => ({ single: vi.fn(async () => singleResult) }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));

  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: opts.user }, error: null })),
    },
    from,
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

describe('lib/auth', () => {
  describe('getCurrentUser', () => {
    it('returns null when there is no session', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue(makeSupabaseMock({ user: null }));
      const { getCurrentUser } = await import('@/lib/auth');
      const result = await getCurrentUser();
      expect(result).toBeNull();
    });

    it('returns user + profile when signed in', async () => {
      const profile: MockProfile = {
        id: 'user-1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'user',
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mocks.createSupabaseServerClient.mockResolvedValue(
        makeSupabaseMock({ user: { id: 'user-1' }, profile }),
      );
      const { getCurrentUser } = await import('@/lib/auth');
      const result = await getCurrentUser();
      expect(result).not.toBeNull();
      expect(result?.user.id).toBe('user-1');
      expect(result?.profile.email).toBe('a@b.com');
    });

    it('returns null when profile lookup fails', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue(
        makeSupabaseMock({
          user: { id: 'user-1' },
          profile: null,
          profileError: { message: 'row missing' },
        }),
      );
      const { getCurrentUser } = await import('@/lib/auth');
      expect(await getCurrentUser()).toBeNull();
    });
  });

  describe('requireUser', () => {
    it('redirects to /sign-in when not signed in', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue(makeSupabaseMock({ user: null }));
      const { requireUser } = await import('@/lib/auth');
      await expect(requireUser()).rejects.toThrow('NEXT_REDIRECT;/sign-in');
      expect(mocks.redirect).toHaveBeenCalledWith('/sign-in');
    });

    it('returns the user + profile when signed in', async () => {
      const profile: MockProfile = {
        id: 'user-1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'user',
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mocks.createSupabaseServerClient.mockResolvedValue(
        makeSupabaseMock({ user: { id: 'user-1' }, profile }),
      );
      const { requireUser } = await import('@/lib/auth');
      const result = await requireUser();
      expect(result.profile.name).toBe('Alice');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });

  describe('requireCoach', () => {
    it('redirects to /sign-in when not signed in', async () => {
      mocks.createSupabaseServerClient.mockResolvedValue(makeSupabaseMock({ user: null }));
      const { requireCoach } = await import('@/lib/auth');
      await expect(requireCoach()).rejects.toThrow('NEXT_REDIRECT;/sign-in');
    });

    it('redirects to /dashboard when role !== coach', async () => {
      const profile: MockProfile = {
        id: 'user-1',
        email: 'a@b.com',
        name: 'Alice',
        role: 'user',
        subscription_tier: 'free',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mocks.createSupabaseServerClient.mockResolvedValue(
        makeSupabaseMock({ user: { id: 'user-1' }, profile }),
      );
      const { requireCoach } = await import('@/lib/auth');
      await expect(requireCoach()).rejects.toThrow('NEXT_REDIRECT;/dashboard');
    });

    it('returns the user + profile when role === coach', async () => {
      const profile: MockProfile = {
        id: 'coach-1',
        email: 'coach@b.com',
        name: 'Coach',
        role: 'coach',
        subscription_tier: 'pro',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };
      mocks.createSupabaseServerClient.mockResolvedValue(
        makeSupabaseMock({ user: { id: 'coach-1' }, profile }),
      );
      const { requireCoach } = await import('@/lib/auth');
      const result = await requireCoach();
      expect(result.profile.role).toBe('coach');
      expect(mocks.redirect).not.toHaveBeenCalled();
    });
  });
});
