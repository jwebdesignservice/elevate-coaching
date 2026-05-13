import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Card } from '@/components/ui/card';

export interface TaskItem {
  label: string;
  done: boolean;
}

interface TodaysTasksProps {
  tasks: TaskItem[];
  viewAllHref?: string;
}

/**
 * Today's Tasks rail card. Empty/filled circle for each task plus a
 * count badge in the header (e.g. "+ 4/6" — done over total).
 */
export function TodaysTasks({ tasks, viewAllHref = '/dashboard' }: TodaysTasksProps) {
  const done = tasks.filter((t) => t.done).length;

  return (
    <Card className="bg-surface border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text font-semibold tracking-tight">Today&apos;s Tasks</h3>
        <span className="text-text-muted rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium">
          + {done}/{tasks.length}
        </span>
      </div>

      <ul className="space-y-3">
        {tasks.map((task) => (
          <li key={task.label} className="flex items-center gap-3">
            {task.done ? (
              <span className="bg-accent text-accent-fg flex h-5 w-5 shrink-0 items-center justify-center rounded-full">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
            ) : (
              <span className="border-text-dim/50 h-5 w-5 shrink-0 rounded-full border" />
            )}
            <span
              className={`text-sm ${task.done ? 'text-text-muted decoration-text-dim/60 line-through' : 'text-text'}`}
            >
              {task.label}
            </span>
          </li>
        ))}
      </ul>

      <Link
        href={viewAllHref}
        className="text-accent mt-4 inline-flex items-center gap-1 text-xs font-medium hover:underline"
      >
        View all tasks
        <ArrowRight className="h-3 w-3" />
      </Link>
    </Card>
  );
}
