'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, FileSpreadsheet, Wallet } from 'lucide-react';
import { getWarungPeriodReport } from '@/server/actions/warung.actions';
import { formatRupiah } from '@/lib/utils/currency';
import { cn } from '@/lib/utils';
import { FilterBar, PageHeader, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { ExportCSVButton, ExportPDFButton } from '@/components/reports/export-buttons';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type Report = Awaited<ReturnType<typeof getWarungPeriodReport>>;

const CATEGORY_LABELS: Record<string, string> = {
  OMZET_HARIAN: 'Omzet harian',
  PENDAPATAN_LAIN: 'Pendapatan lain',
  BELANJA_BAHAN: 'Belanja bahan',
  SEWA_LAPAK: 'Sewa lapak',
  OPERASIONAL: 'Operasional warung',
  LAINNYA: 'Lainnya',
};

function formatCategoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? category.replaceAll('_', ' ');
}

export function WarungReportClient({ initialReport }: { initialReport: Report }) {
  const [report, setReport] = React.useState(initialReport);
  const [startDate, setStartDate] = React.useState(initialReport.startDate);
  const [endDate, setEndDate] = React.useState(initialReport.endDate);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  // Realtime router.refresh() supplies a new server snapshot. Keep the
  // selected date range and update the displayed report when that snapshot
  // covers the same period currently shown.
  React.useEffect(() => {
    if (startDate === initialReport.startDate && endDate === initialReport.endDate) {
      setReport(initialReport);
    }
  }, [initialReport, startDate, endDate]);

  async function loadReport(event: React.FormEvent) {
    event.preventDefault();
    if (busy) return;
    setError('');

    if (!startDate || !endDate) {
      setError('Pilih tanggal mulai dan tanggal akhir laporan.');
      return;
    }

    const startMs = Date.parse(`${startDate}T00:00:00+07:00`);
    const endMs = Date.parse(`${endDate}T00:00:00+07:00`);
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) {
      setError('Tanggal mulai tidak boleh melewati tanggal akhir.');
      return;
    }
    if (endMs - startMs > 366 * 24 * 60 * 60 * 1000) {
      setError('Rentang laporan maksimal 1 tahun.');
      return;
    }

    setBusy(true);
    try {
      setReport(await getWarungPeriodReport({ startDate, endDate }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Laporan gagal dimuat.');
    } finally {
      setBusy(false);
    }
  }

  const period = `${report.startDate} sampai ${report.endDate}`;
  const exportRows = report.rows.map((row) => [
    formatCategoryLabel(row.category),
    row.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
    row.count,
    formatRupiah(row.total),
  ]);

  const pdf = {
    title: 'Ringkasan buku kas warung',
    subtitle:
      'Ringkasan ini menghitung transaksi kas yang dicatat, bukan laba bersih akuntansi.',
    period,
    summary: [
      { label: 'Pemasukan tercatat', value: formatRupiah(report.income) },
      { label: 'Pengeluaran tercatat', value: formatRupiah(report.expense) },
      { label: 'Selisih kas', value: formatRupiah(report.net) },
    ] as [
      { label: string; value: string },
      { label: string; value: string },
      { label: string; value: string },
    ],
    headers: ['Kategori', 'Jenis', 'Jumlah transaksi', 'Total'],
    rows: exportRows.map((row) => row.map(String)),
    filename: `laporan-kas-${report.startDate}-${report.endDate}`,
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Pembukuan warung"
        title="Laporan kas"
        description="Ringkasan transaksi berdasarkan rentang tanggal. Laporan ini belum memperhitungkan stok akhir, utang, atau HPP."
        actions={
          <>
            <ExportCSVButton
              headers={['Kategori', 'Jenis', 'Jumlah transaksi', 'Total']}
              rows={exportRows}
              filename={`laporan-kas-${report.startDate}`}
            />
            <ExportPDFButton config={pdf} />
          </>
        }
      />

      <form onSubmit={loadReport} noValidate>
        <FilterBar
          actions={
            <Button type="submit" disabled={busy} isLoading={busy} className="w-full md:w-auto">
              Tampilkan
            </Button>
          }
        >
          <Field label="Dari tanggal" htmlFor="report-start" required>
            <Input
              id="report-start"
              type="date"
              required
              value={startDate}
              max={endDate || undefined}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </Field>
          <Field label="Sampai tanggal" htmlFor="report-end" required>
            <Input
              id="report-end"
              type="date"
              required
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </Field>
        </FilterBar>
      </form>

      {error && <Alert variant="danger">{error}</Alert>}

      <Stagger itemCount={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label="Pemasukan tercatat"
            value={<AnimatedNumber value={report.income} format={formatRupiah} />}
            tone="success"
            icon={ArrowUpRight}
            hint={`Periode ${period}`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Pengeluaran tercatat"
            value={<AnimatedNumber value={report.expense} format={formatRupiah} />}
            tone="danger"
            icon={ArrowDownRight}
            hint={`Periode ${period}`}
          />
        </StaggerItem>
        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Selisih kas"
            value={<AnimatedNumber value={report.net} format={formatRupiah} />}
            tone={report.net >= 0 ? 'brand' : 'danger'}
            icon={Wallet}
            hint="Pemasukan dikurangi pengeluaran"
          />
        </StaggerItem>
      </Stagger>

      <FadeIn delay={0.08}>
        <Section title="Rincian kategori" description={`Periode ${period}`}>
          {report.rows.length === 0 ? (
            <EmptyState
              compact
              icon={FileSpreadsheet}
              title="Belum ada transaksi pada periode ini"
              description="Ubah rentang tanggal di atas atau catat transaksi baru di Buku kas."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead numeric>Jumlah transaksi</TableHead>
                        <TableHead numeric>Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.rows.map((row) => (
                        <TableRow key={`${row.type}-${row.category}`}>
                          <TableCell className="font-semibold">
                            {formatCategoryLabel(row.category)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={row.type === 'INCOME' ? 'success' : 'danger'}>
                              {row.type === 'INCOME' ? (
                                <ArrowUpRight
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                              ) : (
                                <ArrowDownRight
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                              )}
                              <span>{row.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}</span>
                            </Badge>
                          </TableCell>
                          <TableCell numeric>{row.count}</TableCell>
                          <TableCell
                            numeric
                            className={cn(
                              'font-bold',
                              row.type === 'INCOME'
                                ? 'text-status-success'
                                : 'text-status-danger'
                            )}
                          >
                            {formatRupiah(row.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell colSpan={3}>Selisih kas periode ini</TableCell>
                        <TableCell
                          numeric
                          className={report.net >= 0 ? 'text-brand-primary' : 'text-status-danger'}
                        >
                          {formatRupiah(report.net)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </TableContainer>
              </div>

              <Card className="md:hidden">
                <CardContent className="p-4 divide-y divide-border-subtle">
                  {report.rows.map((row) => (
                    <div
                      key={`${row.type}-${row.category}`}
                      className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <div className="min-w-0 space-y-1">
                        <p className="truncate text-sm font-semibold text-text-primary">
                          {formatCategoryLabel(row.category)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={row.type === 'INCOME' ? 'success' : 'danger'}>
                            {row.type === 'INCOME' ? (
                              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            ) : (
                              <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                            )}
                            <span>{row.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran'}</span>
                          </Badge>
                          <span className="text-xs text-text-secondary font-mono tabular-nums">
                            {row.count} transaksi
                          </span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-mono text-sm font-bold tabular-nums',
                          row.type === 'INCOME' ? 'text-status-success' : 'text-status-danger'
                        )}
                      >
                        {formatRupiah(row.total)}
                      </span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </Section>
      </FadeIn>
    </PageTransition>
  );
}
