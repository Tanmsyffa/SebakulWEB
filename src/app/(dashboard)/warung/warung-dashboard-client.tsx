'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckCircle2,
  PauseCircle,
  Package,
  Plus,
  Wallet,
} from 'lucide-react';
import { toggleWarungOpen } from '@/server/actions/warung.actions';
import { formatRupiah } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { CashflowLineChart } from '@/components/charts/cashflow-line-chart';
import { PageHeader, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { StockStatusBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';

interface LowStockItemSummary {
  id: string;
  itemName: string;
  unit: string;
  currentStock: number;
  minThreshold: number;
}

interface CashflowPoint {
  date: string;
  income: number;
  expense: number;
}

interface WarungDashboardClientProps {
  warungName: string;
  isOpenToday: boolean;
  greetingTime: string;
  displayName: string;
  todayIncome: number;
  todayExpense: number;
  todayProfit: number;
  cashflowChart: CashflowPoint[];
  lowStockItems: LowStockItemSummary[];
  inventoryCount: number;
}

export function WarungDashboardClient({
  warungName,
  isOpenToday,
  greetingTime,
  displayName,
  todayIncome,
  todayExpense,
  todayProfit,
  cashflowChart,
  lowStockItems,
  inventoryCount,
}: WarungDashboardClientProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = React.useState(isOpenToday);
  const [toggling, setToggling] = React.useState(false);
  const [statusFeedback, setStatusFeedback] = React.useState<{
    type: 'success' | 'danger';
    message: string;
  } | null>(null);

  React.useEffect(() => {
    setIsOpen(isOpenToday);
  }, [isOpenToday]);

  const handleToggleOpen = async () => {
    if (toggling) return;
    setToggling(true);
    setStatusFeedback(null);
    const nextOpen = !isOpen;
    try {
      await toggleWarungOpen();
      setIsOpen(nextOpen);
      setStatusFeedback({
        type: 'success',
        message: nextOpen
          ? 'Status warung diperbarui menjadi buka hari ini.'
          : 'Status warung diperbarui menjadi tutup sementara.',
      });
      router.refresh();
    } catch (err) {
      setStatusFeedback({
        type: 'danger',
        message: err instanceof Error ? err.message : 'Gagal memperbarui status buka warung.',
      });
    } finally {
      setToggling(false);
    }
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow={warungName}
        title={`Selamat ${greetingTime}, ${displayName}`}
        description="Pantau selisih kas hari ini, tren tujuh hari terakhir, dan bahan baku yang perlu diisi ulang."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              size="default"
              isLoading={toggling}
              aria-pressed={isOpen}
              onClick={handleToggleOpen}
              className={cn(
                isOpen
                  ? 'border-status-success-border bg-status-success-bg text-status-success hover:bg-status-success-bg/80'
                  : 'border-border-subtle bg-surface text-text-secondary hover:bg-surface-muted'
              )}
            >
              {isOpen ? (
                <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0" />
              ) : (
                <PauseCircle aria-hidden="true" className="h-4 w-4 shrink-0" />
              )}
              <span>{isOpen ? 'Warung buka' : 'Warung tutup'}</span>
            </Button>

            <Link
              href="/warung/kas?action=create"
              className={buttonVariants({ variant: 'default', size: 'default' })}
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Catat transaksi</span>
            </Link>
          </>
        }
      />

      {statusFeedback && (
        <Alert variant={statusFeedback.type}>{statusFeedback.message}</Alert>
      )}

      <Stagger itemCount={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label="Selisih kas hari ini"
            value={<AnimatedNumber value={todayProfit} format={formatRupiah} />}
            tone={todayProfit >= 0 ? 'brand' : 'danger'}
            icon={Wallet}
            hint="Pemasukan dikurangi belanja hari ini"
          />
        </StaggerItem>

        <StaggerItem>
          <StatCard
            label="Pemasukan hari ini"
            value={<AnimatedNumber value={todayIncome} format={formatRupiah} />}
            tone="success"
            icon={ArrowUpRight}
            href="/warung/kas"
            hint="Lihat rincian di Buku kas"
          />
        </StaggerItem>

        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Belanja hari ini"
            value={<AnimatedNumber value={todayExpense} format={formatRupiah} />}
            tone="danger"
            icon={ArrowDownRight}
            href="/warung/kas"
            hint="Catat belanja bahan atau operasional"
          />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <FadeIn delay={0.08} className="lg:col-span-7">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Pemasukan dan belanja, 7 hari</CardTitle>
              <CardDescription>
                Perbandingan arus kas harian warung selama tujuh hari terakhir.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <CashflowLineChart data={cashflowChart} />
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.12} className="lg:col-span-5">
          <Card className="h-full">
            <CardHeader className="flex-row items-start justify-between gap-3">
              <div className="space-y-1">
                <CardTitle>Stok menipis</CardTitle>
                <CardDescription>
                  Bahan yang jumlahnya mencapai atau di bawah batas minimum.
                </CardDescription>
              </div>
              <Link
                href="/warung/stok"
                className={cn(
                  buttonVariants({ variant: 'ghost', size: 'sm' }),
                  'shrink-0 text-brand-primary hover:text-brand-hover'
                )}
              >
                Kelola stok
              </Link>
            </CardHeader>
            <CardContent>
              {inventoryCount === 0 ? (
                <EmptyState
                  compact
                  icon={Package}
                  title="Stok belum dicatat"
                  description="Tambahkan bahan dan jumlah stok untuk mulai memantau persediaan."
                  action={
                    <Link
                      href="/warung/stok"
                      className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                    >
                      Kelola dan input stok
                    </Link>
                  }
                />
              ) : lowStockItems.length === 0 ? (
                <Alert variant="success" title="Semua stok bahan aman">
                  Seluruh {inventoryCount} bahan baku berada di atas batas minimum.
                </Alert>
              ) : (
                <Stagger
                  as="ul"
                  itemCount={lowStockItems.length}
                  className="divide-y divide-border-subtle"
                >
                  {lowStockItems.map((item) => (
                    <StaggerItem
                      as="li"
                      key={item.id}
                      className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {item.itemName}
                        </p>
                        <p className="mt-0.5 text-xs text-text-secondary font-mono tabular-nums">
                          Sisa: {item.currentStock} {item.unit} (min. {item.minThreshold})
                        </p>
                      </div>
                      <StockStatusBadge
                        currentStock={item.currentStock}
                        minThreshold={item.minThreshold}
                      />
                    </StaggerItem>
                  ))}
                </Stagger>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
