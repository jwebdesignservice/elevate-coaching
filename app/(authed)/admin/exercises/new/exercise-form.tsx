'use client';

import { useActionState } from 'react';
import { ArrowRight, X, Type, Video, Target, Tag } from 'lucide-react';
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
    <form action={formAction} className="space-y-5">
      {/* Basics */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Type className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Basics</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input name="title" required defaultValue={defaultValues?.title} className={INPUT} placeholder="e.g. Back Squat" />
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              name="description"
              rows={4}
              defaultValue={defaultValues?.description}
              className={INPUT}
              placeholder="Cues, technique notes, common mistakes to avoid…"
            />
            <p className="text-text-dim mt-1 text-xs">Shown on the exercise detail page. Markdown not supported.</p>
          </div>
        </div>
      </Card>

      {/* Media */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Video className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Media</h3>
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Video tutorial URL</label>
          <input
            name="video_url"
            type="url"
            defaultValue={defaultValues?.video_url}
            className={INPUT}
            placeholder="https://youtube.com/watch?v=…"
          />
          <p className="text-text-dim mt-1 text-xs">Opens in a new tab. YouTube, Vimeo, or any direct link.</p>
        </div>
      </Card>

      {/* Muscle groups */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Target className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Muscle groups</h3>
        </div>
        <p className="text-text-muted mb-3 text-xs">Select all the major muscles this exercise targets.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {MUSCLE_GROUPS.map((mg) => {
            const checked = defaultValues?.muscle_groups?.includes(mg);
            return (
              <label
                key={mg}
                className={`bg-muted/30 border-border hover:border-accent/40 has-[:checked]:border-accent has-[:checked]:bg-accent/10 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors`}
              >
                <input
                  type="checkbox"
                  name="muscle_groups"
                  value={mg}
                  defaultChecked={checked}
                  className="accent-accent shrink-0"
                />
                <span className="text-text">{mg}</span>
              </label>
            );
          })}
        </div>
      </Card>

      {/* Tags */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Tag className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Tags</h3>
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">
            Tags <span className="text-text-dim text-xs font-normal">(comma-separated)</span>
          </label>
          <input
            name="tags"
            defaultValue={defaultValues?.tags}
            className={INPUT}
            placeholder="compound, barbell, lower-body, push"
          />
          <p className="text-text-dim mt-1 text-xs">
            Reserved keywords power the auto-detected badges: <code>compound</code>/<code>isolation</code>/<code>accessory</code>{' '}
            · <code>barbell</code>/<code>dumbbell</code>/<code>cable</code>/<code>machine</code> · <code>push</code>/<code>pull</code>/<code>unilateral</code>.
          </p>
        </div>
      </Card>

      {state.status === 'error' && state.error && (
        <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <X className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent"
        >
          {isPending ? 'Saving…' : submitLabel}
          {!isPending && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>

    </form>
  );
}
