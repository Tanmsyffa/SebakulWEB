'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-24 w-full rounded-lg border border-border-input bg-surface px-3.5 py-2.5 text-base leading-relaxed text-text-primary placeholder:text-text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-[#BDB6AB]',
          'focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-primary/12',
          'aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus-visible:ring-status-danger/15',
          'disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60',
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = 'Textarea';

export { Textarea };
