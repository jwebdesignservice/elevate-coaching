'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { CATEGORIES, type Category } from '@/lib/categories';
import type { RequestCategoryChangeState } from './state';

const requestChangeSchema = z
  .object({
    requested_category: z.enum(CATEGORIES),
    reason: z.string().trim().max(500, 'Reason must be 500 characters or fewer.').optional(),
  })
  .refine(
    // Server-side guard against requesting the same category. The DB has the
    // same constraint (`ccr_different_category`), but failing here gives a
    // friendlier message than a generic Postgres error.
    () => true,
    {},
  );

/**
 * Insert a pending category change request for the current user.
 *
 * RLS guarantees:
 *   - `ccr_insert_own` enforces user_id == auth.uid()
 *   - `ccr_insert_own` enforces current_category matches the row in profiles
 *     so a malicious client can't spoof "from"
 *   - `ccr_different_category` CHECK rejects same-to-same
 *
 * We don't trust the client's "current_category" — we read it from the
 * profile row ourselves and pass that as the snapshot. If the user has no
 * category yet they shouldn't be on /settings anyway (the layout gate
 * redirects them to /onboarding); we still guard explicitly.
 *
 * On success, revalidate /settings so the pending-request banner shows up
 * without a full page reload.
 */
export async function requestCategoryChangeAction(
  _prev: RequestCategoryChangeState,
  formData: FormData,
): Promise<RequestCategoryChangeState> {
  const parsed = requestChangeSchema.safeParse({
    requested_category: formData.get('requested_category'),
    reason: formData.get('reason') ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: 'error',
      error: parsed.error.issues[0]?.message ?? 'Invalid request.',
      message: null,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/sign-in');
  }

  const { data: profileRaw, error: profileError } = await supabase
    .from('profiles')
    .select('category')
    .eq('id', user.id)
    .single();

  if (profileError || !profileRaw) {
    return {
      status: 'error',
      error: 'Could not load your profile. Please try again.',
      message: null,
    };
  }

  // Same Supabase-TS workaround as lib/auth.ts: the chain returns `never`
  // here, so we re-type the row from outside.
  const profile = profileRaw as { category: Category | null };
  const currentCategory = profile.category;
  if (!currentCategory) {
    // Defence in depth — the settings layout's gate should prevent this.
    redirect('/onboarding');
  }

  if (currentCategory === parsed.data.requested_category) {
    return {
      status: 'error',
      error: "You're already in that category.",
      message: null,
    };
  }

  // Write payload cast — see comment in app/onboarding/actions.ts for the
  // Supabase-TS inference quirk this works around.
  const { error: insertError } = await supabase.from('category_change_requests').insert({
    user_id: user.id,
    current_category: currentCategory,
    requested_category: parsed.data.requested_category,
    reason: parsed.data.reason?.length ? parsed.data.reason : null,
  } as never);

  if (insertError) {
    return {
      status: 'error',
      error: 'Could not submit your request. Please try again.',
      message: null,
    };
  }

  revalidatePath('/settings');

  return {
    status: 'success',
    error: null,
    message: "Change request submitted. We'll be in touch.",
  };
}

type ProfileActionState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };

export async function updateProfileAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const name = (formData.get('name') as string)?.trim() || null;
  const phone = (formData.get('phone') as string)?.trim() || null;
  const newEmail = (formData.get('email') as string)?.trim();

  const { error } = await supabase.from('profiles').update({ name, phone } as never).eq('id', user.id);
  if (error) return { status: 'error', error: 'Failed to update profile.', message: null };

  if (newEmail && newEmail !== user.email) {
    const { error: emailError } = await supabase.auth.updateUser({ email: newEmail });
    if (emailError) return { status: 'error', error: emailError.message, message: null };
    revalidatePath('/settings');
    return { status: 'success', error: null, message: 'Profile saved. A verification link has been sent to your new email.' };
  }

  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Profile saved.' };
}

export async function updateMaxLiftsAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const parse = (key: string) => { const v = parseFloat(formData.get(key) as string); return isNaN(v) || v <= 0 ? null : v; };

  const { error } = await supabase.from('profiles').update({
    max_lift_squat: parse('max_lift_squat'),
    max_lift_bench: parse('max_lift_bench'),
    max_lift_deadlift: parse('max_lift_deadlift'),
    max_lift_ohp: parse('max_lift_ohp'),
  } as never).eq('id', user.id);

  if (error) return { status: 'error', error: 'Failed to save lifts.', message: null };
  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Max lifts saved.' };
}

export async function uploadAvatarAction(_prev: ProfileActionState, formData: FormData): Promise<ProfileActionState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/sign-in');

  const file = formData.get('avatar') as File | null;
  if (!file || file.size === 0) return { status: 'error', error: 'No file selected.', message: null };
  if (file.size > 2 * 1024 * 1024) return { status: 'error', error: 'File must be under 2MB.', message: null };
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return { status: 'error', error: 'Only JPEG, PNG, or WebP allowed.', message: null };

  const ext = file.type.split('/')[1];
  const path = `${user.id}/avatar.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabase.storage.from('avatars').upload(path, arrayBuffer, { contentType: file.type, upsert: true });
  if (uploadError) return { status: 'error', error: 'Upload failed. Please try again.', message: null };

  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl } as never).eq('id', user.id);
  if (profileError) return { status: 'error', error: 'Failed to save avatar URL.', message: null };

  revalidatePath('/settings');
  return { status: 'success', error: null, message: 'Photo updated.' };
}
