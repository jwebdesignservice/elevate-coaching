'use client';

import { useActionState, useState } from 'react';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/lib/categories';
import { completeOnboardingAction } from './actions';
import { onboardingInitialState, type OnboardingState } from './state';

const EXPERIENCE_OPTIONS = [
  {
    value: 'beginner' as const,
    label: 'Beginner',
    tagline: 'New to structured training',
    description: 'Building foundations — technique, consistency and base fitness.',
  },
  {
    value: 'intermediate' as const,
    label: 'Intermediate',
    tagline: '1–3 years of consistent training',
    description: 'Solid base built. Ready to push intensity and complexity.',
  },
  {
    value: 'advanced' as const,
    label: 'Advanced',
    tagline: '3+ years, serious athlete',
    description: 'High-volume programming, peaking cycles and performance metrics.',
  },
];

type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

const LIFT_FIELDS = [
  { name: 'max_lift_squat' as const, label: 'Back Squat' },
  { name: 'max_lift_bench' as const, label: 'Bench Press' },
  { name: 'max_lift_deadlift' as const, label: 'Deadlift' },
  { name: 'max_lift_ohp' as const, label: 'Overhead Press' },
];

export function OnboardingForm() {
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    completeOnboardingAction,
    onboardingInitialState,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const [category, setCategory] = useState<Category | null>(null);
  const [experience, setExperience] = useState<ExperienceLevel | null>(null);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      {step === 1 ? (
        <>
          <div
            role="radiogroup"
            aria-label="Training category"
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
          >
            {CATEGORIES.map((code) => {
              const info = CATEGORY_INFO[code];
              const isSelected = category === code;
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
                    name="category_step1"
                    value={code}
                    checked={isSelected}
                    onChange={() => setCategory(code)}
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
                    <span className="text-text text-2xl font-semibold tracking-tight">
                      {info.name}
                    </span>
                    <span className="text-text-muted text-sm">{info.tagline}</span>
                  </div>
                  <p className="text-text-muted text-sm leading-relaxed">{info.description}</p>
                </label>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-text-dim text-xs">
              You can request a change any time from your settings.
            </p>
            <Button
              type="button"
              disabled={category === null}
              onClick={() => setStep(2)}
              className="bg-accent text-accent-fg hover:bg-accent/90 h-11 px-6 font-medium sm:w-auto"
            >
              Next step
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <>
          {/* Hidden field carries category into the server action */}
          <input type="hidden" name="category" value={category ?? ''} />

          {/* Step indicator */}
          <div className="text-text-dim text-xs font-medium tracking-[0.15em] uppercase">
            Step 2 of 2 · Your profile
          </div>

          {/* Experience level */}
          <div>
            <h3 className="text-text mb-1 text-lg font-semibold">
              What&apos;s your training experience?
            </h3>
            <p className="text-text-muted mb-4 text-sm">
              Helps calibrate programme intensity and progression speed.
            </p>
            <div
              role="radiogroup"
              aria-label="Experience level"
              className="grid grid-cols-1 gap-3 sm:grid-cols-3"
            >
              {EXPERIENCE_OPTIONS.map((opt) => {
                const isSelected = experience === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={[
                      'bg-surface-hover/60 border-border relative flex cursor-pointer flex-col gap-1.5 rounded-md border p-4 transition-all duration-200',
                      'focus-within:border-accent/60 focus-within:ring-accent/30 focus-within:ring-2',
                      'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md hover:shadow-black/20',
                      isSelected ? 'border-accent/70 bg-accent/[0.08]' : '',
                    ].join(' ')}
                  >
                    <input
                      type="radio"
                      name="experience_level"
                      value={opt.value}
                      checked={isSelected}
                      onChange={() => setExperience(opt.value)}
                      disabled={isPending}
                      className="sr-only"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-text text-sm font-semibold">{opt.label}</span>
                      {isSelected && <Check className="text-accent h-4 w-4" aria-hidden />}
                    </div>
                    <span className="text-text-muted text-xs">{opt.tagline}</span>
                    <span className="text-text-dim mt-0.5 text-xs leading-relaxed">
                      {opt.description}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Max lifts */}
          <div>
            <h3 className="text-text mb-1 text-lg font-semibold">
              Current max lifts{' '}
              <span className="text-text-dim text-sm font-normal">(optional)</span>
            </h3>
            <p className="text-text-muted mb-4 text-sm">
              Used to track progress over time. Leave blank if you&apos;re unsure — you can add
              them later in Settings.
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {LIFT_FIELDS.map((field) => (
                <div key={field.name} className="flex flex-col gap-1.5">
                  <label
                    htmlFor={field.name}
                    className="text-text-dim text-xs font-medium"
                  >
                    {field.label}
                  </label>
                  <div className="relative">
                    <input
                      id={field.name}
                      type="number"
                      name={field.name}
                      min={1}
                      max={999}
                      disabled={isPending}
                      placeholder="—"
                      className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 w-full rounded-md border px-3 py-2 pr-9 text-sm outline-none transition-colors"
                    />
                    <span className="text-text-dim pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">
                      kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
            <Button
              type="button"
              variant="outline"
              onClick={() => setStep(1)}
              disabled={isPending}
              className="border-border text-text-muted hover:text-text sm:w-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="submit"
              disabled={isPending || experience === null}
              className="bg-accent text-accent-fg hover:bg-accent/90 h-11 px-6 font-medium sm:w-auto"
            >
              {isPending ? 'Saving…' : 'Continue to dashboard'}
              {!isPending && <ArrowRight className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}
    </form>
  );
}
