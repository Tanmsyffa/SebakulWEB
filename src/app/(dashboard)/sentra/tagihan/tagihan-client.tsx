'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarCheck,
  CalendarClock,
  Eye,
  FileText,
  Info,
  MessageSquare,
  Plus,
  Receipt,
  Search,
} from 'lucide-react';
import { FilterBar, PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, InvoiceStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Textarea } from '@/components/ui/textarea';
import { formatActionError } from '@/lib/utils';
import { formatRupiah } from '@/lib/utils/currency';
import { generateInvoiceNoticeWAUrl } from '@/lib/utils/whatsapp';
import {
  createInvoiceBatch,
  recordPayment,
  rejectPaymentProof,
  reviewLapakRenewalRequest,
} from '@/server/actions/lapak.actions';
import type { InvoiceStatus } from '@/types';

interface TagihanItem {
  id: string;
  invoiceNumber: string;
  lapakCode: string;
  warungName: string;
  tenantPhone: string | null;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  status: InvoiceStatus;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  payments: { amount: number; paymentMethod: string; paidAt: Date; notes: string | null }[];
}

interface PaymentProofItem {
  id: string;
  invoiceId: string;
  uploadedAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  status: string;
  invoiceNumber: string;
  warungName: string;
}

interface RenewalRequestItem {
  id: string;
  lapakCode: string;
  warungName: string;
  requestedContractEnd: string;
  currentContractEnd: string | null;
  message: string | null;
  status: string;
  reviewerNote: string | null;
  createdAt: Date;
}

interface TagihanClientProps {
  invoices: TagihanItem[];
  terkumpul: number;
  tunggakan: number;
  proofs: PaymentProofItem[];
  renewalRequests: RenewalRequestItem[];
  billableLapaks: { id: string; code: string; warungName: string; status: string }[];
  today: string;
}

const MONTH_OPTIONS = [
  ['01', 'Januari'],
  ['02', 'Februari'],
  ['03', 'Maret'],
  ['04', 'April'],
  ['05', 'Mei'],
  ['06', 'Juni'],
  ['07', 'Juli'],
  ['08', 'Agustus'],
  ['09', 'September'],
  ['10', 'Oktober'],
  ['11', 'November'],
  ['12', 'Desember'],
] as const;

const paymentMethodLabels: Record<string, string> = {
  TUNAI: 'Tunai',
  TRANSFER_QRIS: 'Transfer / QRIS',
};

function formatDateLongWIB(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'long',
  });
}

function formatMonthYearWIB(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00+07:00`).toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    month: 'long',
    year: 'numeric',
  });
}

function formatDateTimeWIB(value: Date | string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function formatPeriodShort(ym: string): string {
  const [year, month] = ym.slice(0, 7).split('-').map(Number);
  if (!year || !month) return ym;
  return new Intl.DateTimeFormat('id-ID', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
}

export function TagihanClient({
  invoices,
  terkumpul,
  tunggakan,
  proofs,
  renewalRequests,
  billableLapaks,
  today,
}: TagihanClientProps) {
  const router = useRouter();

  const [generating, setGenerating] = React.useState(false);
  const [isBatchOpen, setIsBatchOpen] = React.useState(false);
  const [billMode, setBillMode] = React.useState<'BATCH' | 'SINGLE'>('BATCH');
  const [targetLapakId, setTargetLapakId] = React.useState('');
  const [periodMonth, setPeriodMonth] = React.useState(today.slice(0, 7));
  const [dueDay, setDueDay] = React.useState('10');
  const [batchError, setBatchError] = React.useState('');

  const [selectedInvoice, setSelectedInvoice] = React.useState<TagihanItem | null>(null);
  const [detailInvoiceId, setDetailInvoiceId] = React.useState<string | null>(null);
  const [selectedProofId, setSelectedProofId] = React.useState<string | null>(null);
  const [rejectingProofId, setRejectingProofId] = React.useState<string | null>(null);
  const [proofReviewNote, setProofReviewNote] = React.useState('');
  const [rejectError, setRejectError] = React.useState('');

  const [payAmount, setPayAmount] = React.useState(0);
  const [payMethod, setPayMethod] = React.useState('TUNAI');
  const [payNotes, setPayNotes] = React.useState('');
  const [payError, setPayError] = React.useState('');
  const [paying, setPaying] = React.useState(false);
  const paymentKey = React.useRef<string | null>(null);

  const [feedback, setFeedback] = React.useState<{
    variant: 'success' | 'warning' | 'danger';
    text: string;
  } | null>(null);

  const [reviewNote, setReviewNote] = React.useState<Record<string, string>>({});
  const [reviewingId, setReviewingId] = React.useState<string | null>(null);
  const [confirmRejectRenewal, setConfirmRejectRenewal] =
    React.useState<RenewalRequestItem | null>(null);

  const [searchQuery, setSearchQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<
    'ALL' | 'OPEN' | 'OVERDUE' | 'PAID' | 'WAIVED'
  >('ALL');

  const currentYear = Number(periodMonth.slice(0, 4));
  const daysInPeriod = new Date(currentYear, Number(periodMonth.slice(5, 7)), 0).getDate();

  const changePeriod = (value: string) => {
    setPeriodMonth(value);
    const [year, month] = value.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    setDueDay((current) => String(Math.min(Number(current), lastDay)));
  };

  const invoiceById = React.useMemo(
    () => new Map(invoices.map((inv) => [inv.id, inv])),
    [invoices]
  );

  const proofsByInvoice = React.useMemo(() => {
    const map = new Map<string, PaymentProofItem[]>();
    for (const proof of proofs) {
      map.set(proof.invoiceId, [...(map.get(proof.invoiceId) ?? []), proof]);
    }
    return map;
  }, [proofs]);

  const pendingProofs = React.useMemo(
    () => proofs.filter((proof) => proof.status === 'PENDING'),
    [proofs]
  );

  const pendingRenewals = React.useMemo(
    () => renewalRequests.filter((request) => request.status === 'PENDING'),
    [renewalRequests]
  );

  const detailInvoice = detailInvoiceId ? invoiceById.get(detailInvoiceId) ?? null : null;

  const isOverdue = React.useCallback(
    (inv: TagihanItem) => inv.remainingAmount > 0 && inv.dueDate < today,
    [today]
  );

  const statusCounts = React.useMemo(() => {
    let open = 0;
    let overdue = 0;
    let paid = 0;
    let waived = 0;
    for (const inv of invoices) {
      if (inv.status === 'PAID') paid += 1;
      else if (inv.status === 'WAIVED') waived += 1;
      else open += 1;
      if (isOverdue(inv)) overdue += 1;
    }
    return { all: invoices.length, open, overdue, paid, waived };
  }, [invoices, isOverdue]);

  const filteredInvoices = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return invoices.filter((inv) => {
      if (statusFilter === 'OPEN' && inv.status !== 'UNPAID' && inv.status !== 'PARTIAL') {
        return false;
      }
      if (statusFilter === 'OVERDUE' && !isOverdue(inv)) {
        return false;
      }
      if (statusFilter === 'PAID' && inv.status !== 'PAID') {
        return false;
      }
      if (statusFilter === 'WAIVED' && inv.status !== 'WAIVED') {
        return false;
      }
      if (!q) return true;
      return (
        inv.lapakCode.toLowerCase().includes(q) ||
        inv.warungName.toLowerCase().includes(q) ||
        inv.invoiceNumber.toLowerCase().includes(q)
      );
    });
  }, [invoices, statusFilter, searchQuery, isOverdue]);

  const openBatchDialog = (mode: 'BATCH' | 'SINGLE') => {
    setBillMode(mode);
    setTargetLapakId(mode === 'SINGLE' ? billableLapaks[0]?.id ?? '' : '');
    setBatchError('');
    setIsBatchOpen(true);
  };

  const handleRenewalReview = async (
    requestId: string,
    decision: 'APPROVED' | 'REJECTED'
  ) => {
    setReviewingId(requestId);
    try {
      await reviewLapakRenewalRequest({
        requestId,
        decision,
        note: reviewNote[requestId] ?? '',
      });
      setConfirmRejectRenewal(null);
      setFeedback({
        variant: 'success',
        text:
          decision === 'APPROVED'
            ? 'Perpanjangan disetujui dan tanggal kontrak lapak telah diperbarui.'
            : 'Permintaan perpanjangan sewa ditolak dan penyewa sudah diberi tahu.',
      });
      router.refresh();
    } catch (error) {
      setFeedback({
        variant: 'danger',
        text: formatActionError(error, 'Gagal memproses perpanjangan sewa.'),
      });
    } finally {
      setReviewingId(null);
    }
  };

  const handleOpenPayment = (inv: TagihanItem, proofId?: string) => {
    paymentKey.current = crypto.randomUUID();
    setSelectedInvoice(inv);
    setSelectedProofId(proofId ?? null);
    setPayMethod(proofId ? 'TRANSFER_QRIS' : 'TUNAI');
    setPayAmount(inv.remainingAmount);
    setPayNotes('');
    setPayError('');
  };

  const handleClosePayment = (open: boolean) => {
    if (!open && !paying) {
      setSelectedInvoice(null);
      setSelectedProofId(null);
      setPayError('');
      paymentKey.current = null;
    }
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;
    if (payAmount <= 0) {
      setPayError('Masukkan nominal pembayaran lebih dari Rp0.');
      return;
    }

    setPaying(true);
    setPayError('');
    try {
      const idempotencyKey =
        paymentKey.current ?? (paymentKey.current = crypto.randomUUID());
      await recordPayment({
        idempotencyKey,
        invoiceId: selectedInvoice.id,
        amount: payAmount,
        paymentMethod: selectedProofId ? 'TRANSFER_QRIS' : payMethod,
        proofId: selectedProofId ?? undefined,
        notes: payNotes.trim() ? payNotes.trim() : undefined,
      });

      const lapakCode = selectedInvoice.lapakCode;
      setSelectedInvoice(null);
      setSelectedProofId(null);
      paymentKey.current = null;
      setFeedback({
        variant: 'success',
        text: `Pembayaran untuk Lapak ${lapakCode} berhasil dicatat.`,
      });
      router.refresh();
    } catch (err) {
      setPayError(formatActionError(err, 'Gagal mencatat pembayaran.'));
    } finally {
      setPaying(false);
    }
  };

  const handleRejectProof = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!rejectingProofId) return;
    if (proofReviewNote.trim().length < 5) {
      setRejectError('Alasan penolakan minimal 5 karakter.');
      return;
    }
    setPaying(true);
    setRejectError('');
    try {
      await rejectPaymentProof(rejectingProofId, proofReviewNote);
      setFeedback({
        variant: 'success',
        text: 'Bukti pembayaran ditolak dan penyewa sudah diberi tahu.',
      });
      setRejectingProofId(null);
      setProofReviewNote('');
      router.refresh();
    } catch (error) {
      setRejectError(formatActionError(error, 'Gagal menolak bukti bayar.'));
    } finally {
      setPaying(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (billMode === 'SINGLE' && !targetLapakId) {
      setBatchError('Pilih lapak yang akan dibuatkan tagihan.');
      return;
    }
    setGenerating(true);
    setBatchError('');
    try {
      const start = `${periodMonth}-01`;
      const [year, month] = periodMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const end = `${periodMonth}-${String(lastDay).padStart(2, '0')}`;
      const dueDate = `${periodMonth}-${dueDay.padStart(2, '0')}`;

      const res = await createInvoiceBatch(
        start,
        end,
        dueDate,
        billMode === 'SINGLE' ? targetLapakId : undefined
      );
      if (res.success) {
        setFeedback({
          variant: 'success',
          text: res.count
            ? `Berhasil membuat ${res.count} tagihan.${
                res.skipped ? ` ${res.skipped} tagihan dilewati karena sudah ada.` : ''
              }`
            : `Tidak ada tagihan baru. ${res.skipped ?? 0} tagihan untuk periode tersebut sudah tersedia.`,
        });
        setIsBatchOpen(false);
        router.refresh();
      } else {
        setBatchError(res.message ?? 'Gagal membuat tagihan.');
      }
    } catch (err) {
      setBatchError(formatActionError(err, 'Gagal membuat tagihan periode ini.'));
    } finally {
      setGenerating(false);
    }
  };

  const handleSendWA = (inv: TagihanItem) => {
    if (!inv.tenantPhone?.trim()) {
      setFeedback({
        variant: 'warning',
        text: `Kontak WhatsApp untuk ${inv.warungName} belum diisi. Minta penyewa memperbarui nomor kontaknya di menu Profil.`,
      });
      return;
    }
    const waUrl = generateInvoiceNoticeWAUrl(inv.tenantPhone, {
      invoiceNumber: inv.invoiceNumber,
      warungName: inv.warungName,
      lapakCode: inv.lapakCode,
      periodStart: inv.periodStart,
      dueDate: inv.dueDate,
      totalAmount: inv.totalAmount,
      paidAmount: inv.paidAmount,
      remainingAmount: inv.remainingAmount,
    });
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const renderInvoiceProofs = (inv: TagihanItem, itemProofs: PaymentProofItem[]) =>
    itemProofs.map((proof) => (
      <div
        key={proof.id}
        className={`space-y-2.5 rounded-xl border p-3.5 text-sm ${
          proof.status === 'PENDING'
            ? 'border-status-warning-border bg-status-warning-bg'
            : proof.status === 'VERIFIED'
            ? 'border-brand-border bg-brand-soft'
            : 'border-border-subtle bg-surface-muted'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-text-primary">
            {proof.status === 'PENDING'
              ? 'Bukti transfer menunggu verifikasi'
              : proof.status === 'VERIFIED'
              ? 'Bukti transfer terverifikasi'
              : 'Bukti transfer ditolak'}
          </p>
          <span className="text-xs text-text-secondary">
            Dikirim {formatDateTimeWIB(proof.uploadedAt)}
          </span>
        </div>

        {proof.reviewNote && (
          <p className="text-xs text-text-secondary">
            Catatan: <span className="font-medium text-text-primary">{proof.reviewNote}</span>
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-0.5">
          <a
            href={`/api/payment-proofs/${proof.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
            <span>Lihat bukti bayar</span>
          </a>

          {proof.status === 'PENDING' && (
            <>
              <Button
                type="button"
                size="sm"
                onClick={() => handleOpenPayment(inv, proof.id)}
              >
                Verifikasi &amp; catat
              </Button>
              <Button
                type="button"
                size="sm"
                variant="danger"
                onClick={() => {
                  setRejectingProofId(proof.id);
                  setProofReviewNote('');
                  setRejectError('');
                }}
              >
                Tolak
              </Button>
            </>
          )}
        </div>
      </div>
    ));

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Penagihan sentra"
        title="Tagihan sewa"
        description={`Periode berjalan ${formatMonthYearWIB(today)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              type="button"
              size="sm"
              onClick={() => openBatchDialog('BATCH')}
              disabled={!billableLapaks.length}
            >
              <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
              <span>Buat tagihan serentak</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => openBatchDialog('SINGLE')}
              disabled={!billableLapaks.length}
            >
              <span>Buat satu lapak</span>
            </Button>
          </div>
        }
      />

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

      {billableLapaks.length === 0 && (
        <Alert variant="info" title="Belum ada lapak aktif yang dapat ditagih">
          Penagihan serentak atau per lapak tersedia setelah ada lapak berstatus TERISI atau LIBUR dengan warung terhubung.
        </Alert>
      )}

      <ResponsiveGrid cols={4} aria-label="Ringkasan tagihan sewa">
        <StatCard
          label="Terkumpul"
          value={<AnimatedNumber value={terkumpul} format={formatRupiah} />}
          hint="Total sewa terbayar"
          tone="success"
          icon={ArrowUpRight}
        />
        <StatCard
          label="Tunggakan"
          value={<AnimatedNumber value={tunggakan} format={formatRupiah} />}
          hint="Total sisa tagihan aktif"
          tone="danger"
          icon={ArrowDownRight}
        />
        <StatCard
          label="Bukti menunggu"
          value={<AnimatedNumber value={pendingProofs.length} />}
          hint="Perlu verifikasi pengelola"
          tone={pendingProofs.length > 0 ? 'warning' : 'neutral'}
          icon={Receipt}
        />
        <StatCard
          label="Perpanjangan sewa"
          value={<AnimatedNumber value={pendingRenewals.length} />}
          hint="Permintaan kontrak menunggu"
          tone={pendingRenewals.length > 0 ? 'info' : 'neutral'}
          icon={CalendarClock}
        />
      </ResponsiveGrid>

      {pendingProofs.length > 0 && (
        <Section
          title="Bukti transfer menunggu verifikasi"
          description="Periksa gambar bukti yang diunggah penyewa sebelum mencatat pembayaran ke kas sentra."
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {pendingProofs.map((proof) => {
              const linkedInv = invoiceById.get(proof.invoiceId);
              return (
                <Card key={proof.id} className="border-status-warning-border">
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-text-primary">
                          {linkedInv ? `Lapak ${linkedInv.lapakCode} · ` : ''}
                          {proof.warungName}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-text-secondary">
                          {proof.invoiceNumber}
                          {linkedInv ? ` · Sisa ${formatRupiah(linkedInv.remainingAmount)}` : ''}
                        </p>
                      </div>
                      <Badge variant="warning">
                        <Receipt aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                        <span>Menunggu</span>
                      </Badge>
                    </div>

                    <p className="text-xs text-text-secondary">
                      Diunggah {formatDateTimeWIB(proof.uploadedAt)}
                    </p>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href={`/api/payment-proofs/${proof.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border-subtle bg-surface px-3 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                      >
                        <Eye aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-text-secondary" />
                        <span>Lihat bukti bayar</span>
                      </a>

                      {linkedInv &&
                        linkedInv.status !== 'PAID' &&
                        linkedInv.status !== 'WAIVED' && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => handleOpenPayment(linkedInv, proof.id)}
                          >
                            Verifikasi &amp; catat
                          </Button>
                        )}

                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        onClick={() => {
                          setRejectingProofId(proof.id);
                          setProofReviewNote('');
                          setRejectError('');
                        }}
                      >
                        Tolak
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </Section>
      )}

      <Section
        title="Permintaan perpanjangan sewa"
        description="Persetujuan akan memperbarui tanggal akhir kontrak lapak secara langsung."
      >
        {pendingRenewals.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarCheck}
            title="Tidak ada permintaan perpanjangan menunggu"
            description="Pengajuan perpanjangan kontrak dari penyewa lapak akan tampil di sini."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {pendingRenewals.map((request) => (
              <Card key={request.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">
                        {request.warungName} · Lapak {request.lapakCode}
                      </CardTitle>
                      <p className="mt-1 text-sm text-text-secondary">
                        Akhir kontrak:{' '}
                        <span className="font-medium text-text-primary">
                          {request.currentContractEnd
                            ? formatDateLongWIB(request.currentContractEnd)
                            : 'Belum ditentukan'}
                        </span>{' '}
                        menjadi{' '}
                        <strong className="text-brand-primary">
                          {formatDateLongWIB(request.requestedContractEnd)}
                        </strong>
                      </p>
                    </div>
                    <Badge variant="info">
                      <CalendarClock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                      <span>MENUNGGU</span>
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {request.message && (
                    <p className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm text-text-primary">
                      {request.message}
                    </p>
                  )}

                  <Field label="Catatan untuk penyewa (opsional)">
                    <Textarea
                      maxLength={500}
                      rows={2}
                      value={reviewNote[request.id] ?? ''}
                      onChange={(event) =>
                        setReviewNote((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      placeholder="Tambahkan catatan persetujuan atau alasan penolakan"
                    />
                  </Field>

                  <div className="grid grid-cols-2 gap-2.5 pt-1">
                    <Button
                      type="button"
                      disabled={reviewingId === request.id}
                      isLoading={reviewingId === request.id}
                      onClick={() => void handleRenewalReview(request.id, 'APPROVED')}
                    >
                      Setujui
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={reviewingId === request.id}
                      onClick={() => setConfirmRejectRenewal(request)}
                    >
                      Tolak
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Daftar tagihan"
        description="Catat pembayaran tunai maupun transfer, verifikasi cicilan, dan kirim informasi tagihan melalui WhatsApp."
      >
        {invoices.length > 0 && (
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
            <Field
              label="Cari lapak, warung, atau nomor tagihan"
              className="min-w-0 sm:min-w-60 lg:flex-1"
            >
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                />
                <Input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Contoh: A-01, Bu Sari, atau INV-202611"
                  className="pl-10"
                />
              </div>
            </Field>

            <div className="min-w-0 sm:col-span-2 lg:w-auto">
              <p className="mb-1.5 text-sm font-medium text-text-primary">Status tagihan</p>
              <Tabs
                value={statusFilter}
                onValueChange={(value) =>
                  setStatusFilter(value as typeof statusFilter)
                }
              >
                <TabsList label="Filter status tagihan">
                  <TabsTrigger value="ALL">Semua ({statusCounts.all})</TabsTrigger>
                  <TabsTrigger value="OPEN">Belum lunas ({statusCounts.open})</TabsTrigger>
                  <TabsTrigger value="OVERDUE">
                    Terlambat ({statusCounts.overdue})
                  </TabsTrigger>
                  <TabsTrigger value="PAID">Lunas ({statusCounts.paid})</TabsTrigger>
                  <TabsTrigger value="WAIVED">
                    Dibebaskan ({statusCounts.waived})
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </FilterBar>
        )}

        {invoices.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada tagihan sewa"
            description="Buat tagihan periode ini secara serentak untuk seluruh lapak aktif atau pilih satu lapak tertentu."
            action={
              billableLapaks.length > 0 && (
                <Button type="button" onClick={() => openBatchDialog('BATCH')}>
                  <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                  <span>Buat tagihan serentak</span>
                </Button>
              )
            }
          />
        ) : filteredInvoices.length === 0 ? (
          <EmptyState
            compact
            icon={Search}
            title="Tidak ada tagihan yang cocok"
            description="Ubah kata kunci pencarian atau pilih tab status lainnya."
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
                Tampilkan semua tagihan
              </Button>
            }
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden lg:block">
              <TableContainer>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lapak &amp; Warung</TableHead>
                      <TableHead>Tagihan</TableHead>
                      <TableHead>Jatuh Tempo</TableHead>
                      <TableHead numeric>Total</TableHead>
                      <TableHead numeric>Sisa</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInvoices.map((inv) => {
                      const overdue = isOverdue(inv);
                      const invProofs = proofsByInvoice.get(inv.id) ?? [];
                      const hasPendingProof = invProofs.some(
                        (p) => p.status === 'PENDING'
                      );

                      return (
                        <TableRow key={inv.id}>
                          <TableCell>
                            <div className="font-bold text-text-primary">
                              Lapak {inv.lapakCode}
                            </div>
                            <div className="text-xs text-text-secondary">
                              {inv.warungName}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="font-mono text-xs font-semibold text-text-primary">
                              {inv.invoiceNumber}
                            </div>
                            <div className="text-xs text-text-secondary">
                              Periode {formatPeriodShort(inv.periodStart)}
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-text-secondary">
                            {formatDateLongWIB(inv.dueDate)}
                          </TableCell>
                          <TableCell numeric>
                            <div className="font-semibold text-text-primary">
                              {formatRupiah(inv.totalAmount)}
                            </div>
                            {inv.paidAmount > 0 && (
                              <div className="text-xs text-text-secondary">
                                Masuk {formatRupiah(inv.paidAmount)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell
                            numeric
                            className={
                              inv.remainingAmount > 0
                                ? 'font-bold text-status-danger'
                                : 'font-semibold text-status-success'
                            }
                          >
                            {formatRupiah(inv.remainingAmount)}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <InvoiceStatusBadge status={inv.status} />
                              {overdue && (
                                <Badge variant="danger">
                                  <AlertTriangle
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                  <span>TERLAMBAT</span>
                                </Badge>
                              )}
                              {hasPendingProof && (
                                <Badge variant="warning">
                                  <Receipt
                                    aria-hidden="true"
                                    className="h-3.5 w-3.5 shrink-0"
                                  />
                                  <span>BUKTI BARU</span>
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleOpenPayment(inv)}
                                disabled={
                                  inv.status === 'PAID' || inv.status === 'WAIVED'
                                }
                              >
                                Catat bayar
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => handleSendWA(inv)}
                                aria-label={`${
                                  inv.remainingAmount > 0
                                    ? 'Kirim pengingat WhatsApp'
                                    : 'Kirim konfirmasi WhatsApp'
                                } untuk Lapak ${inv.lapakCode}`}
                              >
                                <MessageSquare
                                  aria-hidden="true"
                                  className="h-4 w-4 shrink-0 text-status-success"
                                />
                                <span>
                                  {inv.remainingAmount > 0
                                    ? 'Pengingat WA'
                                    : 'Konfirmasi WA'}
                                </span>
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                onClick={() => setDetailInvoiceId(inv.id)}
                              >
                                Detail
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </div>

            {/* Mobile & Tablet cards */}
            <Stagger itemCount={filteredInvoices.length} className="space-y-3 lg:hidden">
              {filteredInvoices.map((inv) => {
                const overdue = isOverdue(inv);
                const invProofs = proofsByInvoice.get(inv.id) ?? [];

                return (
                  <StaggerItem key={inv.id}>
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <CardTitle className="text-base">
                              Lapak {inv.lapakCode}
                            </CardTitle>
                            <p className="mt-0.5 text-sm font-medium text-text-secondary">
                              {inv.warungName} · {formatPeriodShort(inv.periodStart)}
                            </p>
                            <p className="mt-0.5 font-mono text-xs text-text-muted">
                              {inv.invoiceNumber}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <InvoiceStatusBadge status={inv.status} />
                            {overdue && (
                              <Badge variant="danger">
                                <AlertTriangle
                                  aria-hidden="true"
                                  className="h-3.5 w-3.5 shrink-0"
                                />
                                <span>TERLAMBAT</span>
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-3">
                        <div className="grid grid-cols-2 gap-3 rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
                          <div>
                            <span className="block text-xs text-text-secondary">
                              Total tagihan
                            </span>
                            <span className="font-mono font-semibold text-text-primary tabular-nums">
                              {formatRupiah(inv.totalAmount)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs text-text-secondary">
                              Sisa tagihan
                            </span>
                            <span className="font-mono font-bold text-text-primary tabular-nums">
                              {formatRupiah(inv.remainingAmount)}
                            </span>
                          </div>
                          {inv.paidAmount > 0 && (
                            <div className="col-span-2 border-t border-border-subtle pt-2 text-xs text-text-secondary">
                              Sudah dibayar:{' '}
                              <span className="font-mono font-semibold text-status-success tabular-nums">
                                {formatRupiah(inv.paidAmount)}
                              </span>
                            </div>
                          )}
                        </div>

                        <p className="text-xs text-text-secondary">
                          Jatuh tempo: {formatDateLongWIB(inv.dueDate)}
                        </p>

                        {inv.payments.length > 0 && (
                          <div className="space-y-2 border-t border-border-subtle pt-3">
                            <h3 className="text-xs font-medium text-text-muted">
                              Riwayat pembayaran
                            </h3>
                            <div className="space-y-2">
                              {inv.payments.map((payment, index) => (
                                <div
                                  key={`${inv.id}-${index}`}
                                  className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-xs"
                                >
                                  <span className="text-text-secondary">
                                    {formatDateTimeWIB(payment.paidAt)} ·{' '}
                                    {paymentMethodLabels[payment.paymentMethod] ??
                                      payment.paymentMethod}
                                  </span>
                                  <span className="font-mono font-semibold text-text-primary tabular-nums">
                                    {formatRupiah(payment.amount)}
                                  </span>
                                  {payment.notes && (
                                    <span className="w-full break-words text-text-secondary">
                                      {payment.notes}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {invProofs.length > 0 && (
                          <div className="space-y-2.5 pt-1">
                            {renderInvoiceProofs(inv, invProofs)}
                          </div>
                        )}
                      </CardContent>

                      <CardFooter className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleOpenPayment(inv)}
                          disabled={inv.status === 'PAID' || inv.status === 'WAIVED'}
                          className="w-full"
                        >
                          Catat bayar
                        </Button>

                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => handleSendWA(inv)}
                          className="w-full"
                        >
                          <MessageSquare
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-status-success"
                          />
                          <span>
                            {inv.remainingAmount > 0
                              ? 'Pengingat WA'
                              : 'Konfirmasi WA'}
                          </span>
                        </Button>
                      </CardFooter>
                    </Card>
                  </StaggerItem>
                );
              })}
            </Stagger>
          </>
        )}
      </Section>

      {/* Dialog: Buat Tagihan Batch / Tunggal */}
      <Dialog
        open={isBatchOpen}
        onOpenChange={(open) => {
          if (!open && !generating) {
            setIsBatchOpen(false);
            setBatchError('');
          }
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              {billMode === 'SINGLE'
                ? 'Buat tagihan satu lapak'
                : 'Buat tagihan serentak'}
            </DialogTitle>
            <DialogDescription>
              {billMode === 'SINGLE'
                ? 'Pilih lapak dan periode yang akan dibuatkan tagihan. Sistem mencegah duplikasi tagihan pada periode yang sama.'
                : 'Tagihan dibuat untuk seluruh lapak aktif. Lapak berstatus LIBUR dibebaskan dari sewa pokok, dan tagihan yang sudah ada akan dilewati.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {batchError && (
              <Alert variant="danger" role="alert">
                {batchError}
              </Alert>
            )}

            {billMode === 'SINGLE' && (
              <Field label="Lapak" required>
                <Select
                  aria-label="Pilih lapak"
                  value={targetLapakId}
                  onChange={(event) => setTargetLapakId(event.target.value)}
                >
                  {billableLapaks.map((lapak) => (
                    <option key={lapak.id} value={lapak.id}>
                      Lapak {lapak.code} · {lapak.warungName}
                    </option>
                  ))}
                </Select>
              </Field>
            )}

            <div className="grid grid-cols-[minmax(0,1fr)_6.75rem] gap-3 sm:grid-cols-[minmax(0,1fr)_7.5rem]">
              <Field label="Bulan tagihan" required>
                <Select
                  aria-label="Bulan tagihan"
                  value={periodMonth.slice(5, 7)}
                  onChange={(event) =>
                    changePeriod(`${periodMonth.slice(0, 4)}-${event.target.value}`)
                  }
                >
                  {MONTH_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Tahun" required>
                <Select
                  aria-label="Tahun tagihan"
                  value={String(currentYear)}
                  onChange={(event) =>
                    changePeriod(`${event.target.value}-${periodMonth.slice(5, 7)}`)
                  }
                >
                  {Array.from({ length: 9 }, (_, index) => currentYear - 3 + index).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  )}
                </Select>
              </Field>
            </div>

            <Field label="Tanggal jatuh tempo" required>
              <Select
                aria-label="Tanggal jatuh tempo"
                value={dueDay}
                onChange={(event) => setDueDay(event.target.value)}
              >
                {Array.from({ length: daysInPeriod }, (_, index) =>
                  String(index + 1)
                ).map((day) => (
                  <option key={day} value={day}>
                    {Number(day)} {MONTH_OPTIONS[Number(periodMonth.slice(5, 7)) - 1][1]}{' '}
                    {currentYear}
                  </option>
                ))}
              </Select>
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={generating}
                onClick={() => setIsBatchOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleBatchGenerate}
                disabled={generating}
                isLoading={generating}
              >
                {billMode === 'SINGLE'
                  ? 'Buat tagihan lapak'
                  : 'Buat tagihan serentak'}
              </Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog: Tolak Bukti Pembayaran */}
      <Dialog
        open={Boolean(rejectingProofId)}
        onOpenChange={(open) => {
          if (!open && !paying) {
            setRejectingProofId(null);
            setProofReviewNote('');
            setRejectError('');
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Tolak bukti pembayaran</DialogTitle>
            <DialogDescription>
              Penyewa akan menerima pemberitahuan beserta alasan penolakan agar dapat mengunggah ulang bukti yang sesuai.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRejectProof} className="space-y-4">
            {rejectError && (
              <Alert variant="danger" role="alert">
                {rejectError}
              </Alert>
            )}

            <Field
              label="Alasan penolakan"
              required
              hint="Minimal 5 karakter agar penyewa tahu hal yang perlu diperbaiki."
            >
              <Textarea
                required
                minLength={5}
                maxLength={500}
                rows={3}
                value={proofReviewNote}
                onChange={(event) => setProofReviewNote(event.target.value)}
                placeholder="Contoh: nominal pada bukti transfer tidak terbaca"
              />
            </Field>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={paying}
                onClick={() => {
                  setRejectingProofId(null);
                  setProofReviewNote('');
                  setRejectError('');
                }}
              >
                Batal
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={paying || proofReviewNote.trim().length < 5}
                isLoading={paying}
              >
                Tolak bukti dan beri tahu penyewa
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Tolak Perpanjangan Sewa */}
      <Dialog
        open={Boolean(confirmRejectRenewal)}
        onOpenChange={(open) => {
          if (!open && !reviewingId) setConfirmRejectRenewal(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Tolak perpanjangan sewa?</DialogTitle>
            <DialogDescription>
              Permintaan perpanjangan dari {confirmRejectRenewal?.warungName} (Lapak{' '}
              {confirmRejectRenewal?.lapakCode}) akan ditolak dan penyewa menerima notifikasi.
            </DialogDescription>
          </DialogHeader>

          {confirmRejectRenewal && (
            <div className="space-y-4">
              {reviewNote[confirmRejectRenewal.id]?.trim() ? (
                <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
                  <p className="text-xs font-semibold text-text-secondary">
                    Catatan yang akan dikirim:
                  </p>
                  <p className="mt-1 text-text-primary">
                    {reviewNote[confirmRejectRenewal.id]}
                  </p>
                </div>
              ) : (
                <Alert variant="warning">
                  Anda belum mengisi catatan untuk penyewa. Tetap tolak permintaan ini?
                </Alert>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={reviewingId === confirmRejectRenewal.id}
                  onClick={() => setConfirmRejectRenewal(null)}
                >
                  Batal
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  isLoading={reviewingId === confirmRejectRenewal.id}
                  onClick={() =>
                    void handleRenewalReview(confirmRejectRenewal.id, 'REJECTED')
                  }
                >
                  Ya, tolak permintaan
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Catat Bayar Cicilan & Overpayment */}
      <Dialog open={Boolean(selectedInvoice)} onOpenChange={handleClosePayment}>
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Catat pembayaran Lapak {selectedInvoice?.lapakCode}
            </DialogTitle>
            <DialogDescription>
              Pembayaran akan memperbarui status tagihan dan otomatis tercatat di buku kas sentra.
            </DialogDescription>
          </DialogHeader>

          {selectedInvoice && (
            <form onSubmit={handleSavePayment} className="space-y-4">
              {payError && (
                <Alert variant="danger" role="alert">
                  {payError}
                </Alert>
              )}

              <div className="space-y-1.5 rounded-xl border border-border-subtle bg-surface-muted p-3.5 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">Nomor tagihan</span>
                  <span className="font-mono font-semibold text-text-primary">
                    {selectedInvoice.invoiceNumber}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-text-secondary">Penyewa</span>
                  <span className="font-semibold text-text-primary">
                    {selectedInvoice.warungName}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-border-subtle pt-1.5">
                  <span className="text-text-secondary">Sisa tagihan</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {formatRupiah(selectedInvoice.remainingAmount)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Field label="Nominal pembayaran" required>
                  <RupiahInput
                    value={payAmount}
                    onValueChange={setPayAmount}
                    placeholder="0"
                  />
                </Field>

                {payAmount !== selectedInvoice.remainingAmount && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setPayAmount(selectedInvoice.remainingAmount)}
                    className="px-2"
                  >
                    Isi sesuai sisa ({formatRupiah(selectedInvoice.remainingAmount)})
                  </Button>
                )}

                {payAmount > selectedInvoice.remainingAmount && (
                  <Alert variant="info" icon={Info}>
                    Lebih bayar sebesar{' '}
                    <span className="font-mono font-semibold tabular-nums">
                      {formatRupiah(payAmount - selectedInvoice.remainingAmount)}
                    </span>{' '}
                    otomatis masuk ke saldo deposit warung.
                  </Alert>
                )}
              </div>

              <Field
                label="Metode pembayaran"
                required
                hint={
                  selectedProofId
                    ? 'Verifikasi bukti transfer wajib dicatat sebagai Transfer / QRIS.'
                    : undefined
                }
              >
                <Select
                  aria-label="Metode pembayaran"
                  value={selectedProofId ? 'TRANSFER_QRIS' : payMethod}
                  disabled={Boolean(selectedProofId)}
                  onChange={(e) => setPayMethod(e.target.value)}
                >
                  <option value="TUNAI">Tunai</option>
                  <option value="TRANSFER_QRIS">Transfer / QRIS</option>
                </Select>
              </Field>

              <Field label="Catatan pembayaran (opsional)">
                <Input
                  type="text"
                  maxLength={500}
                  value={payNotes}
                  onChange={(e) => setPayNotes(e.target.value)}
                  placeholder="Contoh: Cicilan tahap 1 atau dibayar tunai di pos"
                />
              </Field>

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={paying}
                  onClick={() => handleClosePayment(false)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={paying || payAmount <= 0}
                  isLoading={paying}
                >
                  Konfirmasi pembayaran
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Detail Tagihan & Riwayat (terutama dari tabel desktop) */}
      <Dialog
        open={Boolean(detailInvoice)}
        onOpenChange={(open) => {
          if (!open) setDetailInvoiceId(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              Detail tagihan Lapak {detailInvoice?.lapakCode}
            </DialogTitle>
            <DialogDescription>
              {detailInvoice?.warungName} · {detailInvoice?.invoiceNumber}
            </DialogDescription>
          </DialogHeader>

          {detailInvoice && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <InvoiceStatusBadge status={detailInvoice.status} />
                {isOverdue(detailInvoice) && (
                  <Badge variant="danger">
                    <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                    <span>TERLAMBAT</span>
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-surface-muted p-4 text-sm sm:grid-cols-3">
                <div>
                  <span className="block text-xs text-text-secondary">Total</span>
                  <span className="font-mono font-bold text-text-primary tabular-nums">
                    {formatRupiah(detailInvoice.totalAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-text-secondary">Sudah dibayar</span>
                  <span className="font-mono font-bold text-status-success tabular-nums">
                    {formatRupiah(detailInvoice.paidAmount)}
                  </span>
                </div>
                <div>
                  <span className="block text-xs text-text-secondary">Sisa</span>
                  <span className="font-mono font-bold text-status-danger tabular-nums">
                    {formatRupiah(detailInvoice.remainingAmount)}
                  </span>
                </div>
                <div className="sm:col-span-3 border-t border-border-subtle pt-2 text-xs text-text-secondary">
                  Periode {formatPeriodShort(detailInvoice.periodStart)} · Jatuh tempo{' '}
                  {formatDateLongWIB(detailInvoice.dueDate)}
                </div>
              </div>

              <div className="space-y-2">
                <h3 className="text-sm font-bold text-text-primary">
                  Riwayat pembayaran ({detailInvoice.payments.length})
                </h3>
                {detailInvoice.payments.length === 0 ? (
                  <p className="rounded-xl border border-border-subtle bg-surface p-3.5 text-sm text-text-secondary">
                    Belum ada pembayaran yang dicatat untuk tagihan ini.
                  </p>
                ) : (
                  <div className="divide-y divide-border-subtle rounded-xl border border-border-subtle bg-surface">
                    {detailInvoice.payments.map((payment, index) => (
                      <div
                        key={`${detailInvoice.id}-detail-${index}`}
                        className="flex flex-wrap items-start justify-between gap-2 p-3.5 text-sm"
                      >
                        <div>
                          <p className="font-medium text-text-primary">
                            {paymentMethodLabels[payment.paymentMethod] ??
                              payment.paymentMethod}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatDateTimeWIB(payment.paidAt)}
                          </p>
                          {payment.notes && (
                            <p className="mt-1 text-xs text-text-secondary">
                              {payment.notes}
                            </p>
                          )}
                        </div>
                        <span className="font-mono font-bold text-text-primary tabular-nums">
                          {formatRupiah(payment.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {(proofsByInvoice.get(detailInvoice.id) ?? []).length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-text-primary">
                    Bukti transfer penyewa
                  </h3>
                  <div className="space-y-2.5">
                    {renderInvoiceProofs(
                      detailInvoice,
                      proofsByInvoice.get(detailInvoice.id) ?? []
                    )}
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => handleSendWA(detailInvoice)}
                >
                  <MessageSquare
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-status-success"
                  />
                  <span>
                    {detailInvoice.remainingAmount > 0
                      ? 'Pengingat WA'
                      : 'Konfirmasi WA'}
                  </span>
                </Button>
                {detailInvoice.status !== 'PAID' && detailInvoice.status !== 'WAIVED' && (
                  <Button
                    type="button"
                    onClick={() => {
                      const inv = detailInvoice;
                      setDetailInvoiceId(null);
                      handleOpenPayment(inv);
                    }}
                  >
                    Catat bayar
                  </Button>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
