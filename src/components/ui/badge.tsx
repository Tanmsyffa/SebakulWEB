import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Coffee,
  MinusCircle,
  ShoppingBag,
  Store,
  Wrench,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium leading-none whitespace-nowrap',
  {
    variants: {
      variant: {
        neutral: 'bg-status-neutral-bg text-status-neutral',
        brand: 'bg-brand-soft text-brand-primary',
        success: 'bg-status-success-bg text-status-success',
        warning: 'bg-status-warning-bg text-status-warning',
        danger: 'bg-status-danger-bg text-status-danger',
        info: 'bg-status-info-bg text-status-info',
        muted: 'bg-status-muted-bg text-status-muted',
        maintenance: 'bg-status-maintenance-bg text-status-maintenance',
      },
    },
    defaultVariants: {
      variant: 'neutral',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

type InvoiceStatus = 'PAID' | 'PARTIAL' | 'UNPAID' | 'WAIVED';

const invoiceConfig: Record<
  InvoiceStatus,
  { label: string; variant: VariantProps<typeof badgeVariants>['variant']; icon: typeof CheckCircle2 }
> = {
  PAID: {
    label: 'Lunas',
    variant: 'success',
    icon: CheckCircle2,
  },
  PARTIAL: {
    label: 'Cicilan',
    variant: 'warning',
    icon: Clock,
  },
  UNPAID: {
    label: 'Belum bayar',
    variant: 'danger',
    icon: AlertCircle,
  },
  WAIVED: {
    label: 'Dibebaskan',
    variant: 'neutral',
    icon: MinusCircle,
  },
};

export function InvoiceStatusBadge({
  status,
  className,
}: {
  status: InvoiceStatus;
  className?: string;
}) {
  const config = invoiceConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  );
}

type LapakStatus = 'KOSONG' | 'TERISI' | 'LIBUR' | 'PERBAIKAN';

const lapakConfig: Record<
  LapakStatus,
  { label: string; variant: VariantProps<typeof badgeVariants>['variant']; icon: typeof Store }
> = {
  KOSONG: {
    label: 'Kosong',
    variant: 'neutral',
    icon: Store,
  },
  TERISI: {
    label: 'Terisi',
    variant: 'info',
    icon: ShoppingBag,
  },
  LIBUR: {
    label: 'Libur',
    variant: 'muted',
    icon: Coffee,
  },
  PERBAIKAN: {
    label: 'Perbaikan',
    variant: 'maintenance',
    icon: Wrench,
  },
};

export function LapakStatusBadge({
  status,
  className,
}: {
  status: LapakStatus;
  className?: string;
}) {
  const config = lapakConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  );
}

type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';

const ticketConfig: Record<
  TicketStatus,
  { label: string; variant: VariantProps<typeof badgeVariants>['variant']; icon: typeof AlertCircle }
> = {
  OPEN: {
    label: 'Terbuka',
    variant: 'danger',
    icon: AlertCircle,
  },
  IN_PROGRESS: {
    label: 'Diproses',
    variant: 'warning',
    icon: Clock,
  },
  RESOLVED: {
    label: 'Selesai',
    variant: 'success',
    icon: CheckCircle2,
  },
};

export function TicketStatusBadge({
  status,
  className,
}: {
  status: TicketStatus;
  className?: string;
}) {
  const config = ticketConfig[status];
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className={className}>
      <Icon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>{config.label}</span>
    </Badge>
  );
}

export function StockStatusBadge({
  currentStock,
  minThreshold,
  className,
}: {
  currentStock: number;
  minThreshold: number;
  className?: string;
}) {
  const isLow = currentStock <= minThreshold;

  return (
    <Badge variant={isLow ? 'warning' : 'success'} className={className}>
      {isLow ? (
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      ) : (
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      )}
      <span>{isLow ? 'Menipis' : 'Aman'}</span>
    </Badge>
  );
}

export { badgeVariants };
