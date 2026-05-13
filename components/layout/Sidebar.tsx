import Link from 'next/link';
import {
  Apple,
  CheckSquare,
  Dumbbell,
  LayoutDashboard,
  LibraryBig,
  MessageCircle,
  Settings,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { Logo } from '@/components/branded/Logo';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { env } from '@/lib/env';

interface NavItem {
  label: string;
  href: string;
  Icon: LucideIcon;
  comingSoon?: boolean;
}

/**
 * Sidebar nav.
 *
 * Real routes (Dashboard, Settings) are interactive. The remaining items
 * are visual placeholders for sprints that haven't shipped yet — keeping
 * them here matches the design spec's information architecture and stops
 * the rail from feeling half-built. They render as muted, non-clickable
 * rows with a subtle "Soon" tag.
 */
const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { label: 'Programs', href: '#', Icon: LibraryBig, comingSoon: true },
  { label: 'Exercises', href: '#', Icon: Dumbbell, comingSoon: true },
  { label: 'Nutrition', href: '#', Icon: Apple, comingSoon: true },
  { label: 'Tasks', href: '#', Icon: CheckSquare, comingSoon: true },
  { label: 'Coaches', href: '#', Icon: Users, comingSoon: true },
  { label: 'Settings', href: '/settings', Icon: Settings },
];

interface SidebarProps {
  currentPath: string;
}

export function Sidebar({ currentPath }: SidebarProps) {
  const whatsappHref = `https://wa.me/${env.NEXT_PUBLIC_COACH_WHATSAPP}`;
  return (
    <aside className="bg-surface border-border flex w-[220px] shrink-0 flex-col border-r p-6">
      <Logo variant="full" />

      <nav className="mt-10 flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = !item.comingSoon && currentPath.startsWith(item.href);
          if (item.comingSoon) {
            return (
              <div
                key={item.label}
                aria-disabled="true"
                title="Coming soon"
                className="rounded-card text-text-dim flex cursor-not-allowed items-center gap-3 px-3 py-2 text-sm select-none"
              >
                <item.Icon className="h-4 w-4" />
                <span className="flex-1">{item.label}</span>
                <span className="bg-surface-hover text-text-dim rounded-pill px-1.5 py-px text-[9px] tracking-wider uppercase">
                  Soon
                </span>
              </div>
            );
          }
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-card flex items-center gap-3 px-3 py-2 text-sm transition-colors ${
                active ? 'bg-accent text-accent-fg font-medium' : 'text-text-muted hover:text-text'
              }`}
            >
              <item.Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-border mt-6 border-t pt-6">
        <div className="mb-4 flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-surface-hover text-text">CA</AvatarFallback>
          </Avatar>
          <div>
            <div className="text-text text-sm font-medium">Coach Alex</div>
            <div className="text-text-dim text-xs">Elite Performance Coach</div>
          </div>
        </div>
        <div className="text-text-muted mb-1 text-xs">Discipline today,</div>
        <div className="text-text mb-4 text-sm">Freedom tomorrow.</div>
        <Button
          nativeButton={false}
          render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
          variant="outline"
          className="border-border text-text w-full"
        >
          <MessageCircle className="h-4 w-4" />
          Message Coach
        </Button>
      </div>
    </aside>
  );
}
