import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';

interface DayCell {
  letter: string;
  date: number;
}

export interface ScheduleItem {
  Icon: React.ComponentType<{ className?: string }>;
  label: string;
  time: string;
}

interface WeeklyScheduleProps {
  /** Mon-Sun letters with dates */
  days: DayCell[];
  /** index (0-6) of the highlighted day */
  activeDayIndex: number;
  items: ScheduleItem[];
}

/**
 * Weekly Schedule rail card: 7-day letter+date strip across the top with
 * the active day in a mint pill, then a list of training items for that
 * day with small icons.
 */
export function WeeklySchedule({ days, activeDayIndex, items }: WeeklyScheduleProps): ReactNode {
  return (
    <Card className="bg-surface border-border p-5">
      <h3 className="text-text mb-4 font-semibold tracking-tight">Weekly Schedule</h3>

      {/* Day strip */}
      <div className="mb-5 grid grid-cols-7 gap-1">
        {days.map((day, i) => {
          const active = i === activeDayIndex;
          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 rounded-md py-2 text-center transition-colors ${
                active ? 'bg-accent text-accent-fg' : 'text-text-muted hover:bg-white/[0.04]'
              }`}
            >
              <span className="text-[10px] font-semibold tracking-wide">{day.letter}</span>
              <span className="text-sm font-semibold">{day.date}</span>
            </div>
          );
        })}
      </div>

      {/* Items */}
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-3">
            <span className="text-accent bg-surface-hover flex h-7 w-7 shrink-0 items-center justify-center rounded-md">
              <item.Icon className="h-3.5 w-3.5" />
            </span>
            <span className="text-text flex-1 text-sm">{item.label}</span>
            <span className="text-text-muted text-xs tabular-nums">{item.time}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
