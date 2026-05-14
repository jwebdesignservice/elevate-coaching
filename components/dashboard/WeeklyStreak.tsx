import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import type { DayRollup } from '@/lib/tasks';

interface WeeklyStreakProps {
  /** Monday of the week to render, ISO date (YYYY-MM-DD). */
  weekStartIso: string;
  /** User's local today, ISO date (YYYY-MM-DD). */
  todayIso: string;
  /** 90-day rollup from get_task_rollup, already `adjustedRollup`-processed. */
  rollup: DayRollup[];
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const;

/**
 * 7-day Mon–Sun strip with one dot per day (SP-5 spec §8).
 *
 * The "items" list that used to live in WeeklySchedule has been removed
 * entirely — this card is now a streak visualisation, not a training-session
 * schedule.
 *
 * Per-day dot:
 *   - filled mint           = perfect day (total > 0 && done === total)
 *   - outline mint          = partial (done > 0 && done < total)
 *   - faded outline         = rest day, pre-signup, future, or no completions yet
 */
export function WeeklyStreak({ weekStartIso, todayIso, rollup }: WeeklyStreakProps): ReactNode {
  const byDate = new Map(rollup.map((d) => [d.date, d]));
  const start = new Date(weekStartIso + 'T00:00:00');

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const day = byDate.get(iso) ?? { date: iso, total: 0, done: 0 };
    const isToday = iso === todayIso;
    const isPerfect = day.total > 0 && day.done === day.total;
    const isPartial = day.total > 0 && day.done > 0 && day.done < day.total;
    return {
      letter: DAY_LETTERS[i],
      date: d.getDate(),
      isToday,
      isPerfect,
      isPartial,
    };
  });

  return (
    <Card className="bg-surface border-border p-5">
      <h3 className="text-text mb-4 font-semibold tracking-tight">This Week</h3>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div
            key={i}
            className={`flex flex-col items-center gap-2 rounded-md py-2 ${
              d.isToday ? 'bg-accent text-accent-fg' : 'text-text-muted'
            }`}
          >
            <span className="text-[10px] font-semibold tracking-wide">{d.letter}</span>
            <span className="text-sm font-semibold">{d.date}</span>
            <span
              aria-hidden
              className={
                d.isPerfect
                  ? d.isToday
                    ? 'block h-2 w-2 rounded-full bg-white/90'
                    : 'bg-accent block h-2 w-2 rounded-full'
                  : d.isPartial
                    ? 'border-accent block h-2 w-2 rounded-full border'
                    : 'border-text-dim/40 block h-2 w-2 rounded-full border'
              }
            />
          </div>
        ))}
      </div>
    </Card>
  );
}
