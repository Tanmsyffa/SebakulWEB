import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: string;
  backHref?: string;
  backLabel?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  backHref,
  backLabel = 'Kembali',
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('space-y-2 border-b border-border-subtle pb-4', className)}>
      {backHref && (
        <div>
          <Link
            href={backHref}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 -ml-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <ArrowLeft aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>{backLabel}</span>
          </Link>
        </div>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow && (
            <p className="text-xs font-medium text-text-muted">
              {eyebrow}
            </p>
          )}
          <h1 className="text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
            {title}
          </h1>
          {description && (
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
            {actions}
          </div>
        )}
      </div>
    </header>
  );
}
