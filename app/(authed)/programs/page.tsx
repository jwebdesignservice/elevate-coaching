import Link from 'next/link';
import { Lock, LayoutList } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { hasPlanAtLeast, type PlanTier } from '@/lib/plans';

export const metadata = { title: 'Programmes · Elevate Coaching' };

type ProgramRow = { id: string; title: string; description: string | null; cover_image_url: string | null; category: string | null; plan_access: string; status: string };
type EnrolmentRow = { program_id: string };

export default async function ProgramsPage() {
  const { profile } = await requireUser();
  const supabase = await createSupabaseServerClient();
  const tier = (profile.subscription_tier as PlanTier) ?? 'free';

  const [programsRes, enrolmentsRes] = await Promise.all([
    supabase.from('programs').select('id, title, description, cover_image_url, category, plan_access, status').eq('status', 'active').order('created_at'),
    supabase.from('user_program_enrollments').select('program_id').eq('user_id', profile.id),
  ]);

  const programs = (programsRes.data ?? []) as ProgramRow[];
  const enrolledIds = new Set(((enrolmentsRes.data ?? []) as EnrolmentRow[]).map((e) => e.program_id));
  // Coaches see all programmes (for management/preview); users see only their category.
  const isCoach = profile.role === 'coach';
  const accessible = isCoach
    ? programs
    : programs.filter((p) => !profile.category || !p.category || p.category === profile.category);

  return (
    <>
      <TopBar title="Programmes" subtitle="Your training journeys" userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        {accessible.length === 0 && <p className="text-text-muted py-12 text-center">No programmes available yet.</p>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {accessible.map((p) => {
            const canAccess = hasPlanAtLeast(tier, p.plan_access as PlanTier);
            const enrolled = enrolledIds.has(p.id);
            return (
              <Link key={p.id} href={`/programs/${p.id}`}>
                <Card className={`bg-surface border-border group flex h-full flex-col gap-3 overflow-hidden p-5 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl hover:shadow-black/20 ${canAccess ? 'hover:border-accent/40' : 'opacity-70'}`}>
                  {p.cover_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.cover_image_url} alt={p.title} className="h-32 w-full rounded-sm object-cover" />
                  ) : (
                    <div className="bg-muted flex h-32 w-full items-center justify-center rounded-sm"><LayoutList className="text-text-dim h-8 w-8" /></div>
                  )}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-text font-semibold leading-snug">{p.title}</h3>
                    {!canAccess && <Lock className="text-text-dim mt-0.5 h-4 w-4 shrink-0" />}
                  </div>
                  {p.description && <p className="text-text-muted line-clamp-2 text-sm">{p.description}</p>}
                  <div className="mt-auto flex items-center gap-2">
                    {enrolled && <span className="bg-accent/15 text-accent rounded-full px-2 py-0.5 text-[10px] font-semibold">Enrolled</span>}
                    {!canAccess && <span className="bg-muted text-text-muted rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize">{p.plan_access}+ plan</span>}
                    {p.category && <span className="bg-muted text-text-dim rounded-full px-2 py-0.5 text-[10px]">Cat {p.category}</span>}
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </>
  );
}
