import { Calendar } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { env } from '@/lib/env';
import type { Category } from '@/lib/categories';
import type { PlanTier } from '@/lib/plans';
import { CategoryCard } from './category-card';
import { SubscriptionCard } from './subscription-card';
import { ProfileEditCard } from './profile-edit-card';
import { MaxLiftsCard } from './max-lifts-card';
import { ExerciseRecordsSection } from './exercise-records-card';

export const metadata = {
  title: 'Settings · Elevate Coaching',
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const [pendingRowsRes, exercisesRes, recordsRes] = await Promise.all([
    supabase
      .from('category_change_requests')
      .select('id, requested_category, created_at')
      .eq('user_id', profile.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1),
    sb.from('exercises').select('id, title').order('title') as Promise<{ data: { id: string; title: string }[] | null; error: unknown }>,
    sb.from('user_exercise_records')
      .select('exercise_id, one_rm_kg, five_rm_kg, twelve_rm_kg')
      .eq('user_id', profile.id) as Promise<{ data: { exercise_id: string; one_rm_kg: number | null; five_rm_kg: number | null; twelve_rm_kg: number | null }[] | null; error: unknown }>,
  ]);
  const pendingRows = pendingRowsRes.data;
  const exerciseList = (exercisesRes.data ?? []) as { id: string; title: string }[];
  const recordList = (recordsRes.data ?? []) as { exercise_id: string; one_rm_kg: number | null; five_rm_kg: number | null; twelve_rm_kg: number | null }[];

  // Cast the row from the (under-inferred) Supabase chain — same pattern as
  // lib/auth.ts / app/onboarding/actions.ts.
  const pending = (pendingRows?.[0] ?? null) as {
    id: string;
    requested_category: Category;
    created_at: string;
  } | null;
  const pendingRequest = pending
    ? {
        id: pending.id,
        requestedCategory: pending.requested_category,
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
        <div className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <ProfileEditCard
            name={profile.name}
            email={profile.email}
            phone={(profile as { phone: string | null }).phone}
            avatarUrl={(profile as { avatar_url: string | null }).avatar_url}
            initials={initials}
          />

          {/* Training category — set at onboarding, change via coach review */}
          <CategoryCard currentCategory={currentCategory} pendingRequest={pendingRequest} />

          <MaxLiftsCard
            defaults={{
              max_lift_squat: profile.max_lift_squat,
              max_lift_bench: profile.max_lift_bench,
              max_lift_deadlift: profile.max_lift_deadlift,
              max_lift_ohp: profile.max_lift_ohp,
            }}
          />

          <ExerciseRecordsSection exercises={exerciseList} records={recordList} />

          <SubscriptionCard
            tier={(profile.subscription_tier as PlanTier) ?? 'free'}
            periodEnd={profile.subscription_period_end ?? null}
            cancelAtPeriodEnd={profile.subscription_cancel_at_period_end ?? false}
          />
        </div>

        <RightRail>
          <Card className="bg-surface border-border p-5 ">
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

          <Card className="bg-surface border-border p-5 ">
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
