'use client';

import { useActionState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ProgramFormState = { status: 'idle' | 'error' | 'success'; error: string | null };
export const programFormInitialState: ProgramFormState = { status: 'idle', error: null };

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

interface ProgramFormProps {
  action: (prev: ProgramFormState, formData: FormData) => Promise<ProgramFormState>;
  defaultValues?: { title?: string; description?: string; cover_image_url?: string; category?: string; plan_access?: string; status?: string };
  submitLabel?: string;
}

export function ProgramForm({ action, defaultValues, submitLabel = 'Create programme' }: ProgramFormProps) {
  const [state, formAction, isPending] = useActionState<ProgramFormState, FormData>(action, programFormInitialState);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="bg-surface border-border p-6 space-y-5">
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Title <span className="text-destructive">*</span></label>
          <input name="title" required defaultValue={defaultValues?.title} className={INPUT} placeholder="e.g. 12-Week Hybrid Performance" />
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
          <textarea name="description" rows={3} defaultValue={defaultValues?.description} className={INPUT} />
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Cover image URL</label>
          <input name="cover_image_url" type="url" defaultValue={defaultValues?.cover_image_url} className={INPUT} placeholder="https://…" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Category</label>
            <select name="category" defaultValue={defaultValues?.category ?? ''} className={INPUT}>
              <option value="">All categories</option>
              <option value="A">A — Strength</option>
              <option value="B">B — Hybrid</option>
              <option value="C">C — Conditioning</option>
              <option value="D">D — Beginner</option>
            </select>
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Plan access</label>
            <select name="plan_access" defaultValue={defaultValues?.plan_access ?? 'free'} className={INPUT}>
              <option value="free">Free</option>
              <option value="basic">Basic+</option>
              <option value="pro">Pro only</option>
            </select>
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Status</label>
            <select name="status" defaultValue={defaultValues?.status ?? 'draft'} className={INPUT}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
          </div>
        </div>
      </Card>

      {state.status === 'error' && state.error && (
        <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <X className="h-3.5 w-3.5 shrink-0" />{state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60">
          {isPending ? 'Saving…' : submitLabel}{!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
