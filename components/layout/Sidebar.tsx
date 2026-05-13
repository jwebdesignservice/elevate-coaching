import Link from 'next/link';
import {
  Apple,
  BadgeCheck,
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
 * are visual placeholders for sprints that haven't shipped yet — wired
 * to `#` and styled identically to real items so the IA matches the
 * design spec. They become clickable when their routes land in
 * SP-2/SP-4/SP-5/SP-6.
 *
 * Active state: gradient mint→transparent surface + 3px mint bar pinned
 * to the left edge + bright text + slightly larger mint icon.
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
          const baseRow =
            'group/nav relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-all duration-200';

          if (active) {
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current="page"
                className={`${baseRow} text-text from-accent/15 via-accent/5 bg-gradient-to-r to-transparent font-semibold`}
              >
                <span
                  aria-hidden
                  className="bg-accent absolute inset-y-1 left-0 w-[3px] rounded-r-md"
                />
                <item.Icon className="text-accent h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          }

          if (item.comingSoon) {
            return (
              <div
                key={item.label}
                aria-disabled="true"
                title="Coming soon"
                className={`${baseRow} text-text-muted/70 cursor-not-allowed select-none`}
              >
                <item.Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </div>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`${baseRow} text-text-muted hover:text-text hover:bg-white/[0.03]`}
            >
              <item.Icon className="h-4 w-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Coach card */}
      <div className="border-border mt-6 border-t pt-6">
        <div className="mb-4 flex items-center gap-3">
          <Avatar>
            <AvatarFallback className="bg-surface-hover text-text">CA</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-text flex items-center gap-1 text-sm font-medium">
              <span>Coach Alex</span>
              <BadgeCheck className="text-accent h-3.5 w-3.5" />
            </div>
            <div className="text-text-dim truncate text-[11px]">Elite Performance Coach</div>
          </div>
        </div>
        <div className="text-text-muted mb-0.5 text-xs">Discipline today,</div>
        <div className="text-accent mb-4 text-sm font-medium italic">Freedom tomorrow.</div>
        <Button
          nativeButton={false}
          render={<a href={whatsappHref} target="_blank" rel="noopener noreferrer" />}
          variant="outline"
          className="border-border text-text hover:border-accent/40 w-full transition-colors hover:bg-white/[0.03]"
        >
          <MessageCircle className="h-4 w-4" />
          Message Coach
        </Button>
      </div>
    </aside>
  );
}
