import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatTone = 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

const valueToneClasses: Record<StatTone, string> = {
  neutral: 'text-text-primary',
  brand: 'text-text-primary',
  success: 'text-status-success',
  warning: 'text-status-warning',
  danger: 'text-status-danger',
  info: 'text-text-primary',
};

const trendToneClasses = {
  success: 'text-status-success',
  danger: 'text-status-danger',
  neutral: 'text-text-secondary',
} as const;

export interface StatTrend {
  label: string;
  direction: 'up' | 'down' | 'flat';
  tone?: keyof typeof trendToneClasses;
}

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: LucideIcon;
  tone?: StatTone;
  trend?: StatTrend;
  href?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'neutral',
  trend,
  href,
  className,
}: StatCardProps) {
  const TrendIcon =
    trend?.direction === 'up'
      ? ArrowUpRight
      : trend?.direction === 'down'
      ? ArrowDownRight
      : Minus;

  const content = (
    <div
      className={cn(
        'flex h-full flex-col justify-between rounded-xl border border-border-subtle bg-surface p-4 sm:p-5',
        href &&
          'transition-colors duration-150 hover:border-border-strong',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-text-secondary">
          {label}
        </p>
        {Icon && (
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
        )}
      </div>

      <div className="mt-2.5 space-y-1.5">
        <div
          className={cn(
            'font-mono text-xl font-semibold tracking-tight tabular-nums break-words sm:text-2xl',
            valueToneClasses[tone]
          )}
        >
          {value}
        </div>

        {(hint || trend) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            {hint && <p className="text-xs leading-snug text-text-muted">{hint}</p>}
            {trend && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 text-xs font-medium',
                  trendToneClasses[trend.tone ?? 'neutral']
                )}
              >
                <TrendIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                <span>{trend.label}</span>
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
      >
        {content}
      </Link>
    );
  }

  return content;
}
