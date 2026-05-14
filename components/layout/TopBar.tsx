import Link from 'next/link';
import { Bell, ChevronDown, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface TopBarProps {
  title: string;
  subtitle?: string;
  userTier: 'free' | 'basic' | 'pro';
  userName: string | null;
}

export function TopBar({ title, subtitle, userTier, userName }: TopBarProps) {
  const displayName = userName?.trim() || 'Member';
  const initial = (userName?.[0] ?? 'U').toUpperCase();

  return (
    <div className="border-border flex flex-wrap items-center gap-x-6 gap-y-3 border-b py-6 pr-8 pl-16 md:pl-8">
      <div className="min-w-0 flex-1">
        <h1 className="text-text truncate text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
          {title}
        </h1>
        {subtitle && <p className="text-text-muted mt-1.5 text-sm">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search — hidden on small screens to leave room for the title */}
        <div className="relative hidden lg:block">
          <Search className="text-text-dim pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            disabled
            placeholder="Search programs, exercises, or topics..."
            className="bg-surface border-border text-text placeholder:text-text-dim focus-visible:border-accent/40 h-10 w-[320px] rounded-md border pr-3 pl-9 text-sm transition-colors outline-none"
          />
        </div>

        {/* Upgrade Now — mint outline per mockup. Hide the label below sm,
            keep the icon so the affordance is still discoverable. */}
        {userTier !== 'pro' && (
          <Button
            nativeButton={false}
            render={<Link href="/pricing" />}
            variant="ghost"
            className="border border-accent text-accent hover:bg-accent/10 transition-colors"
          >
            <Zap className="h-4 w-4 fill-current" />
            <span className="hidden sm:inline">Upgrade Now</span>
          </Button>
        )}

        {/* Notifications */}
        <button
          type="button"
          disabled
          className="text-text-muted disabled:opacity-50"
          title="Notifications (coming soon)"
          aria-label="Notifications"
        >
          <Bell className="text-text-muted h-5 w-5" />
        </button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="User menu"
            className="focus-visible:ring-accent/50 flex items-center gap-2.5 rounded-full py-1 pr-2.5 pl-1 transition-colors hover:bg-white/[0.03] focus:outline-none focus-visible:ring-2"
          >
            <Avatar>
              <AvatarFallback className="bg-surface-hover text-text">{initial}</AvatarFallback>
            </Avatar>
            <span className="text-text hidden text-sm font-medium md:inline">{displayName}</span>
            <ChevronDown className="text-text-muted hidden h-4 w-4 md:inline" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="min-w-[160px]">
            <DropdownMenuItem render={<Link href="/settings" />}>Settings</DropdownMenuItem>
            <form action="/sign-out" method="post">
              <DropdownMenuItem render={<button type="submit" className="w-full" />}>
                Sign out
              </DropdownMenuItem>
            </form>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
