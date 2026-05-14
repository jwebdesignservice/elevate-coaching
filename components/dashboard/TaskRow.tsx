'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { TASK_TYPE_ICONS, type TaskType } from '@/lib/task-types';

interface TaskRowProps {
  task: { id: string; title: string; task_type: TaskType };
  initialDone: boolean;
  todayIso: string;
}

/**
 * Single task row with optimistic checkbox.
 *
 * Tap → optimistically flip → fetch /api/tasks/[id]/toggle → on success
 * reconcile with the server's authoritative state and call router.refresh()
 * so the dashboard's server fetch re-runs (streak / stat cards stay in sync).
 *
 * On failure or network error, reverts to the prior state.
 */
export function TaskRow({ task, initialDone, todayIso }: TaskRowProps) {
  const router = useRouter();
  const [done, setDone] = useState(initialDone);
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();
  const TypeIcon = TASK_TYPE_ICONS[task.task_type];

  async function toggle() {
    if (busy) return;
    const prev = done;
    setDone(!prev);
    setBusy(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: todayIso }),
      });
      if (!res.ok) {
        setDone(prev);
        return;
      }
      const json = (await res.json()) as { done: boolean };
      setDone(json.done);
      startTransition(() => router.refresh());
    } catch {
      setDone(prev);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={done}
        aria-label={`${done ? 'Mark incomplete' : 'Mark complete'}: ${task.title}`}
        className="shrink-0"
      >
        {done ? (
          <span className="bg-accent text-accent-fg flex h-5 w-5 items-center justify-center rounded-full">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        ) : (
          <span className="border-text-dim/50 block h-5 w-5 rounded-full border" />
        )}
      </button>
      <TypeIcon className="text-text-muted h-3.5 w-3.5 shrink-0" />
      <span
        className={`text-sm ${done ? 'text-text-muted decoration-text-dim/60 line-through' : 'text-text'}`}
      >
        {task.title}
      </span>
    </li>
  );
}
