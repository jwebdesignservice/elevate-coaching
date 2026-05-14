'use client';

import { useActionState, useState } from 'react';
import { ArrowRight, Check, Dumbbell, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { calcWeight } from '@/lib/lifts';
import { updateMaxLiftsAction } from './actions';

type LState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };
const INIT: LState = { status: 'idle', error: null, message: null };

const LIFTS = [
  { key: 'max_lift_squat' as const, label: 'Back Squat', liftKey: 'squat' },
  { key: 'max_lift_bench' as const, label: 'Bench Press', liftKey: 'bench' },
  { key: 'max_lift_deadlift' as const, label: 'Deadlift', liftKey: 'deadlift' },
  { key: 'max_lift_ohp' as const, label: 'Overhead Press', liftKey: 'ohp' },
];

type MaxLiftVals = { max_lift_squat: number | null; max_lift_bench: number | null; max_lift_deadlift: number | null; max_lift_ohp: number | null };

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

export function MaxLiftsCard({ defaults }: { defaults: MaxLiftVals }) {
  const [state, formAction, isPending] = useActionState<LState, FormData>(updateMaxLiftsAction, INIT);
  const [vals, setVals] = useState<Record<string, string>>({
    max_lift_squat: String(defaults.max_lift_squat ?? ''),
    max_lift_bench: String(defaults.max_lift_bench ?? ''),
    max_lift_deadlift: String(defaults.max_lift_deadlift ?? ''),
    max_lift_ohp: String(defaults.max_lift_ohp ?? ''),
  });

  return (
    <Card className="bg-surface border-border space-y-5 p-6">
      <div>
        <h2 className="text-text text-xl font-semibold tracking-tight">Performance Baselines</h2>
        <p className="text-text-muted mt-1 text-sm">Your 1-rep max lifts. Used to auto-calculate training weights.</p>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {LIFTS.map(({ key, label, liftKey }) => {
            const num = parseFloat(vals[key]);
            const maxLifts = {
              max_lift_squat: key === 'max_lift_squat' ? (isNaN(num) ? null : num) : null,
              max_lift_bench: key === 'max_lift_bench' ? (isNaN(num) ? null : num) : null,
              max_lift_deadlift: key === 'max_lift_deadlift' ? (isNaN(num) ? null : num) : null,
              max_lift_ohp: key === 'max_lift_ohp' ? (isNaN(num) ? null : num) : null,
            };
            const preview = !isNaN(num) && num > 0 ? calcWeight(75, liftKey, maxLifts) : null;
            return (
              <div key={key}>
                <label className="text-text mb-1.5 block text-sm font-medium">{label}</label>
                <div className="relative">
                  <input
                    name={key}
                    type="number"
                    min="0"
                    step="0.5"
                    value={vals[key]}
                    onChange={(e) => setVals((v) => ({ ...v, [key]: e.target.value }))}
                    className={INPUT}
                    placeholder="kg"
                  />
                  <span className="text-text-dim pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">kg</span>
                </div>
                {preview && <p className="text-accent mt-1 text-xs">75% → {preview.split('→')[1]?.trim()}</p>}
              </div>
            );
          })}
        </div>
        {state.status === 'error' && state.error && (
          <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><X className="h-3.5 w-3.5 shrink-0" />{state.error}</p>
        )}
        {state.status === 'success' && state.message && (
          <p role="status" className="text-accent flex items-center gap-2 text-sm"><Check className="h-4 w-4" />{state.message}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60">
            {isPending ? 'Saving…' : 'Save lifts'}{!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </form>
      <p className="text-text-dim text-xs"><Dumbbell className="mr-1 inline h-3 w-3" />Session views use these values to show auto-calculated working weights.</p>
    </Card>
  );
}
