import Link from 'next/link';
import { ChevronLeft, Plus, Pencil } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Exercises · Admin · Elevate Coaching' };

type ExerciseRow = { id: string; title: string; muscle_groups: string[]; tags: string[] };

export default async function AdminExercisesPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase.from('exercises').select('id, title, muscle_groups, tags').order('title');
  const exercises = (raw ?? []) as ExerciseRow[];

  return (
    <>
      <TopBar title="Exercises" subtitle={`${exercises.length} exercise${exercises.length !== 1 ? 's' : ''} in library`} userTier={profile.subscription_tier} userName={profile.name} />
      <div className="p-4 sm:p-6 lg:p-8">
        <Link
          href="/admin"
          className="text-text-muted hover:text-text mb-6 inline-flex items-center gap-1 text-sm"
        >
          <ChevronLeft className="h-4 w-4" />Back to admin
        </Link>
        <div className="mb-4 flex justify-end">
          <Link href="/admin/exercises/new" className={buttonVariants()}><Plus className="mr-1 h-4 w-4" />New Exercise</Link>
        </div>
        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Title</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Muscle groups</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Tags</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {exercises.length === 0 && (
                <tr><td colSpan={4} className="text-text-muted px-4 py-8 text-center">No exercises yet. Create the first one.</td></tr>
              )}
              {exercises.map((ex) => (
                <tr key={ex.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">{ex.title}</td>
                  <td className="text-text-muted px-4 py-3">{ex.muscle_groups.join(', ') || '—'}</td>
                  <td className="text-text-muted px-4 py-3">{ex.tags.join(', ') || '—'}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/exercises/${ex.id}/edit`} className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium">
                      <Pencil className="h-3 w-3" />Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </>
  );
}
