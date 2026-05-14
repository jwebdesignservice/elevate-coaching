'use client';

import { useRouter } from 'next/navigation';
import { Dialog } from '@base-ui/react/dialog';
import { ArrowDown, ArrowUp, Trash2, X } from 'lucide-react';
import { TASK_TYPE_ICONS, TASK_TYPE_LABELS, TASK_TYPES, type TaskType } from '@/lib/task-types';
import { upsertTaskAction, deleteTaskAction, reorderTaskAction } from './actions';

interface DrawerTask {
  id: string;
  title: string;
  task_type: TaskType;
  order_index: number;
}

interface DayDrawerProps {
  weekId: string;
  dayOfWeek: number;
  dayLabel: string;
  tasks: DrawerTask[];
  readOnly: boolean;
  closeHref: string;
}

/**
 * Right-side Base UI Dialog drawer for editing the tasks of one (week, day).
 *
 * Open state is driven by the URL (?day=Mon&col=live). Closing redirects to
 * `closeHref` (which strips the day/col params). Mutations go through the
 * server actions in `./actions` and revalidate the page.
 */
export function DayDrawer({ weekId, dayOfWeek, dayLabel, tasks, readOnly, closeHref }: DayDrawerProps) {
  const router = useRouter();
  // `router.push` was used to open the drawer (via Link href), so navigating
  // back is the natural close. Fall back to `replace(closeHref)` if there's no
  // history entry to pop (direct deep-link to a drawer URL).
  const close = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.replace(closeHref);
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
        <Dialog.Popup className="border-border bg-surface fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col overflow-y-auto border-l p-6 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <Dialog.Title className="text-text text-lg font-semibold">{dayLabel}</Dialog.Title>
            <Dialog.Close className="text-text-muted hover:text-text" aria-label="Close">
              <X className="h-5 w-5" />
            </Dialog.Close>
          </div>

          <ul className="space-y-2">
            {tasks.length === 0 && (
              <li className="text-text-muted text-sm">No tasks scheduled yet.</li>
            )}
            {tasks.map((task, idx) => {
              const TypeIcon = TASK_TYPE_ICONS[task.task_type];
              return (
                <li
                  key={task.id}
                  className="border-border bg-background flex items-center gap-2 rounded-md border p-2"
                >
                  <TypeIcon className="text-text-muted h-4 w-4 shrink-0" />
                  {readOnly ? (
                    <span className="text-text flex-1 text-sm">{task.title}</span>
                  ) : (
                    <form action={upsertTaskAction} className="flex-1">
                      <input type="hidden" name="task_id" value={task.id} />
                      <input type="hidden" name="week_id" value={weekId} />
                      <input type="hidden" name="day_of_week" value={dayOfWeek} />
                      <input type="hidden" name="task_type" value={task.task_type} />
                      <input
                        name="title"
                        defaultValue={task.title}
                        onBlur={(e) => {
                          if (e.currentTarget.value !== task.title) {
                            e.currentTarget.form?.requestSubmit();
                          }
                        }}
                        className="text-text w-full bg-transparent text-sm outline-none"
                      />
                    </form>
                  )}
                  {!readOnly && (
                    <>
                      {idx > 0 && (
                        <form action={reorderTaskAction}>
                          <input type="hidden" name="task_id" value={task.id} />
                          <input type="hidden" name="direction" value="up" />
                          <button
                            type="submit"
                            aria-label="Move up"
                            className="text-text-muted hover:text-text"
                          >
                            <ArrowUp className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      )}
                      {idx < tasks.length - 1 && (
                        <form action={reorderTaskAction}>
                          <input type="hidden" name="task_id" value={task.id} />
                          <input type="hidden" name="direction" value="down" />
                          <button
                            type="submit"
                            aria-label="Move down"
                            className="text-text-muted hover:text-text"
                          >
                            <ArrowDown className="h-3.5 w-3.5" />
                          </button>
                        </form>
                      )}
                      <form action={deleteTaskAction}>
                        <input type="hidden" name="task_id" value={task.id} />
                        <button
                          type="submit"
                          aria-label="Delete task"
                          className="text-text-muted hover:text-red-400"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </form>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {!readOnly && (
            <div className="border-border mt-6 border-t pt-4">
              <h4 className="text-text mb-1 text-sm font-semibold">Add task</h4>
              <p className="text-text-muted mb-3 text-xs">
                Pick a type and type any title — what users will see and tick off.
              </p>
              <form action={upsertTaskAction} className="flex items-end gap-2">
                <input type="hidden" name="week_id" value={weekId} />
                <input type="hidden" name="day_of_week" value={dayOfWeek} />
                <div className="flex-1">
                  <label className="text-text-muted mb-1 block text-xs">Type</label>
                  <select
                    name="task_type"
                    defaultValue="workout"
                    className="border-border bg-surface text-text w-full rounded-md border px-2 py-1.5 text-sm"
                  >
                    {TASK_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {TASK_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-[2]">
                  <label className="text-text-muted mb-1 block text-xs">Title</label>
                  <input
                    name="title"
                    required
                    placeholder="e.g. 10,000 steps"
                    className="border-border bg-surface text-text w-full rounded-md border px-2 py-1.5 text-sm"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-accent text-accent-fg hover:bg-accent/80 rounded-md px-3 py-1.5 text-sm font-medium"
                >
                  Add
                </button>
              </form>
            </div>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
