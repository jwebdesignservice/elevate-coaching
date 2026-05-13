import type { ReactNode } from 'react';

interface RightRailProps {
  children: ReactNode;
}

export function RightRail({ children }: RightRailProps) {
  return (
    <aside className="border-border w-[320px] shrink-0 space-y-6 overflow-y-auto border-l p-6">
      {children}
    </aside>
  );
}
