'use client';

import { useState } from 'react';
import { useActionState } from 'react';
import { ArrowRight, X, Type, Image as ImageIcon, Tag, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export type ProgramFormState = { status: 'idle' | 'error' | 'success'; error: string | null };
export const programFormInitialState: ProgramFormState = { status: 'idle', error: null };

const INPUT = 'bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 text-sm outline-none transition-colors';

interface ProgramFormProps {
  action: (prev: ProgramFormState, formData: FormData) => Promise<ProgramFormState>;
  defaultValues?: { title?: string; description?: string; cover_image_url?: string; category?: string; plan_access?: string; status?: string };
  submitLabel?: string;
}

export function ProgramForm({ action, defaultValues, submitLabel = 'Create programme' }: ProgramFormProps) {
  const [state, formAction, isPending] = useActionState<ProgramFormState, FormData>(action, programFormInitialState);
  const [coverUrl, setCoverUrl] = useState(defaultValues?.cover_image_url ?? '');

  return (
    <form action={formAction} className="space-y-5">
      {/* Basics */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Type className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Basics</h3>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">
              Title <span className="text-destructive">*</span>
            </label>
            <input
              name="title"
              required
              defaultValue={defaultValues?.title}
              className={INPUT}
              placeholder="e.g. Strength Foundation — 4 Week Block"
            />
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Description</label>
            <textarea
              name="description"
              rows={3}
              defaultValue={defaultValues?.description}
              className={INPUT}
              placeholder="What is this programme about and who is it for?"
            />
          </div>
        </div>
      </Card>

      {/* Cover image with preview */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <ImageIcon className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Cover image</h3>
        </div>
        <div className="space-y-3">
          <input
            name="cover_image_url"
            type="url"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
            className={INPUT}
            placeholder="https://images.unsplash.com/…"
          />
          {coverUrl ? (
            <div className="border-border relative overflow-hidden rounded-md border">
              <div className="text-text-dim absolute left-2 top-2 z-10 flex items-center gap-1 rounded-md bg-black/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider backdrop-blur-sm text-white">
                <Eye className="h-3 w-3" />
                Preview
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt="Cover preview"
                className="block h-40 w-full object-cover"
              />
            </div>
          ) : (
            <p className="text-text-dim text-xs italic">No image — programme cards will show a placeholder icon.</p>
          )}
        </div>
      </Card>

      {/* Targeting */}
      <Card className="bg-surface border-border p-5 sm:p-6">
        <div className="mb-4 flex items-center gap-2">
          <Tag className="text-accent h-4 w-4" />
          <h3 className="text-text font-semibold">Targeting &amp; access</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Category</label>
            <select name="category" defaultValue={defaultValues?.category ?? ''} className={INPUT}>
              <option value="">All categories</option>
              <option value="A">A — Strength</option>
              <option value="B">B — Hybrid</option>
              <option value="C">C — Conditioning</option>
              <option value="D">D — Beginner</option>
            </select>
            <p className="text-text-dim mt-1 text-xs">Members only see programmes for their category.</p>
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Plan access</label>
            <select name="plan_access" defaultValue={defaultValues?.plan_access ?? 'free'} className={INPUT}>
              <option value="free">Free</option>
              <option value="basic">Basic+</option>
              <option value="pro">Pro only</option>
            </select>
            <p className="text-text-dim mt-1 text-xs">Lower-tier users see lock icon.</p>
          </div>
          <div>
            <label className="text-text mb-1.5 block text-sm font-medium">Status</label>
            <select name="status" defaultValue={defaultValues?.status ?? 'draft'} className={INPUT}>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
            </select>
            <p className="text-text-dim mt-1 text-xs">Drafts hidden from members.</p>
          </div>
        </div>
      </Card>

      {state.status === 'error' && state.error && (
        <p role="alert" className="text-destructive border-destructive/40 bg-destructive/10 flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
          <X className="h-3.5 w-3.5 shrink-0" />
          {state.error}
        </p>
      )}

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={isPending}
          className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent"
        >
          {isPending ? 'Saving…' : submitLabel}
          {!isPending && <ArrowRight className="ml-1.5 h-4 w-4" />}
        </Button>
      </div>
    </form>
  );
}
