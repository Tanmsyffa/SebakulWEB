import * as React from 'react';
import { cn } from '@/lib/utils';

export interface SectionProps extends React.HTMLAttributes<HTMLElement> {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  headingLevel?: 'h2' | 'h3';
}

export function Section({
  title,
  description,
  actions,
  headingLevel = 'h2',
  children,
  className,
  ...props
}: SectionProps) {
  const Heading = headingLevel;

  return (
    <section className={cn('space-y-3', className)} {...props}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 space-y-0.5">
            {title && (
              <Heading
                className={cn(
                  'font-semibold tracking-tight text-text-primary',
                  headingLevel === 'h2' ? 'text-base sm:text-lg' : 'text-base'
                )}
              >
                {title}
              </Heading>
            )}
            {description && (
              <p className="text-sm text-text-secondary">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{actions}</div>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
