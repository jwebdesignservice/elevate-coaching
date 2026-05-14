import Link from 'next/link';
import { ChevronLeft, Plus, Pencil, Sparkles, LayoutList, Calendar, Dumbbell, CheckCircle2 } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Programmes · Admin · Elevate Coaching' };

type ProgramRow = {
  id: string;
  title: string;
  description: string | null;
  cover_image_url: string | null;
  category: string | null;
  plan_access: string;
  status: string;
  program_weeks: { id: string; program_sessions: { id: string }[] }[];
};

export default async function AdminProgramsPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = supabase as any;
  const { data: raw } = await (sb
    .from('programs')
    .select('id, title, description, cover_image_url, category, plan_access, status, program_weeks(id, program_sessions(id))')
    .order('created_at', { ascending: false }) as Promise<{ data: ProgramRow[] | null; error: unknown }>);

  const programs = (raw ?? []) as ProgramRow[];
  const activeCount = programs.filter((p) => p.status === 'active').length;
  const draftCount = programs.filter((p) => p.status === 'draft').length;
  const totalSessions = programs.reduce(
    (sum, p) => sum + (p.program_weeks ?? []).reduce((s, w) => s + (w.program_sessions?.length ?? 0), 0),
    0,
  );

  return (
    <>
      <TopBar
        title="Programmes"
        subtitle={`${programs.length} programme${programs.length !== 1 ? 's' : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="space-y-8 p-4 sm:p-6 lg:p-8">
        <Link href="/admin" className="text-text-muted hover:text-text inline-flex items-center gap-1 text-sm">
          <ChevronLeft className="h-4 w-4" />Coach console
        </Link>

        {/* Hero */}
        <section className="flex flex-wrap items-end justify-between gap-3">
          <div className="space-y-2">
            <p className="text-text-dim text-xs font-medium uppercase tracking-[0.18em]">
              <Sparkles className="mr-1.5 inline h-3 w-3" />
              Programmes
            </p>
            <h1 className="text-text text-3xl font-bold tracking-tight sm:text-4xl">
              Author training journeys.
            </h1>
            <p className="text-text-muted max-w-xl text-sm">
              Each programme is a week-by-week journey. Publish to make it visible in the member library.
            </p>
          </div>
          <Link
            href="/admin/programs/new"
            className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent' })}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            New programme
          </Link>
        </section>

        {/* Stats */}
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile icon={LayoutList}    value={programs.length} label="Total" />
          <StatTile icon={CheckCircle2}  value={activeCount}     label="Active" />
          <StatTile icon={Calendar}      value={draftCount}      label="Drafts" />
          <StatTile icon={Dumbbell}      value={totalSessions}   label="Sessions" />
        </section>

        {/* Grid */}
        <section className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2 className="text-text text-lg font-semibold">All programmes</h2>
            <span className="text-text-dim text-xs">Click any card to edit</span>
          </div>

          {programs.length === 0 ? (
            <Card className="bg-surface border-border p-12 text-center">
              <LayoutList className="text-text-dim mx-auto h-8 w-8" />
              <p className="text-text-muted mt-3 text-sm">No programmes yet — author the first one.</p>
              <Link
                href="/admin/programs/new"
                className={buttonVariants({ className: 'bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent mt-4 inline-flex' })}
              >
                <Plus className="mr-1 h-4 w-4" />Create programme
              </Link>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {programs.map((p) => {
                const weekCount = p.program_weeks?.length ?? 0;
                const sessionCount = (p.program_weeks ?? []).reduce((s, w) => s + (w.program_sessions?.length ?? 0), 0);
                const isActive = p.status === 'active';
                return (
                  <Link key={p.id} href={`/admin/programs/${p.id}/edit`}>
                    <Card className="bg-surface border-border hover:border-accent/40 group relative flex h-full flex-col overflow-hidden p-0 transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40">
                      <div className="relative h-40 overflow-hidden transform-gpu">
                        {p.cover_image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={p.cover_image_url}
                            alt={p.title}
                            className="absolute inset-0 block h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <div className="bg-muted absolute inset-0 flex items-center justify-center">
                            <LayoutList className="text-text-dim h-8 w-8" />
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-surface via-surface/10 to-transparent" />
                        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
                          {p.category && (
                            <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                              Cat {p.category}
                            </span>
                          )}
                          <span className="bg-black/60 text-white backdrop-blur-sm rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                            {p.plan_access === 'free' ? 'Free' : `${p.plan_access}+`}
                          </span>
                        </div>
                        <span className={`absolute right-3 top-3 rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                          isActive
                            ? 'bg-accent text-accent-fg'
                            : 'bg-black/60 text-white backdrop-blur-sm'
                        }`}>
                          {isActive ? 'Live' : 'Draft'}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 p-5">
                        <h3 className="text-text text-lg font-bold leading-snug transition-colors group-hover:text-accent/90">
                          {p.title}
                        </h3>
                        {p.description && (
                          <p className="text-text-muted line-clamp-2 text-sm leading-relaxed">{p.description}</p>
                        )}
                        <div className="mt-auto flex items-center justify-between pt-2">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-text-muted flex items-center gap-1">
                              <Calendar className="text-text-dim h-3 w-3" />
                              {weekCount}w
                            </span>
                            <span className="text-text-muted flex items-center gap-1">
                              <Dumbbell className="text-text-dim h-3 w-3" />
                              {sessionCount}
                            </span>
                          </div>
                          <span className="text-accent group-hover:text-accent/80 flex items-center gap-1 text-xs font-semibold">
                            <Pencil className="h-3 w-3" />
                            Edit
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function StatTile({ icon: Icon, value, label }: { icon: React.ComponentType<{ className?: string }>; value: number | string; label: string }) {
  return (
    <div className="bg-surface border-border flex flex-col gap-1 rounded-md border p-3">
      <Icon className="text-accent h-4 w-4" />
      <span className="text-text text-2xl font-bold leading-none">{value}</span>
      <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">{label}</span>
    </div>
  );
}
