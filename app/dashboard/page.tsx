import { requireUser } from '@/lib/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'Dashboard · Elevate Coaching',
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

export default async function DashboardPage() {
  const { profile } = await requireUser();

  return (
    <main className="bg-background text-text min-h-screen px-4 py-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <header className="flex flex-col gap-2">
          <h1 className="text-accent font-heading text-3xl font-semibold tracking-tight">
            Welcome, {profile.name || 'there'}
          </h1>
          <p className="text-text-muted text-sm">
            This is a placeholder dashboard. The full experience lands in Task 36.
          </p>
        </header>

        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="text-text font-heading text-lg">Your account</CardTitle>
            <CardDescription className="text-text-muted">
              Snapshot of your Elevate Coaching profile.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">Subscription</span>
              <Badge variant="outline" className="border-accent/40 text-accent bg-accent/10">
                {TIER_LABEL[profile.subscription_tier] ?? profile.subscription_tier}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">Role</span>
              <Badge variant="outline" className="border-border text-text">
                {ROLE_LABEL[profile.role] ?? profile.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-text-muted text-sm">Email</span>
              <span className="text-text text-sm">{profile.email}</span>
            </div>
          </CardContent>
        </Card>

        <form action="/sign-out" method="post" className="flex justify-end">
          <Button
            type="submit"
            variant="outline"
            className="border-border text-text hover:bg-surface-hover h-10"
          >
            Sign out
          </Button>
        </form>
      </div>
    </main>
  );
}
