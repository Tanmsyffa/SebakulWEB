'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowRightLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  MessageSquare,
  Plus,
  Receipt,
  Users,
  Wallet,
} from 'lucide-react';
import { PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Input, NumericInput, RupiahInput } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatRupiah } from '@/lib/utils/currency';
import { formatDateWIB } from '@/lib/utils/date';
import type { SplitBillCalculationResult } from '@/lib/utils/split-bill';
import {
  recordGuyubExpense,
  recordSavingsPayment,
  registerParticipant,
} from '@/server/actions/guyub.actions';

interface ExpenseItem {
  id: string;
  paidByWarungId: string;
  warungName: string;
  description: string;
  amount: number;
  createdAt: Date | string;
}

interface SplitBillClientProps {
  eventId: string;
  eventTitle: string;
  splitResult: SplitBillCalculationResult;
  event: {
    adultFee: number;
    childFee: number;
    perWarungFee: number | null;
    isActive: boolean;
    destination?: string;
    eventDate?: string | null;
    targetBudget?: number;
  };
  participants: {
    warungId: string;
    warungName: string;
    adultCount: number;
    childCount: number;
    totalFee: number;
    paidAmount: number;
  }[];
  expenses?: ExpenseItem[];
  myWarungId: string | null;
  canManage: boolean;
}

export function SplitBillClient({
  eventId,
  eventTitle,
  splitResult,
  event,
  participants,
  expenses = [],
  myWarungId,
  canManage,
}: SplitBillClientProps) {
  const router = useRouter();
  const myParticipation = participants.find(
    (participant) => participant.warungId === myWarungId
  );

  const [adultCount, setAdultCount] = React.useState(myParticipation?.adultCount ?? 1);
  const [childCount, setChildCount] = React.useState(myParticipation?.childCount ?? 0);

  React.useEffect(() => {
    if (myParticipation) {
      setAdultCount(myParticipation.adultCount);
      setChildCount(myParticipation.childCount);
    }
  }, [myParticipation]);

  const expenseKey = React.useRef<string | null>(null);
  const savingsKey = React.useRef<string | null>(null);

  const [savingsWarungId, setSavingsWarungId] = React.useState<string | null>(null);
  const [savingsAmount, setSavingsAmount] = React.useState(0);
  const [savingsError, setSavingsError] = React.useState('');

  const [isExpenseOpen, setIsExpenseOpen] = React.useState(false);
  const [expenseDesc, setExpenseDesc] = React.useState('');
  const [expenseAmount, setExpenseAmount] = React.useState(0);
  const [expenseError, setExpenseError] = React.useState('');

  const [registerError, setRegisterError] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [copiedTransfers, setCopiedTransfers] = React.useState(false);

  const stats = React.useMemo(() => {
    let totalSavingsCollected = 0;
    let totalSavingsTarget = 0;
    let totalAdults = 0;
    let totalChildren = 0;
    for (const p of participants) {
      totalSavingsCollected += p.paidAmount;
      totalSavingsTarget += p.totalFee;
      totalAdults += p.adultCount;
      totalChildren += p.childCount;
    }
    return {
      totalSavingsCollected,
      totalSavingsTarget,
      totalAdults,
      totalChildren,
      totalPeople: totalAdults + totalChildren,
    };
  }, [participants]);

  const activeSavingsParticipant = participants.find(
    (participant) => participant.warungId === savingsWarungId
  );
  const activeSavingsRemaining = activeSavingsParticipant
    ? activeSavingsParticipant.totalFee - activeSavingsParticipant.paidAmount
    : 0;

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setExpenseError('');
    if (!expenseDesc.trim() || expenseAmount <= 0) {
      setExpenseError('Isi keperluan dan nominal talangan yang valid.');
      return;
    }

    setLoading(true);
    try {
      const idempotencyKey = expenseKey.current ?? (expenseKey.current = crypto.randomUUID());
      await recordGuyubExpense({
        idempotencyKey,
        eventId,
        description: expenseDesc.trim(),
        amount: expenseAmount,
      });

      setExpenseDesc('');
      expenseKey.current = null;
      setExpenseAmount(0);
      setIsExpenseOpen(false);
      setFeedback('Dana talangan berhasil dicatat.');
      router.refresh();
    } catch (err) {
      setExpenseError(err instanceof Error ? err.message : 'Gagal mencatat dana talangan.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (submission: React.FormEvent) => {
    submission.preventDefault();
    setRegisterError('');
    if (adultCount + childCount <= 0) {
      setRegisterError('Masukkan minimal 1 peserta (dewasa atau anak).');
      return;
    }
    setLoading(true);
    try {
      await registerParticipant({ eventId, adultCount, childCount });
      setFeedback('Data peserta warung berhasil diperbarui.');
      router.refresh();
    } catch (error) {
      setRegisterError(
        error instanceof Error ? error.message : 'Gagal menyimpan pendaftaran peserta.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSavingsPayment = async (submission: React.FormEvent) => {
    submission.preventDefault();
    setSavingsError('');
    if (!savingsWarungId || savingsAmount <= 0) {
      setSavingsError('Masukkan nominal pembayaran lebih dari Rp0.');
      return;
    }
    if (savingsAmount > activeSavingsRemaining) {
      setSavingsError(
        `Nominal melebihi sisa iuran (${formatRupiah(activeSavingsRemaining)}).`
      );
      return;
    }
    setLoading(true);
    try {
      const idempotencyKey = savingsKey.current ?? (savingsKey.current = crypto.randomUUID());
      await recordSavingsPayment({
        eventId,
        warungId: savingsWarungId,
        amount: savingsAmount,
        idempotencyKey,
      });
      savingsKey.current = null;
      setSavingsWarungId(null);
      setSavingsAmount(0);
      setFeedback('Pembayaran iuran berhasil dicatat.');
      router.refresh();
    } catch (error) {
      setSavingsError(error instanceof Error ? error.message : 'Gagal mencatat iuran.');
    } finally {
      setLoading(false);
    }
  };

  function buildWhatsAppSummaryLines() {
    const lines = [
      `*RINCIAN SPLIT BILL: ${eventTitle.toUpperCase()}*`,
      `Total Talangan: ${formatRupiah(splitResult.totalExpense)}`,
      ``,
      `*Beban dan Neraca Warung:*`,
    ];

    splitResult.shares.forEach((s) => {
      const status =
        s.balance > 0
          ? `(Terima ${formatRupiah(s.balance)})`
          : s.balance < 0
          ? `(Wajib Bayar ${formatRupiah(Math.abs(s.balance))})`
          : `(Lunas Pas)`;
      lines.push(
        `- *${s.warungName}*: Talang ${formatRupiah(s.totalExpensePaid)}, Beban ${formatRupiah(
          s.fairShare
        )} ${status}`
      );
    });

    lines.push(``);
    lines.push(`*Transfer Penyelesaian:*`);
    if (splitResult.transfers.length === 0) {
      lines.push(`Semua dana talangan sudah lunas atau seimbang.`);
    } else {
      splitResult.transfers.forEach((t) => {
        lines.push(
          `*${t.fromWarungName}* transfer ke *${t.toWarungName}*: ${formatRupiah(t.amount)}`
        );
      });
    }

    lines.push(``);
    lines.push(`Dihitung otomatis melalui SEBAKUL Guyub`);
    return lines.join('\n');
  }

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(buildWhatsAppSummaryLines());
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer');
  };

  const handleCopyTransfers = async () => {
    try {
      await navigator.clipboard.writeText(buildWhatsAppSummaryLines());
      setCopiedTransfers(true);
      window.setTimeout(() => setCopiedTransfers(false), 2000);
    } catch {
      // Ignore clipboard failures on restricted contexts
    }
  };

  const eventSubtitle = event.destination
    ? `${eventTitle} (${event.destination})`
    : eventTitle;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        backHref="/guyub"
        backLabel="Kembali ke Guyub"
        eyebrow="Detail acara dan patungan"
        title="Split bill"
        description={eventSubtitle}
        actions={
          <>
            {myParticipation && event.isActive && (
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setExpenseError('');
                  setIsExpenseOpen(true);
                }}
              >
                <Plus aria-hidden="true" className="h-4 w-4" />
                <span>Catat dana talangan</span>
              </Button>
            )}
            <Button type="button" onClick={handleShareWhatsApp}>
              <MessageSquare aria-hidden="true" className="h-4 w-4" />
              <span>Bagikan ke WhatsApp</span>
            </Button>
          </>
        }
      />

      {feedback && (
        <div aria-live="polite">
          <Alert
            variant="success"
            action={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setFeedback('')}
              >
                Tutup
              </Button>
            }
          >
            {feedback}
          </Alert>
        </div>
      )}

      {!event.isActive && (
        <Alert variant="neutral" title="Acara telah selesai atau ditutup">
          Pendaftaran peserta dan pencatatan talangan baru sudah dikunci, sedangkan rincian split
          bill tetap dapat dilihat.
        </Alert>
      )}

      <ResponsiveGrid cols={4}>
        <StatCard
          label="Total talangan"
          value={<AnimatedNumber value={splitResult.totalExpense} format={formatRupiah} />}
          hint={`${expenses.length} catatan pengeluaran`}
          icon={Receipt}
          tone="brand"
        />
        <StatCard
          label="Peserta terdaftar"
          value={<AnimatedNumber value={participants.length} format={(v) => `${v} warung`} />}
          hint={`${stats.totalPeople} orang (${stats.totalAdults} dewasa, ${stats.totalChildren} anak)`}
          icon={Users}
          tone="info"
        />
        <StatCard
          label="Iuran terkumpul"
          value={<AnimatedNumber value={stats.totalSavingsCollected} format={formatRupiah} />}
          hint={`dari tagihan ${formatRupiah(stats.totalSavingsTarget)}`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Transfer penyelesaian"
          value={<AnimatedNumber value={splitResult.transfers.length} />}
          hint={
            splitResult.transfers.length === 0
              ? 'Semua neraca sudah seimbang'
              : 'Transaksi antar warung'
          }
          icon={ArrowRightLeft}
          tone="neutral"
        />
      </ResponsiveGrid>

      {/* Tenant Registration Form */}
      {myWarungId && event.isActive && (
        <Section
          title="Keikutsertaan warung Anda"
          description="Perbarui jumlah orang dari warung Anda agar perhitungan acara tetap akurat."
        >
          <Card>
            <CardContent className="pt-5">
              <form onSubmit={handleRegister} className="space-y-4">
                {registerError && <Alert variant="danger">{registerError}</Alert>}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Jumlah dewasa" htmlFor="guyub-adult-count" required>
                    <NumericInput
                      id="guyub-adult-count"
                      value={adultCount}
                      onValueChange={setAdultCount}
                      suffix="orang"
                    />
                  </Field>
                  <Field label="Jumlah anak" htmlFor="guyub-child-count">
                    <NumericInput
                      id="guyub-child-count"
                      value={childCount}
                      onValueChange={setChildCount}
                      suffix="anak"
                    />
                  </Field>
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {event.perWarungFee !== null
                    ? `Iuran tetap per warung: ${formatRupiah(
                        event.perWarungFee
                      )}. Jumlah orang hanya dipakai untuk perencanaan acara.`
                    : `Tarif per peserta: dewasa ${formatRupiah(
                        event.adultFee
                      )}, anak ${formatRupiah(event.childFee)}. Total estimasi iuran: ${formatRupiah(
                        adultCount * event.adultFee + childCount * event.childFee
                      )}.`}
                </p>
                <div className="flex justify-end">
                  <Button
                    type="submit"
                    disabled={loading || adultCount + childCount <= 0}
                    isLoading={loading}
                    className="w-full sm:w-auto"
                  >
                    {myParticipation ? 'Perbarui peserta' : 'Daftarkan peserta'}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </Section>
      )}

      {/* Split Bill Breakdown & Transfers */}
      <ResponsiveGrid cols={2} gap="lg">
        {/* Card 1: Neraca Patungan per Warung */}
        <Section
          title="Neraca patungan per warung"
          description="Perbandingan dana talangan yang dibayar di muka dan porsi beban tiap warung."
        >
          {splitResult.shares.length === 0 ? (
            <EmptyState
              compact
              icon={Users}
              title="Belum ada peserta"
              description="Belum ada warung yang mendaftar pada acara ini."
            />
          ) : (
            <>
              <div className="hidden md:block">
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Warung</TableHead>
                        <TableHead numeric>Talangan</TableHead>
                        <TableHead numeric>Beban</TableHead>
                        <TableHead numeric>Neraca</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {splitResult.shares.map((s) => (
                        <TableRow key={s.warungId}>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-semibold text-text-primary">{s.warungName}</p>
                              <p className="text-xs text-text-secondary">
                                {s.adultCount} dewasa
                                {s.childCount > 0 ? `, ${s.childCount} anak` : ''}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell numeric>{formatRupiah(s.totalExpensePaid)}</TableCell>
                          <TableCell numeric>{formatRupiah(s.fairShare)}</TableCell>
                          <TableCell numeric>
                            {s.balance > 0 ? (
                              <Badge variant="success">
                                <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>Terima {formatRupiah(s.balance)}</span>
                              </Badge>
                            ) : s.balance < 0 ? (
                              <Badge variant="danger">
                                <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>Bayar {formatRupiah(Math.abs(s.balance))}</span>
                              </Badge>
                            ) : (
                              <Badge variant="neutral">
                                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>Lunas pas</span>
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>

              <Stagger itemCount={splitResult.shares.length} className="space-y-3 md:hidden">
                {splitResult.shares.map((s) => (
                  <StaggerItem key={s.warungId}>
                    <Card>
                      <CardContent className="flex items-center justify-between gap-3 pt-4">
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate font-bold text-text-primary">{s.warungName}</p>
                          <p className="text-xs text-text-secondary">
                            {s.adultCount} dewasa
                            {s.childCount > 0 ? `, ${s.childCount} anak` : ''} · Talang{' '}
                            {formatRupiah(s.totalExpensePaid)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            Beban porsi {formatRupiah(s.fairShare)}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          {s.balance > 0 ? (
                            <Badge variant="success">
                              <ArrowDownLeft aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Terima {formatRupiah(s.balance)}</span>
                            </Badge>
                          ) : s.balance < 0 ? (
                            <Badge variant="danger">
                              <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Bayar {formatRupiah(Math.abs(s.balance))}</span>
                            </Badge>
                          ) : (
                            <Badge variant="neutral">
                              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Lunas pas</span>
                            </Badge>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </StaggerItem>
                ))}
              </Stagger>
            </>
          )}
        </Section>

        {/* Card 2: Transfer yang perlu dilakukan */}
        <Section
          title="Transfer penyelesaian"
          description="Transfer dihitung dari saldo talangan dan porsi biaya tiap warung, terpisah dari tabungan iuran."
          actions={
            splitResult.transfers.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void handleCopyTransfers()}
              >
                {copiedTransfers ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-status-success" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
                <span>{copiedTransfers ? 'Tersalin' : 'Salin ringkasan'}</span>
              </Button>
            ) : undefined
          }
        >
          {splitResult.transfers.length === 0 ? (
            <EmptyState
              compact
              icon={CheckCircle2}
              title="Tidak ada transfer diperlukan"
              description="Semua dana talangan saat ini sudah seimbang."
            />
          ) : (
            <Card>
              <CardContent className="divide-y divide-border-subtle pt-2">
                {splitResult.transfers.map((t, idx) => (
                  <div
                    key={`${t.fromWarungId}-${t.toWarungId}-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-3 py-3.5"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-bold text-text-primary">{t.fromWarungName}</span>
                      <span className="inline-flex items-center gap-1 text-xs text-text-secondary">
                        <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>ke</span>
                      </span>
                      <span className="font-bold text-brand-primary">{t.toWarungName}</span>
                    </div>
                    <span className="font-mono text-base font-bold text-text-primary tabular-nums">
                      {formatRupiah(t.amount)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </Section>
      </ResponsiveGrid>

      {/* Section: Iuran Peserta */}
      {participants.length > 0 && (
        <Section
          title="Status iuran peserta"
          description="Pantauan pembayaran iuran acara per warung."
        >
          <div className="hidden md:block">
            <TableContainer>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Warung</TableHead>
                    <TableHead>Peserta</TableHead>
                    <TableHead numeric>Terbayar</TableHead>
                    <TableHead numeric>Total Iuran</TableHead>
                    <TableHead>Status</TableHead>
                    {canManage && <TableHead className="text-right">Aksi</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.map((participant) => {
                    const remaining = participant.totalFee - participant.paidAmount;
                    return (
                      <TableRow key={participant.warungId}>
                        <TableCell className="font-semibold text-text-primary">
                          {participant.warungName}
                        </TableCell>
                        <TableCell className="text-text-secondary">
                          {participant.adultCount} dewasa
                          {participant.childCount > 0 ? `, ${participant.childCount} anak` : ''}
                        </TableCell>
                        <TableCell numeric>{formatRupiah(participant.paidAmount)}</TableCell>
                        <TableCell numeric>{formatRupiah(participant.totalFee)}</TableCell>
                        <TableCell>
                          {remaining <= 0 ? (
                            <Badge variant="success">
                              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Lunas</span>
                            </Badge>
                          ) : participant.paidAmount > 0 ? (
                            <Badge variant="warning">
                              <span>Sisa {formatRupiah(remaining)}</span>
                            </Badge>
                          ) : (
                            <Badge variant="danger">
                              <span>Belum bayar</span>
                            </Badge>
                          )}
                        </TableCell>
                        {canManage && (
                          <TableCell className="text-right">
                            {remaining > 0 ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => {
                                  savingsKey.current = null;
                                  setSavingsError('');
                                  setSavingsWarungId(participant.warungId);
                                  setSavingsAmount(remaining);
                                }}
                              >
                                Catat bayar
                              </Button>
                            ) : (
                              <span className="text-xs text-text-muted">Selesai</span>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          <Stagger itemCount={participants.length} className="space-y-3 md:hidden">
            {participants.map((participant) => {
              const remaining = participant.totalFee - participant.paidAmount;
              const pct =
                participant.totalFee > 0
                  ? Math.min(100, Math.round((participant.paidAmount / participant.totalFee) * 100))
                  : 100;
              return (
                <StaggerItem key={participant.warungId}>
                  <Card>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-bold text-text-primary">{participant.warungName}</p>
                          <p className="text-xs text-text-secondary">
                            Terbayar {formatRupiah(participant.paidAmount)} dari{' '}
                            {formatRupiah(participant.totalFee)}
                          </p>
                        </div>
                        {remaining <= 0 ? (
                          <Badge variant="success">
                            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                            <span>Lunas</span>
                          </Badge>
                        ) : (
                          <Badge variant={participant.paidAmount > 0 ? 'warning' : 'danger'}>
                            <span>Sisa {formatRupiah(remaining)}</span>
                          </Badge>
                        )}
                      </div>
                      <Progress
                        value={pct}
                        label={`Progres iuran ${participant.warungName}`}
                        tone={remaining <= 0 ? 'success' : 'brand'}
                      />
                      {canManage && remaining > 0 && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="w-full"
                          onClick={() => {
                            savingsKey.current = null;
                            setSavingsError('');
                            setSavingsWarungId(participant.warungId);
                            setSavingsAmount(remaining);
                          }}
                        >
                          Catat bayar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Section>
      )}

      {/* Section: Riwayat Dana Talangan */}
      <Section
        title="Riwayat dana talangan"
        description="Daftar pengeluaran yang sudah dibayar di muka oleh warung peserta."
        actions={
          myParticipation && event.isActive ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setExpenseError('');
                setIsExpenseOpen(true);
              }}
            >
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Tambah talangan</span>
            </Button>
          ) : undefined
        }
      >
        {expenses.length === 0 ? (
          <EmptyState
            compact
            icon={Receipt}
            title="Belum ada dana talangan tercatat"
            description="Jika ada warung peserta yang membayar pengeluaran acara di muka, catat di sini agar masuk ke hitungan split bill."
            action={
              myParticipation && event.isActive ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setExpenseError('');
                    setIsExpenseOpen(true);
                  }}
                >
                  <Plus aria-hidden="true" className="h-4 w-4" />
                  <span>Catat dana talangan</span>
                </Button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu (WIB)</TableHead>
                      <TableHead>Keperluan</TableHead>
                      <TableHead>Ditalangi oleh</TableHead>
                      <TableHead numeric>Nominal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {expenses.map((expense) => (
                      <TableRow key={expense.id}>
                        <TableCell className="whitespace-nowrap font-mono text-xs text-text-secondary">
                          {formatDateWIB(expense.createdAt)}
                        </TableCell>
                        <TableCell className="font-medium text-text-primary">
                          {expense.description}
                        </TableCell>
                        <TableCell className="text-text-secondary">{expense.warungName}</TableCell>
                        <TableCell numeric className="font-semibold">
                          {formatRupiah(expense.amount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            <Stagger itemCount={expenses.length} className="space-y-3 md:hidden">
              {expenses.map((expense) => (
                <StaggerItem key={expense.id}>
                  <Card>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 space-y-0.5">
                          <CardTitle className="text-sm">{expense.description}</CardTitle>
                          <CardDescription className="text-xs">
                            {expense.warungName}
                          </CardDescription>
                        </div>
                        <span className="shrink-0 font-mono text-sm font-bold text-text-primary tabular-nums">
                          {formatRupiah(expense.amount)}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <p className="font-mono text-xs text-text-secondary">
                        {formatDateWIB(expense.createdAt)}
                      </p>
                    </CardContent>
                  </Card>
                </StaggerItem>
              ))}
            </Stagger>
          </>
        )}
      </Section>

      {/* Dialog: Catat Pembayaran Iuran */}
      {canManage && (
        <Dialog
          open={!!savingsWarungId}
          onOpenChange={(open) => {
            if (!open && !loading) {
              setSavingsWarungId(null);
              setSavingsAmount(0);
              setSavingsError('');
              savingsKey.current = null;
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Catat pembayaran iuran</DialogTitle>
              <DialogDescription>
                {activeSavingsParticipant
                  ? `${activeSavingsParticipant.warungName} · Sisa iuran ${formatRupiah(
                      activeSavingsRemaining
                    )}`
                  : ''}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSavingsPayment} className="space-y-4">
              {savingsError && <Alert variant="danger">{savingsError}</Alert>}
              <Field
                label="Nominal pembayaran"
                htmlFor="guyub-savings-amount"
                error={
                  savingsAmount > activeSavingsRemaining
                    ? `Maksimal ${formatRupiah(activeSavingsRemaining)}`
                    : undefined
                }
                required
              >
                <RupiahInput
                  id="guyub-savings-amount"
                  required
                  value={savingsAmount}
                  onValueChange={(value) => {
                    setSavingsAmount(value);
                    savingsKey.current = null;
                  }}
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setSavingsWarungId(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    loading ||
                    savingsAmount <= 0 ||
                    savingsAmount > activeSavingsRemaining
                  }
                  isLoading={loading}
                >
                  Simpan pembayaran
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog: Catat Dana Talangan */}
      {myParticipation && event.isActive && (
        <Dialog
          open={isExpenseOpen}
          onOpenChange={(open) => {
            if (!loading) {
              if (!open) setExpenseError('');
              setIsExpenseOpen(open);
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Catat uang talangan acara</DialogTitle>
              <DialogDescription>
                Pengeluaran ini akan dimasukkan ke dalam pembagian biaya otomatis antar warung
                peserta.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddExpense} className="space-y-4">
              {expenseError && <Alert variant="danger">{expenseError}</Alert>}
              <Field label="Nominal ditalangi" htmlFor="guyub-expense-amount" required>
                <RupiahInput
                  id="guyub-expense-amount"
                  required
                  value={expenseAmount}
                  onValueChange={(value) => {
                    setExpenseAmount(value);
                    expenseKey.current = null;
                  }}
                />
              </Field>
              <Field label="Keperluan atau pengeluaran" htmlFor="guyub-expense-desc" required>
                <Input
                  id="guyub-expense-desc"
                  type="text"
                  required
                  maxLength={255}
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  placeholder="Contoh: Sewa bus pariwisata PP"
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={loading}
                  onClick={() => setIsExpenseOpen(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading || expenseAmount <= 0 || !expenseDesc.trim()}
                  isLoading={loading}
                >
                  Simpan talangan
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </PageTransition>
  );
}
