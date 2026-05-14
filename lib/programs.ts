export function programProgressPct(
  totalSessions: number,
  completedSessions: number,
): number {
  if (totalSessions === 0) return 0;
  return Math.round((completedSessions / totalSessions) * 100);
}
