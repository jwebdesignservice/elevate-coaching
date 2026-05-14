/**
 * Fixed icon + label map for the daily-task type enum (SP-5).
 *
 * Kept in `lib/` (not `components/`) so server components can import the
 * labels without dragging client component boundaries.
 */

import {
  Brain,
  CircleDot,
  Dumbbell,
  Footprints,
  UtensilsCrossed,
  Waves,
} from 'lucide-react';
import type { ComponentType } from 'react';
import type { Database } from '@/lib/supabase/database.types';

export type TaskType = Database['public']['Enums']['task_type'];

export const TASK_TYPE_ICONS: Record<TaskType, ComponentType<{ className?: string }>> = {
  workout: Dumbbell,
  nutrition: UtensilsCrossed,
  mindset: Brain,
  recovery: Waves,
  steps: Footprints,
  other: CircleDot,
};

export const TASK_TYPE_LABELS: Record<TaskType, string> = {
  workout: 'Workout',
  nutrition: 'Nutrition',
  mindset: 'Mindset',
  recovery: 'Recovery',
  steps: 'Steps',
  other: 'Other',
};

export const TASK_TYPES: TaskType[] = [
  'workout',
  'nutrition',
  'mindset',
  'recovery',
  'steps',
  'other',
];
