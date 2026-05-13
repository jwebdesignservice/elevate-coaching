'use client';

import { useActionState, useState } from 'react';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/lib/categories';
import { setCategoryAction } from './actions';
import { onboardingInitialState, type OnboardingState } from './state';

/**
 * Onboarding picker — four cards, single radio selection, server action.
 *
 * Implementation notes:
 *   - `peer-checked:` styling on the surrounding label gives the selected-card
 *     ring without needing JS for visuals; the local `selected` useState is
 *     only here so the CTA can be disabled until a card is picked, which is
 *     a UX nicety not a security guarantee (the server action revalidates).
 *   - The cards live in a 2x2 grid at md+. On smaller screens they stack.
 *   - radio inputs are visually hidden (sr-only) but focusable for keyboard
 *     users; focus-visible state surfaces via the label's focus-within ring.
 */
export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    setCategoryAction,
    onboardingInitialState,
  );
  const [selected, setSelected] = useState<Category | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <div
        role="radiogroup"
        aria-label="Training category"
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        {CATEGORIES.map((code) => {
          const info = CATEGORY_INFO[code];
          const isSelected = selected === code;
          return (
            <label
              key={code}
              className={[
                'group/card bg-surface border-border relative flex cursor-pointer flex-col gap-3 rounded-[14px] border p-6 transition-all duration-200',
                'focus-within:border-accent/60 focus-within:ring-accent/30 focus-within:ring-2',
                'hover:-translate-y-0.5 hover:border-white/10 hover:shadow-lg hover:shadow-black/20',
                isSelected
                  ? 'border-accent/70 ring-accent/30 from-accent/[0.08] to-surface bg-gradient-to-br ring-2'
                  : '',
              ].join(' ')}
            >
              <input
                type="radio"
                name="category"
                value={code}
                checked={isSelected}
                onChange={() => setSelected(code)}
                disabled={isPending}
                className="sr-only"
              />

              <div className="flex items-start justify-between gap-3">
                <span className="text-accent text-[11px] font-semibold tracking-[0.25em] uppercase">
                  Category {code}
                </span>
                <span
                  aria-hidden
                  className={[
                    'flex h-5 w-5 items-center justify-center rounded-full border transition-colors',
                    isSelected
                      ? 'bg-accent border-accent text-accent-fg'
                      : 'border-border bg-surface-hover text-transparent',
                  ].join(' ')}
                >
                  <Check className="h-3 w-3" />
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-text text-2xl font-semibold tracking-tight">{info.name}</span>
                <span className="text-text-muted text-sm">{info.tagline}</span>
              </div>

              <p className="text-text-muted text-sm leading-relaxed">{info.description}</p>
            </label>
          );
        })}
      </div>

      {state.status === 'error' && state.error ? (
        <p
          role="alert"
          className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-sm"
        >
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-text-dim text-xs">
          You can request a change any time from your settings.
        </p>
        <Button
          type="submit"
          disabled={isPending || selected === null}
          className="bg-accent text-accent-fg hover:bg-accent/90 hover:shadow-accent/20 h-11 px-6 font-medium transition-all hover:shadow-lg sm:w-auto"
        >
          {isPending ? 'Saving…' : 'Continue to dashboard'}
        </Button>
      </div>
    </form>
  );
}
