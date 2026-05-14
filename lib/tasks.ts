/**
 * Pure helpers for the Daily Tasks system (SP-5).
 *
 * All functions take data as arguments — no I/O. The dashboard fetches the
 * rollup via the `get_task_rollup` RPC and passes it in.
 *
 * - `isoDayOfWeek` / `getMondayOf` / `toIsoDate` are local-timezone date
 *   helpers used both for client-side rendering and server-side fetches.
 * - `todayCompletionPct` rounds to the nearest integer; rest days return 0
 *   and the UI shows "—" instead.
 * - `currentStreak` / `bestStreak` operate on the `DayRollup[]` returned by
 *   the RPC (after `adjustedRollup` zeros out pre-signup days — see the
 *   dashboard page, §8.1 of the spec).
 */

/** ISO day-of-week: 1 = Monday … 7 = Sunday. */
export function isoDayOfWeek(d: Date): number {
  const js = d.getDay(); // 0 = Sun … 6 = Sat
  return js === 0 ? 7 : js;
}

/** Returns the Monday on or before `d`, normalised to 00:00 local. */
export function getMondayOf(d: Date): Date {
  const dow = isoDayOfWeek(d);
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dow - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

/** YYYY-MM-DD in the local timezone — used as `completion_date`. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayCompletionPct(total: number, done: number): number {
  if (total === 0) return 0;
  return Math.round((done / total) * 100);
}

export interface DayRollup {
  date: string;
  total: number;
  done: number;
}

/**
 * Consecutive perfect days ending at (and including, if perfect) today.
 *
 * - Today counts only if today is fully complete.
 * - Rest days (total === 0) are skipped without breaking or extending.
 * - Pre-signup days are passed in with total === 0 by the caller
 *   (see dashboard §8.1) so they skip naturally without breaking the chain.
 */
export function currentStreak(rollups: DayRollup[], todayIso: string): number {
  const sorted = [...rollups].sort((a, b) => b.date.localeCompare(a.date));
  let streak = 0;
  for (const day of sorted) {
    if (day.date > todayIso) continue;
    if (day.total === 0) continue;
    if (day.date === todayIso && day.done < day.total) continue;
    if (day.done === day.total) {
      streak++;
      continue;
    }
    break;
  }
  return streak;
}

/** Longest run of perfect days in the rollup window. Rest days don't break. */
export function bestStreak(rollups: DayRollup[]): number {
  const sorted = [...rollups].sort((a, b) => a.date.localeCompare(b.date));
  let best = 0;
  let run = 0;
  for (const day of sorted) {
    if (day.total === 0) continue;
    if (day.done === day.total) {
      run++;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}
