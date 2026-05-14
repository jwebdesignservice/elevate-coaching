'use client';

import { useActionState, useState } from 'react';
import { Check, Save, TrendingUp, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { updateExerciseRecordAction, exerciseRecordInitialState, type ExerciseRecordState } from './actions';

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-base font-semibold outline-none transition-colors';

const FIELDS = [
  { name: 'one_rm_kg',    label: '1 rep max',        hint: 'Heaviest single rep',    accent: true },
  { name: 'five_rm_kg',   label: '5-6 rep max',     hint: 'Strength range',          accent: false },
  { name: 'twelve_rm_kg', label: '10-12 rep max',   hint: 'Hypertrophy range',       accent: false },
] as const;

type FieldName = (typeof FIELDS)[number]['name'];

interface Props {
  exerciseId: string;
  exerciseTitle: string;
  defaults: { one_rm_kg: number | null; five_rm_kg: number | null; twelve_rm_kg: number | null };
  variant?: 'detail' | 'settings';
}

export function ExerciseRecordCard({ exerciseId, exerciseTitle, defaults, variant = 'detail' }: Props) {
  const action = updateExerciseRecordAction.bind(null, exerciseId);
  const [state, formAction, pending] = useActionState<ExerciseRecordState, FormData>(action, exerciseRecordInitialState);
  const [values, setValues] = useState<Record<FieldName, string>>({
    one_rm_kg:    defaults.one_rm_kg    != null ? String(defaults.one_rm_kg)    : '',
    five_rm_kg:   defaults.five_rm_kg   != null ? String(defaults.five_rm_kg)   : '',
    twelve_rm_kg: defaults.twelve_rm_kg != null ? String(defaults.twelve_rm_kg) : '',
  });

  const compact = variant === 'settings';

  return (
    <Card className={`bg-surface border-border ${compact ? 'p-4' : 'p-5 sm:p-6'}`}>
      {!compact && (
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="text-accent h-4 w-4" />
            <h3 className="text-text font-semibold">Your records</h3>
          </div>
          <span className="text-text-dim text-[10px] font-bold uppercase tracking-wider">All weights in kg</span>
        </div>
      )}
      {compact && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h4 className="text-text text-sm font-semibold">{exerciseTitle}</h4>
          <span className="text-text-dim text-[10px] font-medium uppercase tracking-wider">kg</span>
        </div>
      )}

      <form action={formAction} className="space-y-3">
        <div className={`grid gap-3 ${compact ? 'grid-cols-3' : 'sm:grid-cols-3'}`}>
          {FIELDS.map((f) => (
            <div key={f.name}>
              <label className="text-text-dim mb-1 block text-[10px] font-bold uppercase tracking-wider">
                {f.label}
              </label>
              <div className="relative">
                <input
                  name={f.name}
                  type="number"
                  min="0"
                  step="0.5"
                  value={values[f.name]}
                  onChange={(e) => setValues((v) => ({ ...v, [f.name]: e.target.value }))}
                  className={`${INPUT} ${f.accent && values[f.name] ? 'text-accent' : ''}`}
                  placeholder="—"
                />
                <span className="text-text-dim pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">kg</span>
              </div>
              {!compact && <p className="text-text-dim mt-1 text-[10px]">{f.hint}</p>}
            </div>
          ))}
        </div>

        {state.status === 'error' && state.error && (
          <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-xs">
            <X className="h-3 w-3 shrink-0" />
            {state.error}
          </p>
        )}
        {state.status === 'success' && state.message && (
          <p role="status" className="text-accent flex items-center gap-1.5 text-xs">
            <Check className="h-3.5 w-3.5" />
            {state.message}
          </p>
        )}

        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={pending}
            className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent"
          >
            {pending ? 'Saving…' : (
              <>
                <Save className="mr-1.5 h-3.5 w-3.5" />
                Save
              </>
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
