import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { TaskRow } from './TaskRow';
import type { TaskType } from '@/lib/task-types';

export interface DashboardTaskItem {
  id: string;
  title: string;
  task_type: TaskType;
}

interface TodaysTasksProps {
  tasks: DashboardTaskItem[];
  completedTaskIds: Set<string>;
  todayIso: string;
}

/**
 * Today's Tasks rail card (SP-5).
 *
 * Renders one TaskRow per scheduled task. The row owns optimistic state and
 * triggers a router.refresh() after toggling, which re-runs the dashboard's
 * server fetch so the streak strip and stat cards stay in sync.
 *
 * Empty state: "No tasks today — rest day." (per spec §3.5).
 */
export function TodaysTasks({ tasks, completedTaskIds, todayIso }: TodaysTasksProps): ReactNode {
  const done = tasks.filter((t) => completedTaskIds.has(t.id)).length;
  const total = tasks.length;

  return (
    <Card className="bg-surface border-border p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-text font-semibold tracking-tight">Today&apos;s Tasks</h3>
        {total > 0 && (
          <span className="text-text-muted rounded-md bg-white/[0.04] px-2 py-0.5 text-[11px] font-medium">
            {done}/{total}
          </span>
        )}
      </div>

      {total === 0 ? (
        <p className="text-text-muted text-sm">No tasks today — rest day.</p>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              initialDone={completedTaskIds.has(task.id)}
              todayIso={todayIso}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}
