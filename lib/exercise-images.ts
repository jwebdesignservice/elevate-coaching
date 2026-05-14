/**
 * Placeholder exercise thumbnails keyed by exercise title.
 *
 * Used by /exercises (list + detail) and the session view to give exercises
 * visual identity. Eventually these should live in the `exercises` table
 * (image_url column) and be managed via the admin form; for now they're a
 * static map of curated Unsplash URLs.
 *
 * Falls back to a generic gym image when an exercise isn't in the map.
 */
export const EXERCISE_IMAGES: Record<string, string> = {
  'Back Squat':            'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=480&h=260&fit=crop&auto=format',
  'Bench Press':           'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=480&h=260&fit=crop&auto=format',
  'Conventional Deadlift': 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=480&h=260&fit=crop&auto=format',
  'Overhead Press':        'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=480&h=260&fit=crop&auto=format',
  'Barbell Row':           'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=480&h=260&fit=crop&auto=format',
  'Romanian Deadlift':     'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=480&h=260&fit=crop&auto=format',
  'Bulgarian Split Squat': 'https://images.unsplash.com/photo-1584466977773-e625c37cdd50?w=480&h=260&fit=crop&auto=format',
  'Dumbbell Lateral Raise':'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=480&h=260&fit=crop&auto=format',
  'Cable Row':             'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=480&h=260&fit=crop&auto=format',
  'Leg Press':             'https://images.unsplash.com/photo-1576678927484-cc907957088c?w=480&h=260&fit=crop&auto=format',
  'Face Pull':             'https://images.unsplash.com/photo-1580261450046-d0a30080dc9b?w=480&h=260&fit=crop&auto=format',
  'Incline Dumbbell Press':'https://images.unsplash.com/photo-1546483875-ad9014c88eba?w=480&h=260&fit=crop&auto=format',
};

export const FALLBACK_EXERCISE_IMAGE = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=480&h=260&fit=crop&auto=format';

export function exerciseImage(title: string | null | undefined): string {
  if (!title) return FALLBACK_EXERCISE_IMAGE;
  return EXERCISE_IMAGES[title] ?? FALLBACK_EXERCISE_IMAGE;
}
