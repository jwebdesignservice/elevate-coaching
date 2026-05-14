'use client';

import { useActionState } from 'react';
import { ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ExerciseFormState = { status: 'idle' | 'error' | 'success'; error: string | null };
export const exerciseFormInitialState: ExerciseFormState = { status: 'idle', error: null };

const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps',
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body',
];

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

interface ExerciseFormProps {
  action: (prev: ExerciseFormState, formData: FormData) => Promise<ExerciseFormState>;
  defaultValues?: { title?: string; description?: string; video_url?: string; muscle_groups?: string[]; tags?: string };
  submitLabel?: string;
}

export function ExerciseForm({ action, defaultValues, submitLabel = 'Create exercise' }: ExerciseFormProps) {
  const [state, formAction, isPending] = useActionState<ExerciseFormState, FormData>(action, exerciseFormInitialState);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="bg-surface border-border p-6 space-y-5">
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Title <span className="text-destructive">*</span></label>
          <input name="title" required defaultValue={defaultValues?.title} className={INPUT} placeholder="e.g. Back Squat" />
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
          <textarea name="description" rows={4} defaultValue={defaultValues?.description} className={INPUT} placeholder="Cues, technique notes…" />
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Video URL</label>
          <input name="video_url" type="url" defaultValue={defaultValues?.video_url} className={INPUT} placeholder="https://youtube.com/…" />
        </div>
        <div>
          <p className="text-text mb-2 text-sm font-medium">Muscle groups</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {MUSCLE_GROUPS.map((mg) => (
              <label key={mg} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="muscle_groups" value={mg} defaultChecked={defaultValues?.muscle_groups?.includes(mg)} className="accent-accent" />
                <span className="text-text-muted">{mg}</span>
              </label>
            ))}
          </div>
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Tags <span className="text-text-dim text-xs font-normal">(comma-separated)</span></label>
          <input name="tags" defaultValue={defaultValues?.tags} className={INPUT} placeholder="compound, push, lower" />
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
