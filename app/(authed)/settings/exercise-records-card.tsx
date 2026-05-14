'use client';

import { useState } from 'react';
import Link from 'next/link';
import { TrendingUp, Search, ArrowRight, Dumbbell } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ExerciseRecordCard } from '../exercises/exercise-record-card';

type ExerciseLite = { id: string; title: string };
type RecordRow = { exercise_id: string; one_rm_kg: number | null; five_rm_kg: number | null; twelve_rm_kg: number | null };

interface Props {
  exercises: ExerciseLite[];
  records: RecordRow[];
}

export function ExerciseRecordsSection({ exercises, records }: Props) {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  const recordByExercise = new Map(records.map((r) => [r.exercise_id, r]));
  const tracked = exercises.filter((ex) => recordByExercise.has(ex.id));
  const untracked = exercises.filter((ex) => !recordByExercise.has(ex.id));

  const q = query.trim().toLowerCase();
  const filterMatch = (ex: ExerciseLite) => !q || ex.title.toLowerCase().includes(q);

  const visibleTracked = tracked.filter(filterMatch);
  const visibleUntracked = untracked.filter(filterMatch);
  const showUntracked = showAll || q.length > 0;

  return (
    <Card className="bg-surface border-border p-5 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="text-accent h-4 w-4" />
            <h2 className="text-text text-xl font-semibold tracking-tight">Exercise records</h2>
          </div>
          <p className="text-text-muted mt-1 text-sm">
            Track your 1 rep max, 5-6 rep max and 10-12 rep max for any exercise. Updates to the main lifts (squat / bench / deadlift / OHP) also sync to your training weights.
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="bg-background border-border focus-within:border-accent/40 mb-4 flex items-center gap-2 rounded-md border px-3 py-2 transition-colors">
        <Search className="text-text-dim h-3.5 w-3.5 shrink-0" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises…"
          className="text-text placeholder:text-text-dim w-full bg-transparent text-sm outline-none"
        />
      </div>

      {/* Tracked records */}
      {visibleTracked.length > 0 && (
        <div className="space-y-3">
          <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider">
            Tracked ({visibleTracked.length})
          </p>
          {visibleTracked.map((ex) => {
            const rec = recordByExercise.get(ex.id);
            return (
              <ExerciseRecordCard
                key={ex.id}
                exerciseId={ex.id}
                exerciseTitle={ex.title}
                defaults={{
                  one_rm_kg: rec?.one_rm_kg ?? null,
                  five_rm_kg: rec?.five_rm_kg ?? null,
                  twelve_rm_kg: rec?.twelve_rm_kg ?? null,
                }}
                variant="settings"
              />
            );
          })}
        </div>
      )}

      {/* Empty state — no tracked records */}
      {tracked.length === 0 && !showUntracked && (
        <div className="bg-muted/30 border-border border-dashed rounded-md border p-6 text-center">
          <Dumbbell className="text-text-dim mx-auto h-6 w-6" />
          <p className="text-text mt-2 text-sm font-medium">No records yet</p>
          <p className="text-text-muted mt-1 text-xs">
            Add your first 1RM or rep-max below — or visit any exercise page to log it there.
          </p>
        </div>
      )}

      {/* Untracked exercises — quick add */}
      {showUntracked && visibleUntracked.length > 0 && (
        <div className="border-border mt-5 space-y-3 border-t pt-5">
          <p className="text-text-dim text-[10px] font-bold uppercase tracking-wider">
            {tracked.length > 0 ? 'Other exercises' : 'Add your first record'} ({visibleUntracked.length})
          </p>
          {visibleUntracked.map((ex) => (
            <ExerciseRecordCard
              key={ex.id}
              exerciseId={ex.id}
              exerciseTitle={ex.title}
              defaults={{ one_rm_kg: null, five_rm_kg: null, twelve_rm_kg: null }}
              variant="settings"
            />
          ))}
        </div>
      )}

      {/* Show all toggle */}
      {!showUntracked && untracked.length > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="bg-muted/40 hover:bg-muted/60 text-text-muted hover:text-text mt-4 flex w-full items-center justify-center gap-1.5 rounded-md border border-border py-2.5 text-sm font-medium transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5" />
          Show {untracked.length} more {untracked.length === 1 ? 'exercise' : 'exercises'} to track
        </button>
      )}

      {/* Visit library hint */}
      <p className="text-text-dim mt-4 text-xs">
        Prefer to log inline? Open any exercise from{' '}
        <Link href="/exercises" className="text-accent hover:underline">your library</Link>.
      </p>
    </Card>
  );
}
