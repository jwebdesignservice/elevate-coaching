import Link from 'next/link';
import { Bell, Zap } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
  const initial = (userName?.[0] ?? 'U').toUpperCase();

  return (
    <div className="border-border flex items-center gap-6 border-b px-8 py-6">
      <div className="flex-1">
        <h1 className="text-text text-2xl font-semibold">{title}</h1>
        {subtitle && <p className="text-text-muted mt-1 text-sm">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-4">
        <Input
          disabled
          placeholder="Search programs, exercises, or topics..."
          className="bg-surface border-border text-text placeholder:text-text-dim w-[320px]"
        />

        {userTier !== 'pro' && (
          <Button
            nativeButton={false}
            render={<Link href="/settings" />}
            className="bg-accent text-accent-fg hover:bg-accent/90"
          >
            <Zap className="h-4 w-4" />
            Upgrade Now
          </Button>
        )}

        <button
          type="button"
          disabled
          className="text-text-muted disabled:opacity-50"
          title="Notifications (coming soon)"
          aria-label="Notifications"
        >
          <Bell className="text-text-muted h-5 w-5" />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="User menu"
            className="focus-visible:ring-accent/50 rounded-full focus:outline-none focus-visible:ring-2"
          >
            <Avatar>
              <AvatarFallback className="bg-surface-hover text-text">{initial}</AvatarFallback>
            </Avatar>
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
