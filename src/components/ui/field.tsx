'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Label } from './label';

export interface FieldControlA11yProps {
  id: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean;
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode | ((a11y: FieldControlA11yProps) => React.ReactNode);
}

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  const generatedId = React.useId();
  const controlId = htmlFor ?? `field-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined;

  const a11yProps: FieldControlA11yProps = {
    id: controlId,
    'aria-describedby': describedBy,
    'aria-invalid': error ? true : undefined,
  };

  let renderedControl: React.ReactNode;
  if (typeof children === 'function') {
    renderedControl = children(a11yProps);
  } else if (
    React.isValidElement<Record<string, unknown>>(children) &&
    children.type !== 'div' &&
    children.type !== 'span'
  ) {
    renderedControl = React.cloneElement(children, {
      id: (children.props.id as string | undefined) ?? controlId,
      'aria-describedby':
        (children.props['aria-describedby'] as string | undefined) ?? describedBy,
      'aria-invalid':
        (children.props['aria-invalid'] as boolean | undefined) ?? (error ? true : undefined),
    });
  } else {
    renderedControl = children;
  }

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId} requiredMark={required}>
        {label}
      </Label>
      {renderedControl}
      {hint && (
        <p id={hintId} className="text-xs leading-normal text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium leading-normal text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}
