import { BadgeCheck, Calendar, Mail, Shield, User as UserIcon } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { env } from '@/lib/env';
import type { Category } from '@/lib/categories';
import { CategoryCard } from './category-card';

export const metadata = {
  title: 'Settings · Elevate Coaching',
};

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  basic: 'Basic',
  pro: 'Pro',
};

const ROLE_LABEL: Record<string, string> = {
  user: 'Athlete',
  coach: 'Coach',
};

export default async function SettingsPage() {
  const { profile } = await requireUser();

  // The authed-layout gate guarantees profile.category is non-null by the
  // time this page renders. Cast the type narrow that the gate enforces at
  // runtime.
  const currentCategory = profile.category as Category;

  // Fetch the user's latest pending change request (if any). One query, RLS
  // scopes to the current user automatically. Limit 1 because we only show
  // the most recent — older pending rows are blocked by the UI but the DB
  // doesn't enforce uniqueness (the coach may resolve and re-request).
  const supabase = await createSupabaseServerClient();
  const { data: pendingRows } = await supabase
    .from('category_change_requests')
    .select('id, requested_category, created_at')
    .eq('user_id', profile.id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1);

  const pending = pendingRows?.[0] ?? null;
  const pendingRequest = pending
    ? {
        id: pending.id,
        requestedCategory: pending.requested_category as Category,
        createdAt: pending.created_at,
      }
    : null;

  const displayName = profile.name?.trim() || 'Member';
  const initials =
    profile.name
      ?.split(/\s+/)
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || 'U';

  return (
    <>
      <TopBar
        title="Account Settings"
        subtitle="Manage your profile, security, and preferences."
        userTier={profile.subscription_tier}
        userName={profile.name}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {/* Profile card — visual hero of the page */}
          <Card className="from-surface to-surface-hover border-border relative overflow-hidden bg-gradient-to-br p-8">
            <div
              aria-hidden
              className="bg-accent/15 pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full blur-3xl"
            />
            <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
              <Avatar size="lg" className="size-20 shrink-0">
                <AvatarFallback className="bg-surface-hover text-text text-2xl font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-text text-3xl font-bold tracking-tight">{displayName}</h2>
                  <span className="bg-accent/15 text-accent rounded-pill inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {TIER_LABEL[profile.subscription_tier] ?? profile.subscription_tier} Plan
                  </span>
                </div>
                <p className="text-text-muted mt-1.5 text-sm">
                  {ROLE_LABEL[profile.role] ?? profile.role} · Elevate Coaching member
                </p>
              </div>
            </div>

            <dl className="border-border relative mt-8 grid grid-cols-1 gap-6 border-t pt-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <UserIcon className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-text-dim text-[11px] font-medium tracking-[0.15em] uppercase">
                    Full Name
                  </dt>
                  <dd className="text-text mt-1 text-sm">{profile.name || '—'}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-text-dim text-[11px] font-medium tracking-[0.15em] uppercase">
                    Email
                  </dt>
                  <dd className="text-text mt-1 text-sm">{profile.email}</dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <BadgeCheck className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-text-dim text-[11px] font-medium tracking-[0.15em] uppercase">
                    Plan
                  </dt>
                  <dd className="text-text mt-1 text-sm">
                    {TIER_LABEL[profile.subscription_tier] ?? profile.subscription_tier}
                  </dd>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Shield className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <dt className="text-text-dim text-[11px] font-medium tracking-[0.15em] uppercase">
                    Role
                  </dt>
                  <dd className="text-text mt-1 text-sm">
                    {ROLE_LABEL[profile.role] ?? profile.role}
                  </dd>
                </div>
              </div>
            </dl>

            <p className="text-text-dim relative mt-6 text-xs">
              Editing your name and avatar lands in a later sprint. Your training category is
              editable below via the coach-reviewed change-request flow.
            </p>
          </Card>

          {/* Training category — set at onboarding, change via coach review */}
          <CategoryCard currentCategory={currentCategory} pendingRequest={pendingRequest} />

          <Card className="bg-surface border-border p-6">
            <h2 className="text-text mb-4 text-xl font-semibold tracking-tight">Billing</h2>
            <p className="text-text-muted text-sm">
              Stripe checkout, plan upgrades, and downgrades land in SP-3.
            </p>
          </Card>
        </div>

        <RightRail>
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text mb-4 font-semibold tracking-tight">Quick Preferences</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-text text-sm">Dark Mode</span>
                <Switch defaultChecked disabled />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-text text-sm">Metric Units</span>
                <Switch defaultChecked disabled />
              </div>
            </div>
            <p className="text-text-dim mt-3 text-xs">Preferences become editable in SP-2.</p>
          </Card>

          <Card className="bg-surface border-border p-5">
            <h3 className="text-text mb-3 font-semibold tracking-tight">Coach Support</h3>
            <p className="text-text-muted mb-3 text-xs">
              Book a 1:1 call or send a message anytime you need guidance.
            </p>
            <a
              href={env.NEXT_PUBLIC_COACH_CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-hover text-text rounded-card border-border hover:border-accent flex w-full items-center justify-center gap-2 border py-2 text-center text-sm font-medium"
            >
              <Calendar className="h-4 w-4" />
              Schedule a call
            </a>
          </Card>
        </RightRail>
      </div>
    </>
  );
}
