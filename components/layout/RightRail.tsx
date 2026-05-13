import type { ReactNode } from 'react';

interface RightRailProps {
  children: ReactNode;
}

/**
 * RightRail — the dashboard/settings secondary column.
 *
 * Hidden below lg (1024px). The rail's widgets (today's tasks, weekly
 * schedule, performance) are companions to the main content rather than
 * primary surfaces, so collapsing them on tablet + mobile keeps the main
 * column readable without sacrificing access to a critical flow. They
 * return at lg+ where there's room.
 */
export function RightRail({ children }: RightRailProps) {
  return (
    <aside className="border-border hidden w-[320px] shrink-0 space-y-6 overflow-y-auto border-l p-6 lg:block">
      {children}
    </aside>
  );
}
