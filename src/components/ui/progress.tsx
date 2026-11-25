import { cn } from '@/lib/utils';

const toneClasses = {
  brand: 'bg-brand-primary',
  success: 'bg-status-success',
  warning: 'bg-status-warning',
  danger: 'bg-status-danger',
} as const;

export interface ProgressProps {
  value: number;
  max?: number;
  label?: string;
  showValue?: boolean;
  tone?: keyof typeof toneClasses;
  className?: string;
  indicatorClassName?: string;
}

export function Progress({
  value,
  max = 100,
  label,
  showValue = false,
  tone = 'brand',
  className,
  indicatorClassName,
}: ProgressProps) {
  const safeMax = max > 0 ? max : 100;
  const percent = Math.min(100, Math.max(0, (value / safeMax) * 100));

  return (
    <div className="w-full space-y-1.5">
      {(label || showValue) && (
        <div className="flex items-center justify-between gap-2 text-xs font-medium text-text-secondary">
          <span>{label}</span>
          {showValue && (
            <span className="font-mono font-semibold text-text-primary tabular-nums">
              {Math.round(percent)}%
            </span>
          )}
        </div>
      )}
      <div
        role="progressbar"
        aria-label={label ?? 'Progres'}
        aria-valuenow={Math.round(percent)}
        aria-valuemin={0}
        aria-valuemax={100}
        className={cn(
          'h-3 w-full overflow-hidden rounded-full bg-surface-muted border border-border-subtle',
          className
        )}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width] duration-300 ease-out motion-reduce:transition-none',
            toneClasses[tone],
            indicatorClassName
          )}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
