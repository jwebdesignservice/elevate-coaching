import { requireUser } from '@/lib/auth';
import { Dumbbell, Flame, Target, TrendingUp } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { RightRail } from '@/components/layout/RightRail';
import { HeroCard } from '@/components/branded/HeroCard';
import { StatCard } from '@/components/branded/StatCard';
import { Card } from '@/components/ui/card';
import { env } from '@/lib/env';

export const metadata = {
  title: 'Dashboard · Elevate Coaching',
};

export default async function DashboardPage() {
  const { profile } = await requireUser();
  // `name` is a single column on the profile; first word is good enough for
  // a greeting. Onboarding + full profile editing ship in SP-2.
  const firstName = profile.name?.split(' ')[0]?.trim() || 'there';

  return (
    <>
      <TopBar
        title={`Welcome back, ${firstName}`}
        subtitle="Ready to elevate your performance today?"
        userTier={profile.subscription_tier}
        userName={profile.name}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 space-y-6 overflow-y-auto p-8">
          {/* Hero — replaced by real program data in SP-5 */}
          <HeroCard
            eyebrow="Current Program"
            title="No program assigned yet"
            meta="Your coach will assign your first program shortly. In the meantime, set up your profile from settings."
            progressPct={0}
            primaryCta={{ label: 'Learn more', href: '/settings' }}
          />

          {/* Stat cards — placeholders, real data lands in SP-4 */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard
              icon={<TrendingUp className="h-4 w-4" />}
              label="Weekly Progress"
              value="—"
              delta="Coming soon"
            />
            <StatCard
              icon={<Dumbbell className="h-4 w-4" />}
              label="Workouts Completed"
              value="0"
            />
            <StatCard
              icon={<Flame className="h-4 w-4" />}
              label="Active Streak"
              value="0"
              delta="days"
            />
            <StatCard icon={<Target className="h-4 w-4" />} label="Current Program" value="—" />
          </div>

          {/* Video Tutorials placeholder — SP-6 will fill */}
          <Card className="bg-surface border-border p-6">
            <h2 className="text-text mb-4 text-xl font-semibold tracking-tight">Video Tutorials</h2>
            <p className="text-text-muted text-sm">
              Your tutorial library appears here when SP-6 ships.
            </p>
          </Card>
        </div>

        <RightRail>
          {/* Quick Tips — Path A placeholder, content lands in SP-2 */}
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text mb-3 font-semibold tracking-tight">Quick Tips</h3>
            <p className="text-text-muted text-sm">
              Personalized form cues and recovery tips appear here once your coach assigns a
              program.
            </p>
          </Card>

          {/* Coach Support — always available */}
          <Card className="bg-surface border-border p-5">
            <h3 className="text-text mb-3 font-semibold tracking-tight">Coach Support</h3>
            <p className="text-text-muted mb-3 text-xs">
              Book a 1:1 call or send a message anytime you need guidance.
            </p>
            <a
              href={env.NEXT_PUBLIC_COACH_CALENDLY}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-surface-hover text-text rounded-card border-border hover:border-accent block w-full border py-2 text-center text-sm font-medium"
            >
              Schedule a call
            </a>
          </Card>
        </RightRail>
      </div>
    </>
  );
}
