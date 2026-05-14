'use client';

import { useActionState, useRef } from 'react';
import { ArrowRight, Check, X } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { updateProfileAction, uploadAvatarAction } from './actions';

type PState = { status: 'idle' | 'error' | 'success'; error: string | null; message: string | null };
const INIT: PState = { status: 'idle', error: null, message: null };
const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

interface Props { name: string | null; email: string; phone: string | null; avatarUrl: string | null; initials: string }

export function ProfileEditCard({ name, email, phone, avatarUrl, initials }: Props) {
  const [state, formAction, isPending] = useActionState<PState, FormData>(updateProfileAction, INIT);
  const [avatarState, avatarAction, avatarPending] = useActionState<PState, FormData>(uploadAvatarAction, INIT);
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <Card className="bg-surface border-border space-y-6 p-6">
      <h2 className="text-text text-xl font-semibold tracking-tight">Profile</h2>
      <div className="flex items-center gap-5">
        <Avatar size="lg" className="size-16 shrink-0">
          {avatarUrl && <AvatarImage src={avatarUrl} alt={name ?? 'Avatar'} />}
          <AvatarFallback className="bg-muted text-text text-xl font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div>
          <input
            ref={fileRef}
            type="file"
            name="avatar"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) {
                const fd = new FormData();
                fd.append('avatar', e.target.files[0]);
                avatarAction(fd);
              }
            }}
          />
          <Button type="button" variant="outline" size="sm" disabled={avatarPending} onClick={() => fileRef.current?.click()}>
            {avatarPending ? 'Uploading…' : 'Change photo'}
          </Button>
          {avatarState.status === 'error' && <p className="text-destructive mt-1 text-xs">{avatarState.error}</p>}
          {avatarState.status === 'success' && <p className="text-accent mt-1 flex items-center gap-1 text-xs"><Check className="h-3 w-3" />{avatarState.message}</p>}
        </div>
      </div>
      <form action={formAction} className="space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div><label className="text-text mb-1.5 block text-sm font-medium">Full name</label><input name="name" defaultValue={name ?? ''} className={INPUT} placeholder="Your name" /></div>
          <div><label className="text-text mb-1.5 block text-sm font-medium">Phone</label><input name="phone" type="tel" defaultValue={phone ?? ''} className={INPUT} placeholder="+44 7700 000000" /></div>
        </div>
        <div>
          <label className="text-text mb-1.5 block text-sm font-medium">Email</label>
          <input name="email" type="email" defaultValue={email} className={INPUT} />
          <p className="text-text-dim mt-1 text-xs">Changing your email sends a verification link to the new address.</p>
        </div>
        {state.status === 'error' && state.error && (
          <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm"><X className="h-3.5 w-3.5 shrink-0" />{state.error}</p>
        )}
        {state.status === 'success' && state.message && (
          <p role="status" className="text-accent flex items-center gap-2 text-sm"><Check className="h-4 w-4" />{state.message}</p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/25 hover:text-white hover:border-accent/60">
            {isPending ? 'Saving…' : 'Save changes'}{!isPending && <ArrowRight className="ml-1 h-4 w-4" />}
          </Button>
        </div>
      </form>
    </Card>
  );
}
