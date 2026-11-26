'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useHydratedReducedMotion } from '@/components/motion';
import {
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Plus,
  Search,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FilterBar, PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, PageTransition } from '@/components/motion';
import { ExportCSVButton, ExportPDFButton } from '@/components/reports/export-buttons';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input, RupiahInput } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { PDFExportOptions } from '@/lib/export/export-pdf';
import { formatActionError } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils/currency';
import { createSentraExpense } from '@/server/actions/lapak.actions';
import type { SentraLedger } from '@/types';

interface KasSentraClientProps {
  ledger: SentraLedger[];
  monthly: { month: string; rent: number; expense: number }[];
  sewaTerkumpul: number;
  tunggakan: number;
  invoiceCount: number;
  activeContractCount: number;
  biayaOperasional: number;
}

const EXPENSE_CATEGORIES = [
  { value: 'LISTRIK_PUSAT', label: 'Listrik pusat sentra' },
  { value: 'SAMPAH', label: 'Iuran kebersihan dan sampah' },
  { value: 'PERBAIKAN', label: 'Servis atau perbaikan fasilitas' },
  { value: 'AIR_PUSAT', label: 'Air bersih sentra' },
  { value: 'LAINNYA', label: 'Lain-lain' },
] as const;

const categoryLabelMap: Record<string, string> = {
  SEWA_LAPAK: 'Sewa lapak',
  LISTRIK_PUSAT: 'Listrik pusat sentra',
  SAMPAH: 'Kebersihan dan sampah',
  PERBAIKAN: 'Perbaikan fasilitas',
  AIR_PUSAT: 'Air bersih sentra',
  LAINNYA: 'Lain-lain',
};

function formatCategory(category: string): string {
  return categoryLabelMap[category] ?? category.replace(/_/g, ' ');
}

function compactAxis(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} jt`;
  if (value >= 1_000) return `${Math.round(value / 1_000)} rb`;
  return String(value);
}

const dateFormatterWIB = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'Asia/Jakarta',
});

export function KasSentraClient({
  ledger,
  monthly,
  sewaTerkumpul,
  tunggakan,
  invoiceCount,
  activeContractCount,
  biayaOperasional,
}: KasSentraClientProps) {
  const router = useRouter();
  const prefersReduced = useHydratedReducedMotion();

  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);
  const [amount, setAmount] = React.useState(0);
  const [category, setCategory] = React.useState('LISTRIK_PUSAT');
  const [description, setDescription] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [dialogError, setDialogError] = React.useState('');
  const expenseKey = React.useRef<string | null>(null);
  const [successMsg, setSuccessMsg] = React.useState('');

  const [typeFilter, setTypeFilter] = React.useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');
  const [showAllLedger, setShowAllLedger] = React.useState(false);

  const handleExpenseOpenChange = (open: boolean) => {
    if (!open && loading) return;
    setIsExpenseOpen(open);
    setDialogError('');
    if (open) {
      expenseKey.current = crypto.randomUUID();
    } else {
      expenseKey.current = null;
    }
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) {
      setDialogError('Masukkan nominal pengeluaran lebih dari Rp0.');
      return;
    }
    if (!description.trim()) {
      setDialogError('Masukkan rincian keterangan pengeluaran.');
      return;
    }

    setLoading(true);
    setDialogError('');
    try {
      const idempotencyKey =
        expenseKey.current ?? (expenseKey.current = crypto.randomUUID());
      await createSentraExpense({
        idempotencyKey,
        category,
        amount,
        description: description.trim(),
      });

      setAmount(0);
      expenseKey.current = null;
      setDescription('');
      setIsExpenseOpen(false);
      setSuccessMsg('Pengeluaran sentra berhasil dicatat ke buku kas.');
      router.refresh();
    } catch (err) {
      setDialogError(formatActionError(err, 'Gagal mencatat pengeluaran sentra.'));
    } finally {
      setLoading(false);
    }
  };

  const hasMonthlyData = monthly.some((item) => item.rent > 0 || item.expense > 0);

  const ledgerCounts = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const item of ledger) {
      if (item.type === 'INCOME') income += 1;
      else expense += 1;
    }
    return { all: ledger.length, income, expense };
  }, [ledger]);

  const filteredLedger = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return ledger.filter((item) => {
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (!q) return true;
      return (
        item.description.toLowerCase().includes(q) ||
        formatCategory(item.category).toLowerCase().includes(q)
      );
    });
  }, [ledger, typeFilter, searchQuery]);

  const displayedLedger = showAllLedger ? filteredLedger : filteredLedger.slice(0, 15);

  const csvHeaders = ['No', 'Tanggal', 'Tipe', 'Kategori', 'Keterangan', 'Jumlah'];
  const csvRows = ledger.map((item, idx) => [
    idx + 1,
    dateFormatterWIB.format(new Date(item.transactionDate)),
    item.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
    formatCategory(item.category),
    item.description,
    formatRupiah(item.amount),
  ]);

  const pdfConfig: PDFExportOptions = {
    title: 'Laporan Kas Sentra Kuliner',
    subtitle: 'Penerimaan sewa dan pengeluaran sentra yang dicatat manual',
    period: new Intl.DateTimeFormat('id-ID', {
      month: 'long',
      year: 'numeric',
      timeZone: 'Asia/Jakarta',
    }).format(new Date()),
    summary: [
      { label: 'Sewa Terkumpul', value: formatRupiah(sewaTerkumpul) },
      { label: 'Tunggakan Sewa', value: formatRupiah(tunggakan) },
      { label: 'Pengeluaran sentra tercatat', value: formatRupiah(biayaOperasional) },
    ],
    headers: ['No', 'Tanggal', 'Kategori', 'Keterangan', 'Jumlah'],
    rows: ledger.map((item, idx) => [
      String(idx + 1),
      new Intl.DateTimeFormat('id-ID', {
        day: 'numeric',
        month: 'short',
        timeZone: 'Asia/Jakarta',
      }).format(new Date(item.transactionDate)),
      formatCategory(item.category),
      item.description,
      formatRupiah(item.amount),
    ]),
    filename: 'laporan-kas-sentra',
  };

  const expenseDialog = (
    <Dialog open={isExpenseOpen} onOpenChange={handleExpenseOpenChange}>
      <DialogTrigger asChild>
        <Button type="button" size="sm">
          <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
          <span>Catat pengeluaran</span>
        </Button>
      </DialogTrigger>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Catat pengeluaran sentra</DialogTitle>
          <DialogDescription>
            Pengeluaran dicatat manual untuk biaya operasional bersama dan tidak menambah tagihan penyewa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSaveExpense} className="space-y-4">
          {dialogError && (
            <Alert variant="danger" role="alert">
              {dialogError}
            </Alert>
          )}

          <Field label="Kategori biaya" required>
            <Select
              aria-label="Kategori biaya"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Nominal" required>
            <RupiahInput
              value={amount}
              onValueChange={setAmount}
              placeholder="0"
            />
          </Field>

          <Field label="Rincian keterangan" required>
            <Input
              type="text"
              required
              maxLength={500}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Contoh: Servis pompa air sentra dan pipa"
            />
          </Field>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => handleExpenseOpenChange(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={loading || amount <= 0 || !description.trim()}
              isLoading={loading}
            >
              Simpan pengeluaran
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Keuangan sentra"
        title="Kas sentra"
        description="Penerimaan sewa dan pengeluaran operasional sentra. Pengeluaran dicatat manual untuk kebutuhan bersama dan tidak menambah tagihan penyewa."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportCSVButton headers={csvHeaders} rows={csvRows} filename="kas-sentra" />
            <ExportPDFButton config={pdfConfig} />
            {expenseDialog}
          </div>
        }
      />

      {successMsg && (
        <Alert
          variant="success"
          role="status"
          aria-live="polite"
          action={
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setSuccessMsg('')}
            >
              Tutup
            </Button>
          }
        >
          {successMsg}
        </Alert>
      )}

      <ResponsiveGrid cols={3} aria-label="Ringkasan kas sentra">
        <StatCard
          label="Sewa telah dibayar"
          value={<AnimatedNumber value={sewaTerkumpul} format={formatRupiah} />}
          hint="Pembayaran sewa terverifikasi"
          tone="success"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Sisa tagihan penyewa"
          value={<AnimatedNumber value={tunggakan} format={formatRupiah} />}
          hint="Belum termasuk tagihan yang belum dibuat"
          tone="warning"
          icon={Clock}
        />
        <StatCard
          label="Pengeluaran sentra"
          value={<AnimatedNumber value={biayaOperasional} format={formatRupiah} />}
          hint="Pengeluaran yang dicatat manual"
          tone="danger"
          icon={ArrowDownRight}
        />
      </ResponsiveGrid>

      {invoiceCount === 0 && activeContractCount > 0 && (
        <Alert
          variant="warning"
          title="Kontrak aktif belum memiliki tagihan"
          action={
            <Link
              href="/sentra/tagihan"
              className="inline-flex min-h-9 items-center justify-center rounded-lg border border-border-subtle bg-surface px-3.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
            >
              Buka tagihan
            </Link>
          }
        >
          Terdapat {activeContractCount} kontrak aktif. Nilai sewa belum masuk ke total tertagih atau tunggakan sampai tagihan periode dibuat.
        </Alert>
      )}

      <Section
        title="Arus kas bulanan sentra"
        description="Pembayaran sewa yang diterapkan dan pengeluaran sentra selama enam bulan terakhir."
      >
        <Card>
          <CardContent className="pt-5">
            {hasMonthlyData ? (
              <>
                <div
                  role="img"
                  aria-label="Grafik garis pembayaran sewa dan pengeluaran sentra bulanan"
                  className="h-64 w-full sm:h-72"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthly} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EAE6DF" />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fontSize: 12, fill: '#57534E' }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tickFormatter={compactAxis}
                        tick={{ fontSize: 12, fill: '#57534E' }}
                        allowDecimals={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: '#FFFFFF',
                          border: '1px solid #EAE6DF',
                          borderRadius: '10px',
                          fontSize: '13px',
                          color: '#181715',
                          boxShadow: '0 4px 12px -2px rgba(24, 23, 21, 0.06)',
                        }}
                        formatter={(value: number) => formatRupiah(value)}
                      />
                      <Legend
                        verticalAlign="top"
                        height={36}
                        wrapperStyle={{ fontSize: 12, color: '#57534E' }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rent"
                        name="Pembayaran sewa diterapkan"
                        stroke="#0F766E"
                        strokeWidth={1.75}
                        dot={{ fill: '#0F766E', r: 3 }}
                        activeDot={{ r: 4.5 }}
                        isAnimationActive={!prefersReduced}
                      />
                      <Line
                        type="monotone"
                        dataKey="expense"
                        name="Pengeluaran sentra tercatat"
                        stroke="#B91C1C"
                        strokeWidth={1.5}
                        strokeDasharray="5 4"
                        dot={{ fill: '#B91C1C', r: 2.5 }}
                        activeDot={{ r: 4.5 }}
                        isAnimationActive={!prefersReduced}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <ul className="sr-only">
                  {monthly.map((item) => (
                    <li key={item.month}>
                      {item.month}: sewa diterapkan {formatRupiah(item.rent)}, pengeluaran sentra{' '}
                      {formatRupiah(item.expense)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <EmptyState
                compact
                icon={TrendingUp}
                title="Belum ada arus kas enam bulan terakhir"
                description="Belum ada pembayaran sewa atau pengeluaran sentra yang tercatat pada periode ini."
                action={
                  <Link
                    href="/sentra/tagihan"
                    className="inline-flex min-h-10 items-center justify-center rounded-lg border border-border-subtle bg-surface px-3.5 text-sm font-medium text-brand-primary transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  >
                    Periksa tagihan sewa
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>
      </Section>

      <Section
        title="Catatan arus kas"
        description="Riwayat pemasukan sewa lapak dan pengeluaran operasional sentra terbaru."
      >
        {ledger.length > 0 && (
          <FilterBar
            actions={
              (typeFilter !== 'ALL' || searchQuery.trim() !== '') && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTypeFilter('ALL');
                    setSearchQuery('');
                  }}
                >
                  Reset filter
                </Button>
              )
            }
          >
            <Field label="Cari keterangan atau kategori" className="min-w-0 sm:min-w-60 lg:flex-1">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Contoh: pompa air atau sewa"
                  className="pl-10"
                />
              </div>
            </Field>

            <div className="min-w-0 sm:col-span-2 lg:w-auto">
              <p className="mb-1.5 text-sm font-medium text-text-primary">Jenis transaksi</p>
              <Tabs
                value={typeFilter}
                onValueChange={(value) => setTypeFilter(value as 'ALL' | 'INCOME' | 'EXPENSE')}
              >
                <TabsList label="Filter jenis transaksi kas sentra">
                  <TabsTrigger value="ALL">Semua ({ledgerCounts.all})</TabsTrigger>
                  <TabsTrigger value="INCOME">Pemasukan ({ledgerCounts.income})</TabsTrigger>
                  <TabsTrigger value="EXPENSE">Pengeluaran ({ledgerCounts.expense})</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </FilterBar>
        )}

        {ledger.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="Belum ada transaksi di buku kas sentra"
            description="Catat pengeluaran operasional atau verifikasi pembayaran sewa dari halaman Tagihan."
          />
        ) : filteredLedger.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="Tidak ada transaksi yang cocok"
            description="Ubah kata kunci pencarian atau pilih jenis transaksi lainnya."
            action={
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setTypeFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Tampilkan semua
              </Button>
            }
          />
        ) : (
          <div className="space-y-4">
            <div className="hidden md:block">
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tanggal</TableHead>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Keterangan</TableHead>
                      <TableHead numeric>Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {displayedLedger.map((item) => {
                      const isIncome = item.type === 'INCOME';
                      return (
                        <TableRow key={item.id}>
                          <TableCell className="whitespace-nowrap text-text-secondary">
                            {dateFormatterWIB.format(new Date(item.transactionDate))}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isIncome ? 'success' : 'danger'}>
                              {isIncome ? (
                                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{isIncome ? 'Pemasukan' : 'Pengeluaran'}</span>
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-text-secondary">
                            {formatCategory(item.category)}
                          </TableCell>
                          <TableCell className="max-w-md font-medium text-text-primary">
                            {item.description}
                          </TableCell>
                          <TableCell
                            numeric
                            className={
                              isIncome
                                ? 'font-semibold text-status-success'
                                : 'font-semibold text-status-danger'
                            }
                          >
                            {isIncome ? '+' : '-'}
                            {formatRupiah(item.amount)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            <div className="space-y-3 md:hidden">
              {displayedLedger.map((item) => {
                const isIncome = item.type === 'INCOME';
                return (
                  <Card key={item.id}>
                    <CardContent className="space-y-2.5 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant={isIncome ? 'success' : 'danger'}>
                          {isIncome ? (
                            <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          ) : (
                            <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          )}
                          <span>{isIncome ? 'Pemasukan' : 'Pengeluaran'}</span>
                        </Badge>
                        <span
                          className={`font-mono text-sm font-bold tabular-nums ${
                            isIncome ? 'text-status-success' : 'text-status-danger'
                          }`}
                        >
                          {isIncome ? '+' : '-'}
                          {formatRupiah(item.amount)}
                        </span>
                      </div>

                      <p className="text-sm font-semibold text-text-primary">
                        {item.description}
                      </p>

                      <p className="text-xs text-text-secondary">
                        {dateFormatterWIB.format(new Date(item.transactionDate))} ·{' '}
                        {formatCategory(item.category)}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {filteredLedger.length > 15 && (
              <div className="flex justify-center">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAllLedger((prev) => !prev)}
                >
                  {showAllLedger
                    ? 'Ringkas menjadi 15 transaksi'
                    : `Tampilkan semua (${filteredLedger.length} transaksi)`}
                </Button>
              </div>
            )}
          </div>
        )}
      </Section>
    </PageTransition>
  );
}
