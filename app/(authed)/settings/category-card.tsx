'use client';

import { useActionState, useState } from 'react';
import { Collapsible } from '@base-ui/react/collapsible';
import { ArrowRight, Check, Clock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CATEGORIES, CATEGORY_INFO, type Category } from '@/lib/categories';
import { requestCategoryChangeAction } from './actions';
import { requestCategoryChangeInitialState, type RequestCategoryChangeState } from './state';

interface PendingRequest {
  id: string;
  requestedCategory: Category;
  createdAt: string;
}

interface CategoryCardProps {
  currentCategory: Category;
  pendingRequest: PendingRequest | null;
}

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

export function CategoryCard({ currentCategory, pendingRequest }: CategoryCardProps) {
  const info = CATEGORY_INFO[currentCategory];
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Category | null>(null);
  const [state, formAction, isPending] = useActionState<RequestCategoryChangeState, FormData>(
    requestCategoryChangeAction,
    requestCategoryChangeInitialState,
  );

  // Close the form when the action succeeds so the success line is the only
  // thing visible. Local state is set in an effect-free way: success arrives
  // via the action's return value, we reflect it on next render.
  if (state.status === 'success' && open) {
    setOpen(false);
    setPicked(null);
  }

  const otherCategories = CATEGORIES.filter((c) => c !== currentCategory);

  return (
    <Card className="bg-surface border-border p-6">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <span className="text-accent text-[11px] font-semibold tracking-[0.25em] uppercase">
            Category {info.code} · Your training lane
          </span>
          <h2 className="text-text text-xl font-semibold tracking-tight">{info.name}</h2>
          <p className="text-text-muted max-w-prose text-sm leading-relaxed">{info.description}</p>
        </div>

        {!pendingRequest && (
          <Collapsible.Root open={open} onOpenChange={setOpen}>
            <Collapsible.Trigger
              render={
                <Button
                  variant="outline"
                  className="text-accent border-accent/40 hover:border-accent hover:bg-accent/10 self-start whitespace-nowrap transition-colors"
                />
              }
            >
              {open ? 'Cancel' : 'Request change'}
            </Collapsible.Trigger>
          </Collapsible.Root>
        )}
      </div>

      {/* Pending banner replaces the form entirely when a request is open. */}
      {pendingRequest && (
        <div className="border-border bg-surface-hover/50 mt-5 flex items-start gap-3 rounded-md border p-4">
          <Clock className="text-accent mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex flex-col gap-1 text-sm">
            <span className="text-text font-medium">
              Requested change to {CATEGORY_INFO[pendingRequest.requestedCategory].name} on{' '}
              {dateFmt.format(new Date(pendingRequest.createdAt))}.
            </span>
            <span className="text-text-muted">
              Awaiting coach approval. You&apos;ll be moved into your new lane once it&apos;s
              approved.
            </span>
          </div>
        </div>
      )}

      {/* Collapsible form. Mounted regardless of `open`; Base UI animates the
          height to zero when closed. */}
      {!pendingRequest && (
        <Collapsible.Root open={open} onOpenChange={setOpen}>
          <Collapsible.Panel className="overflow-hidden transition-all data-[ending-style]:h-0 data-[starting-style]:h-0">
            <form
              action={formAction}
              className="border-border mt-6 flex flex-col gap-5 border-t pt-6"
            >
              <div>
                <p className="text-text-muted mb-3 text-sm">
                  Pick the lane you&apos;d like to move to. Your coach reviews each request
                  individually.
                </p>
                <div
                  role="radiogroup"
                  aria-label="Requested training category"
                  className="grid grid-cols-1 gap-3 sm:grid-cols-3"
                >
                  {otherCategories.map((code) => {
                    const c = CATEGORY_INFO[code];
                    const isPicked = picked === code;
                    return (
                      <label
                        key={code}
                        className={[
                          'bg-surface-hover/60 border-border relative flex cursor-pointer flex-col gap-1 rounded-md border p-3 transition-all duration-200',
                          'focus-within:border-accent/60 focus-within:ring-accent/30 focus-within:ring-2',
                          'hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md hover:shadow-black/20 hover:bg-accent/[0.04]',
                          isPicked ? 'border-accent/70 bg-accent/[0.08]' : '',
                        ].join(' ')}
                      >
                        <input
                          type="radio"
                          name="requested_category"
                          value={code}
                          checked={isPicked}
                          onChange={() => setPicked(code)}
                          disabled={isPending}
                          className="sr-only"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-accent text-[10px] font-semibold tracking-[0.2em] uppercase">
                            {code}
                          </span>
                          {isPicked && <Check className="text-accent h-3.5 w-3.5" aria-hidden />}
                        </div>
                        <span className="text-text text-sm font-medium">{c.name}</span>
                        <span className="text-text-dim text-xs leading-relaxed">{c.tagline}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="reason" className="text-text text-sm font-medium">
                  Why are you switching? <span className="text-text-dim">(optional)</span>
                </label>
                <textarea
                  id="reason"
                  name="reason"
                  rows={3}
                  maxLength={500}
                  disabled={isPending}
                  placeholder="A short note for your coach — what's changed, what you're aiming for."
                  className="bg-background border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 rounded-md border px-3 py-2 text-sm transition-colors outline-none"
                />
                <p className="text-text-dim text-xs">500 characters max.</p>
              </div>

              {state.status === 'error' && state.error ? (
                <p
                  role="alert"
                  className="text-destructive border-destructive/40 bg-destructive/10 rounded-md border px-3 py-2 text-sm"
                >
                  <X className="mr-1 inline h-3.5 w-3.5" aria-hidden />
                  {state.error}
                </p>
              ) : null}

              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="border-border text-text-muted hover:text-text hover:border-white/20"
                  onClick={() => {
                    setOpen(false);
                    setPicked(null);
                  }}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isPending || picked === null}
                  className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent"
                >
                  {isPending ? 'Submitting…' : 'Submit request'}
                  {!isPending && <ArrowRight className="ml-1 h-4 w-4" aria-hidden />}
                </Button>
              </div>
            </form>
          </Collapsible.Panel>
        </Collapsible.Root>
      )}

      {state.status === 'success' && state.message ? (
        <p role="status" className="text-accent mt-4 flex items-center gap-2 text-sm">
          <Check className="h-4 w-4" aria-hidden />
          {state.message}
        </p>
      ) : null}
    </Card>
  );
}
