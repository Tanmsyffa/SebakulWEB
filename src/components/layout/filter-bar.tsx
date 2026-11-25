import * as React from 'react';
import { cn } from '@/lib/utils';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  actions?: React.ReactNode;
}

export function FilterBar({
  children,
  actions,
  className,
  ...props
}: FilterBarProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 md:flex-row md:items-end md:justify-between',
        className
      )}
      {...props}
    >
      <div className="grid min-w-0 flex-1 grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-end">
        {children}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 md:shrink-0">{actions}</div>
      )}
    </div>
  );
}
