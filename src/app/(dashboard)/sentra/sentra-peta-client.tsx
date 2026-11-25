'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Coffee,
  FileText,
  Search,
  ShoppingBag,
  Store,
  Wrench,
} from 'lucide-react';
import { FilterBar, Section } from '@/components/layout';
import { Pressable, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, InvoiceStatusBadge, LapakStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils/currency';
import { updateLapakStatus } from '@/server/actions/lapak.actions';
import type { BillingCycle, InvoiceStatus, LapakStatus } from '@/types';

interface LapakItem {
  id: string;
  code: string;
  status: LapakStatus;
  billingCycle?: BillingCycle;
  baseRentAmount?: number;
  warungName: string | null;
  warungCategory: string | null;
  depositBalance?: number | null;
  latestInvoice: {
    status: InvoiceStatus;
    remainingAmount: number;
    totalAmount: number;
    periodEnd: string;
  } | null;
}

const STATUS_OPTIONS: {
  value: LapakStatus;
  label: string;
  hint: string;
  icon: typeof Store;
  requiresWarung?: boolean;
  releasesWarung?: boolean;
}[] = [
  {
    value: 'TERISI',
    label: 'TERISI',
    hint: 'Lapak aktif beroperasi dan ditagih normal.',
    icon: ShoppingBag,
    requiresWarung: true,
  },
  {
    value: 'LIBUR',
    label: 'LIBUR',
    hint: 'Warung tutup sementara; tagihan sewa pokok dibebaskan.',
    icon: Coffee,
    requiresWarung: true,
  },
  {
    value: 'PERBAIKAN',
    label: 'PERBAIKAN',
    hint: 'Dalam renovasi; tidak ditempati dan tidak ditagih.',
    icon: Wrench,
    releasesWarung: true,
  },
  {
    value: 'KOSONG',
    label: 'KOSONG',
    hint: 'Tidak berpenghuni dan tersedia untuk disewakan.',
    icon: Store,
    releasesWarung: true,
  },
];

const cycleLabels: Record<BillingCycle, string> = {
  HARIAN: 'harian',
  MINGGUAN: 'mingguan',
  BULANAN: 'bulanan',
};

function formatPeriodMonth(periodEnd: string | undefined): string {
  if (!periodEnd || periodEnd.length < 7) return 'Terbaru';
  const [year, month] = periodEnd.slice(0, 7).split('-').map(Number);
  if (!year || !month) return periodEnd.slice(0, 7);
  const date = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

export function SentraPetaClient({ initialLapaks }: { initialLapaks: LapakItem[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | LapakStatus>('ALL');
  const [selectedLapak, setSelectedLapak] = React.useState<LapakItem | null>(null);
  const [confirmReleaseStatus, setConfirmReleaseStatus] = React.useState<LapakStatus | null>(null);
  const [updating, setUpdating] = React.useState(false);
  const [dialogError, setDialogError] = React.useState('');
  const [feedback, setFeedback] = React.useState<{
    variant: 'success' | 'danger';
    text: string;
  } | null>(null);

  const counts = React.useMemo(() => {
    const map: Record<'ALL' | LapakStatus, number> = {
      ALL: initialLapaks.length,
      TERISI: 0,
      LIBUR: 0,
      PERBAIKAN: 0,
      KOSONG: 0,
    };
    for (const item of initialLapaks) {
      map[item.status] += 1;
    }
    return map;
  }, [initialLapaks]);

  const filteredLapaks = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return initialLapaks.filter((lapak) => {
      if (statusFilter !== 'ALL' && lapak.status !== statusFilter) return false;
      if (!q) return true;
      return (
        lapak.code.toLowerCase().includes(q) ||
        (lapak.warungName?.toLowerCase().includes(q) ?? false) ||
        (lapak.warungCategory?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [initialLapaks, searchQuery, statusFilter]);

  const openLapakModal = (lapak: LapakItem) => {
    setSelectedLapak(lapak);
    setConfirmReleaseStatus(null);
    setDialogError('');
  };

  const closeLapakModal = (open: boolean) => {
    if (!open && !updating) {
      setSelectedLapak(null);
      setConfirmReleaseStatus(null);
      setDialogError('');
    }
  };

  const executeStatusUpdate = async (newStatus: LapakStatus) => {
    if (!selectedLapak) return;
    setUpdating(true);
    setDialogError('');
    try {
      await updateLapakStatus(selectedLapak.id, newStatus);
      const updatedCode = selectedLapak.code;
      setSelectedLapak(null);
      setConfirmReleaseStatus(null);
      setFeedback({
        variant: 'success',
        text: `Status Lapak ${updatedCode} berhasil diperbarui menjadi ${newStatus}.`,
      });
      router.refresh();
    } catch (err) {
      setDialogError(
        err instanceof Error ? err.message : 'Gagal mengubah status lapak.'
      );
    } finally {
      setUpdating(false);
    }
  };

  const handleSelectStatus = (option: (typeof STATUS_OPTIONS)[number]) => {
    if (!selectedLapak || updating) return;
    if (selectedLapak.status === option.value) return;

    if (option.releasesWarung && selectedLapak.warungName) {
      setDialogError('');
      setConfirmReleaseStatus(option.value);
      return;
    }

    void executeStatusUpdate(option.value);
  };

  return (
    <Section
      title="Daftar lapak sentra"
      description="Setiap kartu menampilkan status fisik lapak sekaligus status tagihan terakhir. Pilih lapak untuk mengubah status fisiknya."
    >
      {feedback && (
        <Alert
          variant={feedback.variant}
          role={feedback.variant === 'danger' ? 'alert' : 'status'}
          aria-live="polite"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setFeedback(null)}
            >
              Tutup
            </Button>
          }
        >
          {feedback.text}
        </Alert>
      )}

      {initialLapaks.length > 0 && (
        <FilterBar
          actions={
            (searchQuery.trim() !== '' || statusFilter !== 'ALL') && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchQuery('');
                  setStatusFilter('ALL');
                }}
              >
                Reset filter
              </Button>
            )
          }
        >
          <Field label="Cari lapak atau warung" className="min-w-0 sm:min-w-60 lg:flex-1">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Contoh: A-01 atau Mie Ayam"
                className="pl-10"
              />
            </div>
          </Field>

          <div className="min-w-0 sm:col-span-2 lg:w-auto">
            <p className="mb-1.5 text-sm font-medium text-text-primary">
              Status fisik
            </p>
            <Tabs
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as 'ALL' | LapakStatus)}
            >
              <TabsList label="Filter status fisik lapak">
                <TabsTrigger value="ALL">Semua ({counts.ALL})</TabsTrigger>
                <TabsTrigger value="TERISI">Terisi ({counts.TERISI})</TabsTrigger>
                <TabsTrigger value="LIBUR">Libur ({counts.LIBUR})</TabsTrigger>
                <TabsTrigger value="PERBAIKAN">Perbaikan ({counts.PERBAIKAN})</TabsTrigger>
                <TabsTrigger value="KOSONG">Kosong ({counts.KOSONG})</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </FilterBar>
      )}

      {initialLapaks.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Belum ada lapak terdaftar"
          description="Data lapak sentra belum dibuat. Minta Super Admin menambahkan lapak terlebih dahulu."
        />
      ) : filteredLapaks.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="Tidak ada lapak yang cocok"
          description="Tidak ditemukan lapak dengan kata kunci atau filter status yang dipilih."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('ALL');
              }}
            >
              Tampilkan semua lapak
            </Button>
          }
        />
      ) : (
        <Stagger
          itemCount={filteredLapaks.length}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {filteredLapaks.map((lapak) => {
            const invoiceLabel = formatPeriodMonth(lapak.latestInvoice?.periodEnd);
            return (
              <StaggerItem key={lapak.id}>
                <Pressable className="h-full">
                  <button
                    type="button"
                    onClick={() => openLapakModal(lapak)}
                    aria-label={`Ubah status Lapak ${lapak.code}, status fisik ${lapak.status}, ${lapak.warungName || 'kosong sementara'}`}
                    className="flex h-full w-full flex-col justify-between rounded-2xl border border-border-subtle bg-surface p-4 text-left shadow-xs transition-[border-color,box-shadow] duration-150 hover:border-brand-primary hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 sm:p-5"
                  >
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-base font-bold tracking-tight text-text-primary">
                          Lapak {lapak.code}
                        </span>
                        <LapakStatusBadge status={lapak.status} />
                      </div>

                      <div className="space-y-0.5">
                        <p className="text-sm font-semibold text-text-primary">
                          {lapak.warungName || 'Kosong sementara'}
                        </p>
                        {(lapak.warungCategory || typeof lapak.baseRentAmount === 'number') && (
                          <p className="text-xs text-text-secondary">
                            {[
                              lapak.warungCategory,
                              typeof lapak.baseRentAmount === 'number'
                                ? `${formatRupiah(lapak.baseRentAmount)} / ${
                                    lapak.billingCycle
                                      ? cycleLabels[lapak.billingCycle]
                                      : 'periode'
                                  }`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                      <span className="text-xs font-medium text-text-secondary">
                        Tagihan {invoiceLabel}
                      </span>

                      {lapak.latestInvoice ? (
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <InvoiceStatusBadge status={lapak.latestInvoice.status} />
                          {lapak.latestInvoice.remainingAmount > 0 && (
                            <span className="font-mono text-sm font-bold text-text-primary tabular-nums">
                              {formatRupiah(lapak.latestInvoice.remainingAmount)}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Badge variant="muted">
                          <FileText aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          <span>Belum ada tagihan</span>
                        </Badge>
                      )}
                    </div>
                  </button>
                </Pressable>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}

      <Dialog open={Boolean(selectedLapak)} onOpenChange={closeLapakModal}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>Ubah status Lapak {selectedLapak?.code}</DialogTitle>
            <DialogDescription>
              Atur status kondisi fisik lapak. Jika diset LIBUR, tagihan sewa pokok periode berjalan otomatis dibebaskan (DIBEBASKAN).
            </DialogDescription>
          </DialogHeader>

          {selectedLapak && (
            <div className="space-y-4">
              <div className="rounded-xl border border-border-subtle bg-surface-muted p-3.5 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-text-primary">
                    {selectedLapak.warungName || 'Belum ada warung terhubung'}
                  </span>
                  <LapakStatusBadge status={selectedLapak.status} />
                </div>
                {typeof selectedLapak.depositBalance === 'number' &&
                  selectedLapak.warungName && (
                    <p className="mt-1 text-xs text-text-secondary">
                      Saldo deposit warung:{' '}
                      <span className="font-mono font-semibold text-text-primary tabular-nums">
                        {formatRupiah(selectedLapak.depositBalance)}
                      </span>
                    </p>
                  )}
              </div>

              {dialogError && (
                <Alert variant="danger" role="alert">
                  {dialogError}
                </Alert>
              )}

              {!selectedLapak.warungName && (
                <Alert variant="info">
                  Status TERISI dan LIBUR hanya tersedia setelah Super Admin menghubungkan warung ke lapak ini.
                </Alert>
              )}

              {confirmReleaseStatus ? (
                <div className="space-y-4 rounded-xl border border-status-warning-border bg-status-warning-bg p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      aria-hidden="true"
                      className="mt-0.5 h-5 w-5 shrink-0 text-status-warning"
                    />
                    <div className="space-y-1 text-sm">
                      <p className="font-semibold text-text-primary">
                        Konfirmasi ubah status ke {confirmReleaseStatus}
                      </p>
                      <p className="text-text-secondary">
                        Mengubah status ke {confirmReleaseStatus} akan melepas penempatan{' '}
                        <span className="font-semibold text-text-primary">
                          {selectedLapak.warungName}
                        </span>{' '}
                        dan menghapus rincian kontrak apabila masa kontrak tidak lagi aktif.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={updating}
                      onClick={() => setConfirmReleaseStatus(null)}
                    >
                      Batal
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      isLoading={updating}
                      onClick={() => void executeStatusUpdate(confirmReleaseStatus)}
                    >
                      Ya, ubah ke {confirmReleaseStatus}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {STATUS_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isCurrent = selectedLapak.status === option.value;
                    const needsWarungMissing =
                      Boolean(option.requiresWarung) && !selectedLapak.warungName;
                    const isDisabled = updating || isCurrent || needsWarungMissing;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isCurrent}
                        disabled={isDisabled}
                        onClick={() => handleSelectStatus(option)}
                        className={cn(
                          'flex min-h-14 flex-col items-start gap-1 rounded-lg border p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                          isCurrent
                            ? 'border-brand-primary bg-brand-soft/60 text-brand-hover'
                            : 'border-border-subtle bg-surface text-text-primary hover:bg-surface-muted',
                          isDisabled && !isCurrent && 'cursor-not-allowed opacity-50'
                        )}
                      >
                        <span className="flex w-full items-center justify-between gap-2 text-sm font-semibold">
                          <span className="inline-flex items-center gap-2">
                            <Icon aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <span>{option.label}</span>
                          </span>
                          {isCurrent && (
                            <span className="text-xs font-medium text-brand-primary">
                              Aktif
                            </span>
                          )}
                        </span>
                        <span className="text-xs leading-snug text-text-secondary">
                          {option.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={updating}
                  onClick={() => closeLapakModal(false)}
                >
                  Tutup
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
