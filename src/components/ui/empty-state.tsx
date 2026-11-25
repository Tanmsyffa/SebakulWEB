import * as React from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  compact?: boolean;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-border-strong/80 bg-surface/50 text-center',
        compact ? 'px-4 py-6' : 'px-5 py-10 sm:px-8 sm:py-12',
        className
      )}
    >
      {Icon && (
        <Icon aria-hidden="true" className="mb-2.5 h-5 w-5 text-text-muted" />
      )}
      <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      {description && (
        <p className="mt-1 max-w-md text-sm leading-relaxed text-text-secondary">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}
