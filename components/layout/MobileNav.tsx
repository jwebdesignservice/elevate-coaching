'use client';

import { useState } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { Menu, X } from 'lucide-react';
import { SidebarContent } from './Sidebar';

/**
 * Mobile navigation — hamburger button + off-canvas drawer.
 *
 * Mounted by the authed layout. Renders nothing visible at md+ (the inline
 * Sidebar shows up instead), and a fixed-position hamburger at the top-left
 * on smaller viewports.
 *
 * The drawer reuses <SidebarContent /> verbatim so the IA + visual treatment
 * cannot drift between the two surfaces. Passing onNavigate=close closes the
 * drawer immediately when the user picks a nav item — the destination route
 * also triggers a server-rendered redirect of the page so they never see the
 * intermediate state.
 *
 * Dialog primitives are from @base-ui/react. The Backdrop dims the page and
 * absorbs clicks (closing the drawer); the Popup is the panel itself,
 * pinned to the left edge.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger
        aria-label="Open navigation"
        className="bg-surface border-border text-text fixed top-4 left-4 z-30 flex h-10 w-10 items-center justify-center rounded-md border shadow-md transition-colors hover:bg-white/[0.03] md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          aria-label="Main navigation"
          className="bg-surface border-border fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col border-r shadow-xl transition-transform duration-200 ease-out outline-none data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full"
        >
          {/* Visible close button at the top-right of the panel. Base UI's
              Dialog.Close swallows the click so the popup closes cleanly. */}
          <Dialog.Close
            aria-label="Close navigation"
            className="text-text-muted hover:text-text hover:bg-surface-hover absolute top-4 right-4 z-10 flex h-8 w-8 items-center justify-center rounded-md transition-colors"
          >
            <X className="h-4 w-4" aria-hidden />
          </Dialog.Close>
          <SidebarContent onNavigate={() => setOpen(false)} />
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
