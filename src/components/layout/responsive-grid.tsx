import * as React from 'react';
import { cn } from '@/lib/utils';

const colClasses = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 md:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4',
  '2-compact': 'grid-cols-2',
} as const;

const gapClasses = {
  sm: 'gap-3',
  md: 'gap-4',
  lg: 'gap-5 sm:gap-6',
} as const;

export interface ResponsiveGridProps extends React.HTMLAttributes<HTMLDivElement> {
  cols?: keyof typeof colClasses;
  gap?: keyof typeof gapClasses;
}

export function ResponsiveGrid({
  cols = 2,
  gap = 'md',
  className,
  children,
  ...props
}: ResponsiveGridProps) {
  return (
    <div className={cn('grid', colClasses[cols], gapClasses[gap], className)} {...props}>
      {children}
    </div>
  );
}
