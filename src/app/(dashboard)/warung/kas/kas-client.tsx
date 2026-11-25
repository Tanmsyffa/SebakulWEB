'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDownRight, ArrowUpRight, Wallet } from 'lucide-react';
import { createWarungTransaction } from '@/server/actions/warung.actions';
import { formatRupiah } from '@/lib/utils/currency';
import { formatDateWIB } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import { PageHeader, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { ExportCSVButton, ExportPDFButton } from '@/components/reports/export-buttons';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { WarungTransaction } from '@/types';

interface KasClientProps {
  initialTransactions: WarungTransaction[];
  warungName: string;
  focusCreate?: boolean;
}

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

export function KasClient({ initialTransactions, warungName, focusCreate = false }: KasClientProps) {
  const router = useRouter();
  const amountInputRef = React.useRef<HTMLInputElement>(null);
  const transactionKey = React.useRef<string | null>(null);

  const [filter, setFilter] = React.useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const [amount, setAmount] = React.useState(0);
  const [txType, setTxType] = React.useState<'INCOME' | 'EXPENSE'>('INCOME');
  const [category, setCategory] = React.useState('OMZET_HARIAN');
  const [notes, setNotes] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [amountError, setAmountError] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [successMsg, setSuccessMsg] = React.useState('');

  React.useEffect(() => {
    if (focusCreate && amountInputRef.current) {
      amountInputRef.current.focus();
      amountInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [focusCreate]);

  React.useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(''), 4000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  const filteredTransactions = initialTransactions.filter((tx) => {
    if (filter === 'INCOME') return tx.type === 'INCOME';
    if (filter === 'EXPENSE') return tx.type === 'EXPENSE';
    return true;
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    setErrorMsg('');
    if (amount <= 0) {
      setAmountError('Masukkan nominal transaksi lebih dari Rp0.');
      amountInputRef.current?.focus();
      return;
    }
    setAmountError('');
    setLoading(true);
    try {
      const idempotencyKey =
        transactionKey.current ?? (transactionKey.current = crypto.randomUUID());
      await createWarungTransaction({
        idempotencyKey,
        type: txType,
        category,
        amount,
        notes: notes.trim() || undefined,
      });

      setAmount(0);
      transactionKey.current = null;
      setNotes('');
      setSuccessMsg('Transaksi berhasil dicatat ke buku kas.');
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan transaksi.');
    } finally {
      setLoading(false);
    }
  };

  const monthLabel = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const csvHeaders = ['No', 'Tanggal', 'Tipe', 'Kategori', 'Catatan', 'Nominal'];
  const csvRows = filteredTransactions.map((tx, idx) => [
    idx + 1,
    formatDateWIB(tx.transactionDate),
    tx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
    formatCategoryLabel(tx.category),
    tx.notes || '-',
    formatRupiah(tx.amount),
  ]);

  const totalIncome = initialTransactions
    .filter((t) => t.type === 'INCOME')
    .reduce((s, t) => s + t.amount, 0);
  const totalExpense = initialTransactions
    .filter((t) => t.type === 'EXPENSE')
    .reduce((s, t) => s + t.amount, 0);
  const netCash = totalIncome - totalExpense;

  const pdfConfig: PDFExportOptions = {
    title: `Buku Kas: ${warungName}`,
    subtitle: 'Laporan Pembukuan Warung SEBAKUL',
    period: monthLabel,
    summary: [
      { label: 'Total Pemasukan', value: formatRupiah(totalIncome) },
      { label: 'Total Belanja', value: formatRupiah(totalExpense) },
      { label: 'Selisih Kas', value: formatRupiah(netCash) },
    ],
    headers: ['No', 'Tanggal', 'Kategori', 'Tipe', 'Jumlah'],
    rows: filteredTransactions.map((tx, idx) => [
      String(idx + 1),
      formatDateWIB(tx.transactionDate),
      formatCategoryLabel(tx.category),
      tx.type === 'INCOME' ? 'Pemasukan' : 'Pengeluaran',
      formatRupiah(tx.amount),
    ]),
    filename: `buku-kas-${warungName.toLowerCase().replace(/\s+/g, '-')}`,
  };

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow={monthLabel}
        title="Buku kas"
        description="Catat pemasukan dan pengeluaran warung secara manual serta ekspor pembukuan ke CSV atau PDF."
        actions={
          <>
            <ExportCSVButton
              headers={csvHeaders}
              rows={csvRows}
              filename={`kas-${warungName.toLowerCase().replace(/\s+/g, '-')}`}
            />
            <ExportPDFButton config={pdfConfig} />
          </>
        }
      />

      <Stagger itemCount={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label="Pemasukan tercatat"
            value={<AnimatedNumber value={totalIncome} format={formatRupiah} />}
            tone="success"
            icon={ArrowUpRight}
            hint={`Dari ${initialTransactions.length} transaksi terakhir`}
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Pengeluaran tercatat"
            value={<AnimatedNumber value={totalExpense} format={formatRupiah} />}
            tone="danger"
            icon={ArrowDownRight}
            hint={`Dari ${initialTransactions.length} transaksi terakhir`}
          />
        </StaggerItem>
        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Selisih kas"
            value={<AnimatedNumber value={netCash} format={formatRupiah} />}
            tone={netCash >= 0 ? 'brand' : 'danger'}
            icon={Wallet}
            hint="Pemasukan dikurangi pengeluaran"
          />
        </StaggerItem>
      </Stagger>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <FadeIn delay={0.05} className="lg:col-span-5 lg:order-2 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle>Catat transaksi cepat</CardTitle>
              <CardDescription>
                Pilih jenis pemasukan atau pengeluaran lalu masukkan nominal transaksi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {successMsg && <Alert variant="success">{successMsg}</Alert>}
              {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

              <form onSubmit={handleSave} className="space-y-4" noValidate>
                <div className="space-y-1.5">
                  <span className="block text-sm font-medium text-text-primary">
                    Jenis transaksi
                  </span>
                  <div
                    role="group"
                    aria-label="Jenis transaksi"
                    className="grid grid-cols-2 gap-1.5 rounded-xl border border-border-subtle bg-surface-muted p-1"
                  >
                    <button
                      type="button"
                      aria-pressed={txType === 'INCOME'}
                      onClick={() => {
                        setTxType('INCOME');
                        setCategory('OMZET_HARIAN');
                        transactionKey.current = null;
                      }}
                      className={cn(
                        'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                        txType === 'INCOME'
                          ? 'border border-border-subtle bg-surface text-status-success shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>Masuk</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={txType === 'EXPENSE'}
                      onClick={() => {
                        setTxType('EXPENSE');
                        setCategory('BELANJA_BAHAN');
                        transactionKey.current = null;
                      }}
                      className={cn(
                        'inline-flex min-h-12 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                        txType === 'EXPENSE'
                          ? 'border border-border-subtle bg-surface text-status-danger shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      <ArrowDownRight aria-hidden="true" className="h-4 w-4 shrink-0" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>

                <Field
                  label="Nominal"
                  htmlFor="tx-amount"
                  error={amountError}
                  required
                >
                  <RupiahInput
                    ref={amountInputRef}
                    id="tx-amount"
                    value={amount}
                    onValueChange={(val) => {
                      setAmount(val);
                      if (val > 0) setAmountError('');
                      transactionKey.current = null;
                    }}
                    placeholder="0"
                  />
                </Field>

                <Field label="Kategori" htmlFor="tx-category" required>
                  <Select
                    id="tx-category"
                    value={category}
                    onChange={(e) => {
                      setCategory(e.target.value);
                      transactionKey.current = null;
                    }}
                  >
                    {txType === 'INCOME' ? (
                      <>
                        <option value="OMZET_HARIAN">Omzet harian</option>
                        <option value="PENDAPATAN_LAIN">Pendapatan lain</option>
                      </>
                    ) : (
                      <>
                        <option value="BELANJA_BAHAN">Belanja bahan</option>
                        <option value="SEWA_LAPAK">Sewa lapak</option>
                        <option value="OPERASIONAL">Operasional warung</option>
                        <option value="LAINNYA">Lainnya</option>
                      </>
                    )}
                  </Select>
                </Field>

                <Field
                  label="Keterangan"
                  htmlFor="tx-notes"
                  hint="Opsional, membantu mengingat detail transaksi."
                >
                  <Input
                    id="tx-notes"
                    type="text"
                    maxLength={500}
                    value={notes}
                    onChange={(e) => {
                      setNotes(e.target.value);
                      transactionKey.current = null;
                    }}
                    placeholder="Contoh: Belanja ayam di pasar pagi"
                  />
                </Field>

                <Button
                  type="submit"
                  disabled={loading}
                  isLoading={loading}
                  className="w-full"
                >
                  Simpan transaksi
                </Button>
              </form>
            </CardContent>
          </Card>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-7 lg:order-1">
          <Section
            title="Riwayat transaksi"
            description="Menampilkan hingga 100 transaksi terbaru sesuai filter."
            actions={
              <Tabs
                value={filter}
                onValueChange={(value) => setFilter(value as 'ALL' | 'INCOME' | 'EXPENSE')}
                className="w-auto"
              >
                <TabsList label="Filter jenis transaksi">
                  <TabsTrigger value="ALL">Semua</TabsTrigger>
                  <TabsTrigger value="INCOME">Masuk</TabsTrigger>
                  <TabsTrigger value="EXPENSE">Keluar</TabsTrigger>
                </TabsList>
              </Tabs>
            }
          >
            {filteredTransactions.length === 0 ? (
              <EmptyState
                compact
                icon={Wallet}
                title="Belum ada transaksi"
                description={
                  filter === 'ALL'
                    ? 'Catat pemasukan atau belanja pertama Anda melalui formulir di samping.'
                    : 'Tidak ada transaksi untuk kategori yang dipilih.'
                }
              />
            ) : (
              <>
                <div className="hidden md:block">
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Keterangan</TableHead>
                          <TableHead>Jenis</TableHead>
                          <TableHead numeric>Nominal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredTransactions.map((tx) => (
                          <TableRow key={tx.id}>
                            <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                              {formatDateWIB(tx.transactionDate)}
                            </TableCell>
                            <TableCell>
                              <p className="font-semibold text-text-primary">
                                {tx.notes || formatCategoryLabel(tx.category)}
                              </p>
                              {tx.notes && (
                                <p className="text-xs text-text-secondary">
                                  {formatCategoryLabel(tx.category)}
                                </p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={tx.type === 'INCOME' ? 'success' : 'danger'}>
                                {tx.type === 'INCOME' ? (
                                  <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                ) : (
                                  <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                                )}
                                <span>{tx.type === 'INCOME' ? 'Masuk' : 'Keluar'}</span>
                              </Badge>
                            </TableCell>
                            <TableCell
                              numeric
                              className={cn(
                                'font-bold',
                                tx.type === 'INCOME' ? 'text-status-success' : 'text-status-danger'
                              )}
                            >
                              {tx.type === 'INCOME' ? '+' : '-'}
                              {formatRupiah(tx.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </div>

                <Card className="md:hidden">
                  <CardContent className="p-4 divide-y divide-border-subtle">
                    {filteredTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="truncate text-sm font-semibold text-text-primary">
                            {tx.notes || formatCategoryLabel(tx.category)}
                          </p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={tx.type === 'INCOME' ? 'success' : 'danger'}>
                              {tx.type === 'INCOME' ? (
                                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{tx.type === 'INCOME' ? 'Masuk' : 'Keluar'}</span>
                            </Badge>
                            <span className="text-xs text-text-secondary">
                              {formatDateWIB(tx.transactionDate)}
                            </span>
                          </div>
                        </div>
                        <span
                          className={cn(
                            'shrink-0 font-mono text-sm font-bold tabular-nums',
                            tx.type === 'INCOME' ? 'text-status-success' : 'text-status-danger'
                          )}
                        >
                          {tx.type === 'INCOME' ? '+' : '-'}
                          {formatRupiah(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </>
            )}
          </Section>
        </FadeIn>
      </div>
    </PageTransition>
  );
}
