'use client';

import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-primary/20 active:scale-[0.99] motion-reduce:active:scale-100 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-brand-primary text-white hover:bg-brand-hover active:bg-brand-active',
        secondary:
          'border border-border-strong bg-surface text-text-primary hover:bg-surface-muted/70 hover:border-[#C5BEB3] active:bg-surface-muted',
        danger:
          'border border-status-danger-border bg-status-danger-bg text-status-danger hover:bg-red-100/70 active:bg-red-100',
        destructive:
          'bg-status-danger text-white hover:bg-red-800 active:bg-red-900',
        ghost:
          'text-text-secondary hover:bg-surface-muted hover:text-text-primary active:bg-stone-200/50',
        outline:
          'border border-brand-primary/40 bg-transparent text-brand-primary hover:bg-brand-soft active:bg-brand-light/40',
        link:
          'text-brand-primary underline-offset-4 hover:underline active:scale-100',
      },
      size: {
        default: 'min-h-11 px-4 py-2 text-sm rounded-lg',
        sm: 'min-h-10 px-3.5 py-1.5 text-sm rounded-lg',
        lg: 'min-h-12 px-5 py-2.5 text-[15px] rounded-lg',
        icon: 'h-11 w-11 rounded-lg p-0',
        'icon-sm': 'h-10 w-10 rounded-lg p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  isLoading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, isLoading, children, disabled, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || isLoading}
        aria-busy={isLoading || undefined}
        {...props}
      >
        {isLoading && (
          <Loader2
            aria-hidden="true"
            className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none"
          />
        )}
        {children}
      </button>
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
