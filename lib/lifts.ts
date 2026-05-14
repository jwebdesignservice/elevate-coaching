export interface MaxLifts {
  max_lift_squat: number | null;
  max_lift_bench: number | null;
  max_lift_deadlift: number | null;
  max_lift_ohp: number | null;
}

const LIFT_KEY_TO_PROFILE: Record<string, keyof MaxLifts> = {
  squat: 'max_lift_squat',
  bench: 'max_lift_bench',
  deadlift: 'max_lift_deadlift',
  ohp: 'max_lift_ohp',
};

export function calcWeight(
  pctOf1rm: number,
  liftKey: string | null,
  profile: MaxLifts,
): string {
  const col = liftKey ? LIFT_KEY_TO_PROFILE[liftKey] : null;
  const max1rm = col ? profile[col] : null;
  if (!max1rm) return `${pctOf1rm}% 1RM`;
  const kg = Math.round((pctOf1rm / 100) * max1rm * 2) / 2;
  return `${pctOf1rm}% 1RM → ${kg} kg`;
}
