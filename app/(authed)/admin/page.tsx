import Link from 'next/link';
import { Dumbbell, LayoutList } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { requireCoach } from '@/lib/auth';

export const metadata = { title: 'Admin · Elevate Coaching' };

const tiles = [
  { href: '/admin/exercises', Icon: Dumbbell, title: 'Exercises', description: 'Create and manage the global exercise library.' },
  { href: '/admin/programs', Icon: LayoutList, title: 'Programmes', description: 'Build and publish training programmes.' },
];

export default async function AdminPage() {
  const { profile } = await requireCoach();

  return (
    <>
      <TopBar title="Admin" subtitle="Coach control panel" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map(({ href, Icon, title, description }) => (
            <Link key={href} href={href}>
              <Card className="bg-surface border-border hover:border-accent/40 flex items-start gap-4 p-6 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20">
                <div className="bg-accent/15 rounded-md p-2">
                  <Icon className="text-accent h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-text font-semibold">{title}</h2>
                  <p className="text-text-muted mt-1 text-sm">{description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
