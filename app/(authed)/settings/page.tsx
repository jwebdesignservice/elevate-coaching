import { Calendar } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { env } from '@/lib/env';

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
          <Card className="bg-surface border-border p-6">
            <h2 className="text-text mb-4 text-lg font-semibold">Profile</h2>
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4">
              <div>
                <dt className="text-text-dim text-xs tracking-wide uppercase">Full Name</dt>
                <dd className="text-text mt-1">{profile.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs tracking-wide uppercase">Email</dt>
                <dd className="text-text mt-1">{profile.email}</dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs tracking-wide uppercase">Plan</dt>
                <dd className="text-text mt-1">
                  {TIER_LABEL[profile.subscription_tier] ?? profile.subscription_tier}
                </dd>
              </div>
              <div>
                <dt className="text-text-dim text-xs tracking-wide uppercase">Role</dt>
                <dd className="text-text mt-1">{ROLE_LABEL[profile.role] ?? profile.role}</dd>
              </div>
            </dl>
            <p className="text-text-dim mt-4 text-xs">
              Profile editing (name, avatar, max lifts, training category, goal focus) lands in
              SP-2.
            </p>
          </Card>

          <Card className="bg-surface border-border p-6">
            <h2 className="text-text mb-4 text-lg font-semibold">Billing</h2>
            <p className="text-text-muted text-sm">
              Stripe checkout, plan upgrades, and downgrades land in SP-3.
            </p>
          </Card>
        </div>

        <RightRail>
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text mb-3 font-medium">Quick Preferences</h3>
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
            <h3 className="text-text mb-3 font-medium">Coach Support</h3>
            <p className="text-text-muted mb-3 text-xs">
              Book a 1:1 call or send a message anytime you need guidance.
            </p>
            <a
              href={env.NEXT_PUBLIC_COACH_CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-hover text-text rounded-card border-border hover:border-accent flex w-full items-center justify-center gap-2 border py-2 text-center text-sm"
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
