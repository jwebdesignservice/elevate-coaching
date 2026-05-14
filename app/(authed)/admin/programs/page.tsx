import Link from 'next/link';
import { Plus, Pencil } from 'lucide-react';
import { requireCoach } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { TopBar } from '@/components/layout/TopBar';
import { Card } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';

export const metadata = { title: 'Programmes · Admin · Elevate Coaching' };

const STATUS_LABEL: Record<string, string> = { draft: 'Draft', active: 'Active' };

type ProgramRow = { id: string; title: string; category: string | null; plan_access: string; status: string };

export default async function AdminProgramsPage() {
  const { profile } = await requireCoach();
  const supabase = await createSupabaseServerClient();

  const { data: raw } = await supabase
    .from('programs')
    .select('id, title, category, plan_access, status')
    .order('created_at', { ascending: false });

  const programs = (raw ?? []) as ProgramRow[];

  return (
    <>
      <TopBar
        title="Programmes"
        subtitle={`${programs.length} programme${programs.length !== 1 ? 's' : ''}`}
        userTier={profile.subscription_tier}
        userName={profile.name}
      />
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mb-4 flex justify-end">
          <Link href="/admin/programs/new" className={buttonVariants()}>
            <Plus className="mr-1 h-4 w-4" />New Programme
          </Link>
        </div>
        <Card className="bg-surface border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-border border-b">
                <th className="text-text-muted px-4 py-3 text-left font-medium">Title</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Category</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Plan</th>
                <th className="text-text-muted px-4 py-3 text-left font-medium">Status</th>
                <th className="w-16 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 && (
                <tr><td colSpan={5} className="text-text-muted px-4 py-8 text-center">No programmes yet.</td></tr>
              )}
              {programs.map((p) => (
                <tr key={p.id} className="border-border border-b last:border-0">
                  <td className="text-text px-4 py-3 font-medium">{p.title}</td>
                  <td className="text-text-muted px-4 py-3">{p.category ?? 'All'}</td>
                  <td className="text-text-muted px-4 py-3 capitalize">{p.plan_access}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.status === 'active' ? 'bg-accent/15 text-accent' : 'bg-muted text-text-muted'
                    }`}>
                      {STATUS_LABEL[p.status] ?? p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/programs/${p.id}/edit`} className="text-accent hover:text-accent/80 inline-flex items-center gap-1 text-xs font-medium">
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
