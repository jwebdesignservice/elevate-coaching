'use client';

import { useTransition } from 'react';
import { CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props { action: () => Promise<void>; alreadyDone: boolean }

export function SessionCompleteBtn({ action, alreadyDone }: Props) {
  const [isPending, startTransition] = useTransition();
  if (alreadyDone) {
    return <div className="flex items-center gap-2 text-sm font-medium text-accent"><CheckCircle className="h-5 w-5" />Session completed</div>;
  }
  return (
    <Button onClick={() => startTransition(() => action())} disabled={isPending} className="bg-accent text-accent-fg hover:bg-accent/80 hover:text-white hover:border-accent w-full sm:w-auto">
      {isPending ? 'Saving…' : 'Mark session complete'}{!isPending && <CheckCircle className="ml-2 h-4 w-4" />}
    </Button>
  );
}
