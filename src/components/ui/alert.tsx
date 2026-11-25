import * as React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Info, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger' | 'neutral';

const variantStyles: Record<
  AlertVariant,
  { container: string; iconColor: string; defaultIcon: LucideIcon }
> = {
  info: {
    container: 'border-status-info-border/70 bg-status-info-bg/70 text-text-primary',
    iconColor: 'text-status-info',
    defaultIcon: Info,
  },
  success: {
    container: 'border-status-success-border/70 bg-status-success-bg/70 text-text-primary',
    iconColor: 'text-status-success',
    defaultIcon: CheckCircle2,
  },
  warning: {
    container: 'border-status-warning-border/70 bg-status-warning-bg/70 text-text-primary',
    iconColor: 'text-status-warning',
    defaultIcon: AlertTriangle,
  },
  danger: {
    container: 'border-status-danger-border/70 bg-status-danger-bg/70 text-text-primary',
    iconColor: 'text-status-danger',
    defaultIcon: AlertCircle,
  },
  neutral: {
    container: 'border-border-subtle bg-surface-muted/60 text-text-primary',
    iconColor: 'text-text-secondary',
    defaultIcon: Info,
  },
};

export interface AlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: AlertVariant;
  title?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}

export function Alert({
  variant = 'info',
  title,
  icon,
  action,
  children,
  className,
  role,
  ...props
}: AlertProps) {
  const style = variantStyles[variant];
  const Icon = icon ?? style.defaultIcon;
  const resolvedRole =
    role ?? (variant === 'danger' || variant === 'warning' ? 'alert' : 'status');

  return (
    <div
      role={resolvedRole}
      className={cn(
        'flex flex-col gap-3 rounded-xl border px-4 py-3.5 sm:flex-row sm:items-start sm:justify-between',
        style.container,
        className
      )}
      {...props}
    >
      <div className="flex items-start gap-2.5">
        <Icon aria-hidden="true" className={cn('mt-0.5 h-4 w-4 shrink-0', style.iconColor)} />
        <div className="min-w-0 space-y-0.5 text-sm leading-relaxed">
          {title && <p className="font-medium text-text-primary">{title}</p>}
          {children && <div className="text-text-secondary">{children}</div>}
        </div>
      </div>
      {action && <div className="shrink-0 sm:pl-3">{action}</div>}
    </div>
  );
}
