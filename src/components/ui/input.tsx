'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const baseInputClasses =
  'flex min-h-11 w-full rounded-lg border border-border-input bg-surface px-3.5 py-2 text-base text-text-primary placeholder:text-text-muted/80 transition-[border-color,box-shadow] duration-150 hover:border-[#BDB6AB] focus-visible:border-brand-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-brand-primary/12 aria-[invalid=true]:border-status-danger aria-[invalid=true]:focus-visible:ring-status-danger/15 disabled:cursor-not-allowed disabled:bg-surface-muted disabled:opacity-60';

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(baseInputClasses, className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export interface RupiahInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
}

function formatWithDots(num: number): string {
  if (!Number.isFinite(num) || num <= 0) return '';
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function parseDots(str: string): number {
  const cleaned = str.replace(/\./g, '').replace(/\D/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
}

const RupiahInput = React.forwardRef<HTMLInputElement, RupiahInputProps>(
  ({ value, onValueChange, className, ...props }, ref) => {
    const [display, setDisplay] = React.useState(formatWithDots(value));

    React.useEffect(() => {
      setDisplay(formatWithDots(value));
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const num = parseDots(e.target.value);
      setDisplay(formatWithDots(num));
      onValueChange(num);
    };

    return (
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-text-secondary select-none"
        >
          Rp
        </span>
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          pattern="[0-9.]*"
          value={display}
          onChange={handleChange}
          className={cn(
            baseInputClasses,
            'pl-11 pr-4 font-mono tabular-nums',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
RupiahInput.displayName = 'RupiahInput';

export interface NumericInputProps extends Omit<InputProps, 'value' | 'onChange'> {
  value: number;
  onValueChange: (value: number) => void;
  suffix?: string;
}

const NumericInput = React.forwardRef<HTMLInputElement, NumericInputProps>(
  ({ value, onValueChange, suffix, className, ...props }, ref) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const cleaned = e.target.value.replace(/\D/g, '');
      onValueChange(cleaned ? parseInt(cleaned, 10) : 0);
    };

    return (
      <div className="relative">
        <input
          ref={ref}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value === 0 ? '' : value.toString()}
          onChange={handleChange}
          className={cn(
            baseInputClasses,
            'font-mono tabular-nums',
            suffix ? 'pr-16' : '',
            className
          )}
          {...props}
        />
        {suffix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-text-secondary select-none"
          >
            {suffix}
          </span>
        )}
      </div>
    );
  }
);
NumericInput.displayName = 'NumericInput';

export { Input, RupiahInput, NumericInput };
