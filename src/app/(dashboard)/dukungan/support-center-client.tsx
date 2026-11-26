'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileImage,
  LifeBuoy,
  Mail,
  MessageSquare,
  Send,
  Trash2,
  Wrench,
} from 'lucide-react';
import { FilterBar, PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, TicketStatusBadge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatDateWIB } from '@/lib/utils/date';
import { cn, formatActionError } from '@/lib/utils';
import { createFacilityTicket, updateFacilityTicket } from '@/server/actions/lapak.actions';
import { createSupportRequest, updateSupportRequest } from '@/server/actions/support.actions';
import type { TicketStatus, UserRoleType } from '@/types';

export type SupportRequestItem = {
  id: string;
  subject: string;
  message: string;
  status: string;
  response: string | null;
  attachmentPath: string | null;
  createdAt: string;
  requesterRole: UserRoleType;
  requesterName: string;
  requesterEmail: string;
  requesterPhone: string | null;
};

export type FacilityTicketItem = {
  id: string;
  lapakCode?: string;
  warungName?: string;
  category: string;
  description: string;
  photoUrl: string | null;
  feedback: string | null;
  status: TicketStatus;
  createdAt: string;
  resolvedAt: string | null;
  contact?: { name: string; phone: string | null; email: string } | null;
};

const ROLE_LABELS: Record<UserRoleType, string> = {
  SUPER_ADMIN: 'Super Admin',
  PENGELOLA_ADMIN: 'Pengelola Sentra',
  TENANT_MEMBER: 'Pemilik Warung',
};

const FACILITY_CATEGORY_LABELS: Record<string, string> = {
  LISTRIK: 'Listrik',
  AIR: 'Air',
  KEBERSIHAN: 'Kebersihan',
  BANGUNAN: 'Bangunan',
};

const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_ATTACHMENT_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

function toWhatsAppUrl(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('0')
    ? `62${digits.slice(1)}`
    : digits.startsWith('8')
    ? `62${digits}`
    : digits;
  return `https://wa.me/${normalized}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatReadableError(error: unknown, fallback: string): string {
  return formatActionError(error, fallback);
}

function SupportStatusBadge({ status }: { status: string }) {
  if (status === 'RESOLVED') {
    return (
      <Badge variant="success">
        <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Selesai</span>
      </Badge>
    );
  }
  if (status === 'IN_PROGRESS') {
    return (
      <Badge variant="warning">
        <Clock aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
        <span>Ditangani</span>
      </Badge>
    );
  }
  return (
    <Badge variant="danger">
      <AlertCircle aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
      <span>Baru</span>
    </Badge>
  );
}

export function SupportCenterClient({
  role,
  initialRequests,
  facilityTickets,
}: {
  role: UserRoleType;
  initialRequests: SupportRequestItem[];
  facilityTickets: FacilityTicketItem[];
}) {
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [requests, setRequests] = React.useState(initialRequests);
  const [activeTab, setActiveTab] = React.useState<'facility' | 'application'>(() => {
    if (role === 'SUPER_ADMIN') return 'application';
    if (role === 'PENGELOLA_ADMIN') return 'facility';
    return facilityTickets.length > 0 && initialRequests.length === 0
      ? 'facility'
      : 'application';
  });

  // Filters
  const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'RESOLVED'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Create form state
  const [issueType, setIssueType] = React.useState<'APPLICATION' | 'FACILITY'>('APPLICATION');
  const [facilityCategory, setFacilityCategory] = React.useState<
    'LISTRIK' | 'AIR' | 'KEBERSIHAN' | 'BANGUNAN'
  >('LISTRIK');
  const [subject, setSubject] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [attachment, setAttachment] = React.useState<File | null>(null);
  const [submitting, setSubmitting] = React.useState(false);
  const [formErrors, setFormErrors] = React.useState<{
    subject?: string;
    message?: string;
    attachment?: string;
  }>({});

  // Global feedback banners
  const [successFeedback, setSuccessFeedback] = React.useState('');
  const [errorFeedback, setErrorFeedback] = React.useState('');

  // Update drafts & loading state per ticket
  const [supportDrafts, setSupportDrafts] = React.useState<
    Record<string, { status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED'; response: string }>
  >({});
  const [savingSupportId, setSavingSupportId] = React.useState<string | null>(null);

  const [facilityDrafts, setFacilityDrafts] = React.useState<
    Record<string, { status: TicketStatus; feedback: string }>
  >({});
  const [facilityErrors, setFacilityErrors] = React.useState<
    Record<string, { status?: string; feedback?: string }>
  >({});
  const [savingFacilityId, setSavingFacilityId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRequests(initialRequests);
  }, [initialRequests]);

  const facilityOpenCount = facilityTickets.filter((t) => t.status !== 'RESOLVED').length;
  const appOpenCount = requests.filter((r) => r.status !== 'RESOLVED').length;
  const totalOpenCount = facilityOpenCount + appOpenCount;

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredFacilityTickets = React.useMemo(() => {
    return facilityTickets.filter((ticket) => {
      if (statusFilter === 'ACTIVE' && ticket.status === 'RESOLVED') return false;
      if (statusFilter === 'RESOLVED' && ticket.status !== 'RESOLVED') return false;
      if (!normalizedQuery) return true;
      const haystack = [
        ticket.description,
        ticket.category,
        FACILITY_CATEGORY_LABELS[ticket.category] ?? '',
        ticket.lapakCode ?? '',
        ticket.warungName ?? '',
        ticket.contact?.name ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [facilityTickets, statusFilter, normalizedQuery]);

  const filteredSupportRequests = React.useMemo(() => {
    return requests.filter((req) => {
      if (statusFilter === 'ACTIVE' && req.status === 'RESOLVED') return false;
      if (statusFilter === 'RESOLVED' && req.status !== 'RESOLVED') return false;
      if (!normalizedQuery) return true;
      const haystack = [
        req.subject,
        req.message,
        req.requesterName,
        req.requesterEmail,
        req.response ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [requests, statusFilter, normalizedQuery]);

  function clearAttachment() {
    setAttachment(null);
    setFormErrors((prev) => ({ ...prev, attachment: undefined }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) {
      clearAttachment();
      return;
    }
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFormErrors((prev) => ({
        ...prev,
        attachment: 'Gunakan gambar berformat PNG, JPEG, atau WebP.',
      }));
      return;
    }
    if (file.size === 0 || file.size > MAX_ATTACHMENT_BYTES) {
      setAttachment(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setFormErrors((prev) => ({
        ...prev,
        attachment: 'Ukuran foto maksimal 5 MB.',
      }));
      return;
    }
    setAttachment(file);
    setFormErrors((prev) => ({ ...prev, attachment: undefined }));
  }

  async function handleSubmitTicket(event: React.FormEvent) {
    event.preventDefault();
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    const maxMessageLen = issueType === 'FACILITY' ? 800 : 5000;
    const nextErrors: { subject?: string; message?: string; attachment?: string } = {};

    if (trimmedSubject.length < 4 || trimmedSubject.length > 120) {
      nextErrors.subject = 'Judul tiket harus 4 sampai 120 karakter.';
    }
    if (trimmedMessage.length < 10 || trimmedMessage.length > maxMessageLen) {
      nextErrors.message = `Penjelasan kendala harus 10 sampai ${maxMessageLen.toLocaleString('id-ID')} karakter.`;
    }
    if (attachment) {
      if (!ALLOWED_ATTACHMENT_TYPES.includes(attachment.type)) {
        nextErrors.attachment = 'Gunakan gambar PNG, JPEG, atau WebP.';
      } else if (attachment.size > MAX_ATTACHMENT_BYTES) {
        nextErrors.attachment = 'Ukuran foto maksimal 5 MB.';
      }
    }

    if (nextErrors.subject || nextErrors.message || nextErrors.attachment) {
      setFormErrors(nextErrors);
      setErrorFeedback('Periksa kembali isian formulir tiket Anda.');
      setSuccessFeedback('');
      return;
    }

    setFormErrors({});
    setSubmitting(true);
    setSuccessFeedback('');
    setErrorFeedback('');
    let uploadedPath: string | null = null;

    try {
      if (issueType === 'FACILITY') {
        let photoUrl: string | undefined;
        if (attachment) {
          const form = new FormData();
          form.set('file', attachment);
          const response = await fetch('/api/ticket-photos', { method: 'POST', body: form });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Foto gagal diunggah.');
          photoUrl = result.path;
        }
        await createFacilityTicket({
          category: facilityCategory,
          description: `${trimmedSubject}: ${trimmedMessage}`.slice(0, 1000),
          photoUrl,
        });
        setSuccessFeedback(
          'Laporan fasilitas terkirim. Admin dapat melihat foto, memperbarui status, dan membalas di sini.'
        );
        setActiveTab('facility');
      } else {
        if (attachment) {
          const form = new FormData();
          form.set('file', attachment);
          const response = await fetch('/api/support-attachments', {
            method: 'POST',
            body: form,
          });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error || 'Lampiran gagal diunggah.');
          uploadedPath = result.path;
        }
        await createSupportRequest({
          subject: trimmedSubject,
          message: trimmedMessage,
          attachmentPath: uploadedPath ?? undefined,
        });
        setSuccessFeedback(
          'Tiket terkirim ke Super Admin. Status dan balasannya tersimpan di riwayat ini.'
        );
        setActiveTab('application');
      }

      setSubject('');
      setMessage('');
      clearAttachment();
      router.refresh();
    } catch (error) {
      if (uploadedPath) {
        const cleanup = new FormData();
        cleanup.set('path', uploadedPath);
        await fetch('/api/support-attachments', { method: 'DELETE', body: cleanup }).catch(
          () => undefined
        );
      }
      setErrorFeedback(formatReadableError(error, 'Tiket tidak dapat dikirim.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function saveSupportUpdate(request: SupportRequestItem) {
    const draft = supportDrafts[request.id] ?? {
      status: request.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
      response: request.response ?? '',
    };
    setSavingSupportId(request.id);
    setSuccessFeedback('');
    setErrorFeedback('');
    try {
      await updateSupportRequest({ id: request.id, ...draft });
      setSuccessFeedback(`Pembaruan tiket "${request.subject}" berhasil dikirim.`);
      setSupportDrafts((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      router.refresh();
    } catch (error) {
      setErrorFeedback(formatReadableError(error, 'Pembaruan tiket tidak dapat disimpan.'));
    } finally {
      setSavingSupportId(null);
    }
  }

  async function saveFacilityUpdate(ticket: FacilityTicketItem) {
    const draft = facilityDrafts[ticket.id] ?? {
      status: ticket.status,
      feedback: ticket.feedback ?? '',
    };

    const nextFieldErrors: { status?: string; feedback?: string } = {};
    if (draft.status === 'OPEN') {
      nextFieldErrors.status =
        'Pilih status Sedang diperbaiki atau Selesai diperbaiki terlebih dahulu.';
    }
    if (draft.feedback.trim().length < 3) {
      nextFieldErrors.feedback = 'Berikan catatan minimal 3 karakter untuk penyewa.';
    }
    if (nextFieldErrors.status || nextFieldErrors.feedback) {
      setFacilityErrors((prev) => ({ ...prev, [ticket.id]: nextFieldErrors }));
      return;
    }

    setFacilityErrors((prev) => {
      const next = { ...prev };
      delete next[ticket.id];
      return next;
    });
    setSavingFacilityId(ticket.id);
    setSuccessFeedback('');
    setErrorFeedback('');

    try {
      await updateFacilityTicket({
        ticketId: ticket.id,
        status: draft.status,
        feedback: draft.feedback.trim(),
      });
      setSuccessFeedback(
        draft.status === 'RESOLVED'
          ? 'Tiket fasilitas ditandai selesai dan penyewa sudah diberi kabar.'
          : 'Status perbaikan dan catatan berhasil dikirim ke penyewa.'
      );
      setFacilityDrafts((current) => {
        const next = { ...current };
        delete next[ticket.id];
        return next;
      });
      router.refresh();
    } catch (error) {
      const msg = formatReadableError(error, 'Gagal memperbarui tiket fasilitas.');
      setFacilityErrors((prev) => ({ ...prev, [ticket.id]: { feedback: msg } }));
      setErrorFeedback(msg);
    } finally {
      setSavingFacilityId(null);
    }
  }

  const filterBar = (
    <FilterBar
      actions={
        (searchQuery || statusFilter !== 'ALL') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStatusFilter('ALL');
              setSearchQuery('');
            }}
          >
            Reset filter
          </Button>
        )
      }
    >
      <div className="min-w-0 flex-1">
        <Field label="Cari tiket" htmlFor="ticket-search">
          {(a11y) => (
            <Input
              {...a11y}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Cari judul, deskripsi, atau nama warung..."
            />
          )}
        </Field>
      </div>
      <div className="w-full sm:w-52">
        <Field label="Status" htmlFor="ticket-status-filter">
          {(a11y) => (
            <Select
              {...a11y}
              aria-label="Filter status tiket"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'ALL' | 'ACTIVE' | 'RESOLVED')
              }
            >
              <option value="ALL">Semua status</option>
              <option value="ACTIVE">Terbuka & diproses</option>
              <option value="RESOLVED">Selesai</option>
            </Select>
          )}
        </Field>
      </div>
    </FilterBar>
  );

  const facilityPanel = (
    <div className="space-y-4">
      {filteredFacilityTickets.length === 0 ? (
        <EmptyState
          icon={Wrench}
          title={
            facilityTickets.length === 0
              ? 'Belum ada tiket kendala fasilitas'
              : 'Tidak ada tiket fasilitas yang sesuai filter'
          }
          description={
            facilityTickets.length === 0
              ? role === 'TENANT_MEMBER'
                ? 'Apabila listrik, air, kebersihan, atau bangunan lapak mengalami kendala, kirim laporan lewat formulir tiket.'
                : 'Laporan kendala fasilitas dari penyewa lapak akan muncul di sini untuk ditindaklanjuti.'
              : 'Coba ubah kata kunci pencarian atau pilih semua status.'
          }
          action={
            facilityTickets.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Tampilkan semua tiket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stagger itemCount={filteredFacilityTickets.length} className="space-y-3">
          {filteredFacilityTickets.map((ticket) => {
            const draft = facilityDrafts[ticket.id] ?? {
              status: ticket.status,
              feedback: ticket.feedback ?? '',
            };
            const isSaving = savingFacilityId === ticket.id;

            return (
              <StaggerItem key={ticket.id}>
                <Card>
                  <CardContent className="space-y-4 pt-5 sm:pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="neutral">
                            {FACILITY_CATEGORY_LABELS[ticket.category] ?? ticket.category}
                          </Badge>
                          {ticket.lapakCode && (
                            <span className="text-xs font-semibold text-text-secondary">
                              Lapak {ticket.lapakCode}
                              {ticket.warungName ? ` (${ticket.warungName})` : ''}
                            </span>
                          )}
                        </div>
                        <h3 className="break-words text-base font-bold leading-snug text-text-primary">
                          {ticket.description}
                        </h3>
                        <p className="text-xs text-text-secondary">
                          Dilapor {formatDateWIB(ticket.createdAt)}
                        </p>
                      </div>
                      <TicketStatusBadge status={ticket.status} />
                    </div>

                    {ticket.photoUrl && (
                      <div>
                        <a
                          href={`/api/ticket-photos/${ticket.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                        >
                          <FileImage aria-hidden="true" className="h-4 w-4" />
                          <span>Lihat foto kendala</span>
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}

                    {role !== 'TENANT_MEMBER' && ticket.contact && (
                      <div className="rounded-xl border border-border-subtle bg-canvas/80 p-3.5 text-sm">
                        <p className="font-semibold text-text-primary">
                          Kontak penyewa: {ticket.contact.name}
                        </p>
                        <p className="mt-0.5 break-all text-xs text-text-secondary">
                          {ticket.contact.phone || ticket.contact.email}
                        </p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ticket.contact.phone && (
                            <a
                              href={toWhatsAppUrl(ticket.contact.phone)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                            >
                              <MessageSquare aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                              <span>WhatsApp penyewa</span>
                            </a>
                          )}
                          <a
                            href={`mailto:${ticket.contact.email}`}
                            className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                          >
                            <Mail aria-hidden="true" className="h-4 w-4" />
                            <span>Email</span>
                          </a>
                        </div>
                      </div>
                    )}

                    {ticket.feedback && (
                      <Alert
                        variant={ticket.status === 'RESOLVED' ? 'success' : 'info'}
                        title={
                          ticket.resolvedAt
                            ? `Catatan untuk penyewa (selesai ${formatDateWIB(ticket.resolvedAt)})`
                            : 'Catatan untuk penyewa'
                        }
                      >
                        <p className="whitespace-pre-wrap break-words">{ticket.feedback}</p>
                      </Alert>
                    )}

                    {role !== 'TENANT_MEMBER' && ticket.status !== 'RESOLVED' && (
                      <div className="space-y-3 border-t border-border-subtle pt-4">
                        <Field
                          label="Status penanganan"
                          htmlFor={`facility-status-${ticket.id}`}
                          error={facilityErrors[ticket.id]?.status}
                          required
                        >
                          {(a11y) => (
                            <Select
                              {...a11y}
                              aria-label={`Status penanganan tiket ${ticket.description}`}
                              disabled={isSaving}
                              value={draft.status}
                              onChange={(event) => {
                                const nextStatus = event.target.value as TicketStatus;
                                setFacilityDrafts((current) => ({
                                  ...current,
                                  [ticket.id]: { ...draft, status: nextStatus },
                                }));
                                if (facilityErrors[ticket.id]?.status) {
                                  setFacilityErrors((prev) => ({
                                    ...prev,
                                    [ticket.id]: { ...prev[ticket.id], status: undefined },
                                  }));
                                }
                              }}
                            >
                              {ticket.status === 'OPEN' && (
                                <option value="OPEN" disabled>
                                  Belum ditangani (pilih tindak lanjut)
                                </option>
                              )}
                              <option value="IN_PROGRESS">Sedang diperbaiki</option>
                              <option value="RESOLVED">Selesai diperbaiki</option>
                            </Select>
                          )}
                        </Field>

                        <Field
                          label="Umpan balik untuk penyewa"
                          htmlFor={`facility-feedback-${ticket.id}`}
                          hint="Minimal 3 karakter, maksimal 1.000 karakter."
                          error={facilityErrors[ticket.id]?.feedback}
                          required
                        >
                          {(a11y) => (
                            <Textarea
                              {...a11y}
                              rows={3}
                              maxLength={1000}
                              disabled={isSaving}
                              value={draft.feedback}
                              onChange={(event) => {
                                setFacilityDrafts((current) => ({
                                  ...current,
                                  [ticket.id]: { ...draft, feedback: event.target.value },
                                }));
                                if (facilityErrors[ticket.id]?.feedback) {
                                  setFacilityErrors((prev) => ({
                                    ...prev,
                                    [ticket.id]: { ...prev[ticket.id], feedback: undefined },
                                  }));
                                }
                              }}
                              placeholder="Jelaskan tindakan atau hasil perbaikan"
                            />
                          )}
                        </Field>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          isLoading={isSaving}
                          onClick={() => void saveFacilityUpdate(ticket)}
                          className="w-full sm:w-auto"
                        >
                          Simpan status dan kirim kabar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );

  const applicationPanel = (
    <div className="space-y-4">
      {filteredSupportRequests.length === 0 ? (
        <EmptyState
          icon={LifeBuoy}
          title={
            requests.length === 0
              ? role === 'SUPER_ADMIN'
                ? 'Belum ada tiket aplikasi'
                : 'Belum ada tiket aplikasi dari akun Anda'
              : 'Tidak ada tiket aplikasi yang sesuai filter'
          }
          description={
            requests.length === 0
              ? role === 'SUPER_ADMIN'
                ? 'Tiket kendala akun dan aplikasi dari pengelola maupun pemilik warung akan tampil di sini.'
                : 'Gunakan formulir buat tiket apabila mengalami kendala akses akun, data, atau fitur aplikasi.'
              : 'Coba ubah kata kunci pencarian atau pilih semua status.'
          }
          action={
            requests.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setStatusFilter('ALL');
                  setSearchQuery('');
                }}
              >
                Tampilkan semua tiket
              </Button>
            ) : undefined
          }
        />
      ) : (
        <Stagger itemCount={filteredSupportRequests.length} className="space-y-3">
          {filteredSupportRequests.map((request) => {
            const draft = supportDrafts[request.id] ?? {
              status: request.status as 'OPEN' | 'IN_PROGRESS' | 'RESOLVED',
              response: request.response ?? '',
            };
            const isSaving = savingSupportId === request.id;

            return (
              <StaggerItem key={request.id}>
                <Card>
                  <CardContent className="space-y-4 pt-5 sm:pt-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="break-words text-base font-bold leading-snug text-text-primary">
                          {request.subject}
                        </h3>
                        <p className="break-words text-xs text-text-secondary">
                          {formatDateWIB(request.createdAt)} · {ROLE_LABELS[request.requesterRole]}
                          {role === 'SUPER_ADMIN'
                            ? ` · ${request.requesterName} · ${request.requesterEmail}${
                                request.requesterPhone ? ` · ${request.requesterPhone}` : ''
                              }`
                            : ''}
                        </p>
                      </div>
                      <SupportStatusBadge status={request.status} />
                    </div>

                    {role === 'SUPER_ADMIN' && request.requesterPhone && (
                      <div className="flex flex-wrap gap-2">
                        <a
                          href={toWhatsAppUrl(request.requesterPhone)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                        >
                          <MessageSquare aria-hidden="true" className="h-4 w-4 text-brand-primary" />
                          <span>Hubungi pelapor (WhatsApp)</span>
                        </a>
                      </div>
                    )}

                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-text-primary">
                      {request.message}
                    </p>

                    {request.attachmentPath && (
                      <div>
                        <a
                          href={`/api/support-attachments/${request.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
                        >
                          <FileImage aria-hidden="true" className="h-4 w-4" />
                          <span>Lihat foto lampiran</span>
                          <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    )}

                    {role === 'SUPER_ADMIN' ? (
                      <div className="space-y-3 border-t border-border-subtle pt-4">
                        <Field
                          label="Status tiket"
                          htmlFor={`support-status-${request.id}`}
                        >
                          {(a11y) => (
                            <Select
                              {...a11y}
                              aria-label={`Status tiket ${request.subject}`}
                              disabled={isSaving}
                              value={draft.status}
                              onChange={(event) =>
                                setSupportDrafts((current) => ({
                                  ...current,
                                  [request.id]: {
                                    ...draft,
                                    status: event.target.value as typeof draft.status,
                                  },
                                }))
                              }
                            >
                              <option value="OPEN">Baru</option>
                              <option value="IN_PROGRESS">Sedang ditangani</option>
                              <option value="RESOLVED">Selesai</option>
                            </Select>
                          )}
                        </Field>

                        <Field
                          label="Balasan untuk pelapor"
                          htmlFor={`support-response-${request.id}`}
                          hint="Maksimal 5.000 karakter."
                        >
                          {(a11y) => (
                            <Textarea
                              {...a11y}
                              rows={3}
                              maxLength={5000}
                              disabled={isSaving}
                              value={draft.response}
                              onChange={(event) =>
                                setSupportDrafts((current) => ({
                                  ...current,
                                  [request.id]: { ...draft, response: event.target.value },
                                }))
                              }
                              placeholder="Tulis tanggapan atau langkah penyelesaian untuk pelapor"
                            />
                          )}
                        </Field>

                        <Button
                          type="button"
                          size="sm"
                          disabled={isSaving}
                          isLoading={isSaving}
                          onClick={() => void saveSupportUpdate(request)}
                          className="w-full sm:w-auto"
                        >
                          Kirim pembaruan
                        </Button>
                      </div>
                    ) : (
                      request.response && (
                        <Alert
                          variant={request.status === 'RESOLVED' ? 'success' : 'info'}
                          title="Balasan Super Admin"
                        >
                          <p className="whitespace-pre-wrap break-words">{request.response}</p>
                        </Alert>
                      )
                    )}
                  </CardContent>
                </Card>
              </StaggerItem>
            );
          })}
        </Stagger>
      )}
    </div>
  );

  const ticketsTabsSection = (
    <Section
      title={role === 'SUPER_ADMIN' ? 'Kotak masuk tiket' : 'Daftar tiket & riwayat'}
      description={
        role === 'SUPER_ADMIN'
          ? 'Tinjau laporan aplikasi dari seluruh pengguna serta pantau kendala fasilitas lapak.'
          : 'Pantau status penanganan tiket fasilitas lapak maupun laporan aplikasi Anda.'
      }
      headingLevel="h2"
    >
      <Tabs
        value={activeTab}
        onValueChange={(next) => setActiveTab(next as 'facility' | 'application')}
        className="space-y-4"
      >
        <TabsList label="Kategori tiket">
          <TabsTrigger value="facility">
            <Wrench aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Tiket fasilitas ({facilityTickets.length})</span>
          </TabsTrigger>
          <TabsTrigger value="application">
            <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0" />
            <span>Tiket aplikasi ({requests.length})</span>
          </TabsTrigger>
        </TabsList>

        {filterBar}

        <TabsContent value="facility" className="mt-0">
          {facilityPanel}
        </TabsContent>
        <TabsContent value="application" className="mt-0">
          {applicationPanel}
        </TabsContent>
      </Tabs>
    </Section>
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Pusat bantuan"
        title="Tiket & bantuan"
        description="Satu tempat untuk kendala aplikasi maupun fasilitas lapak. Lampirkan foto agar pengelola dapat meninjau masalah dengan jelas."
      />

      <ResponsiveGrid cols={3}>
        <StatCard
          label="Perlu ditangani"
          value={<AnimatedNumber value={totalOpenCount} />}
          hint={
            totalOpenCount > 0
              ? 'Gabungan tiket baru dan sedang diproses'
              : 'Seluruh tiket telah diselesaikan'
          }
          icon={Clock}
          tone={totalOpenCount > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Tiket fasilitas lapak"
          value={<AnimatedNumber value={facilityTickets.length} />}
          hint={`${facilityOpenCount} aktif`}
          icon={Wrench}
          tone="info"
        />
        <StatCard
          label="Tiket aplikasi & akun"
          value={<AnimatedNumber value={requests.length} />}
          hint={`${appOpenCount} aktif`}
          icon={LifeBuoy}
          tone="brand"
        />
      </ResponsiveGrid>

      {successFeedback && (
        <Alert variant="success" role="status" aria-live="polite">
          {successFeedback}
        </Alert>
      )}

      {errorFeedback && (
        <Alert variant="danger" role="alert">
          {errorFeedback}
        </Alert>
      )}

      {role !== 'SUPER_ADMIN' ? (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
          <FadeIn as="div" className="lg:col-span-5">
            <Section title="Buat tiket" headingLevel="h2">
              <Card>
                <CardHeader>
                  <h3 className="text-base font-bold leading-snug tracking-tight text-text-primary">
                    Formulir laporan kendala
                  </h3>
                  <CardDescription>
                    Kirim laporan baru agar segera diperiksa oleh petugas terkait.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmitTicket} noValidate className="space-y-4">
                    <Alert variant="neutral">
                      Untuk memudahkan tindak lanjut, petugas menerima nama dan email akun. Nomor WhatsApp atau telepon dari{' '}
                      <Link
                        href="/profil"
                        className="font-semibold text-brand-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                      >
                        Profil & kontak
                      </Link>{' '}
                      juga ditampilkan secara privat kepada petugas tiket.
                    </Alert>

                    {role === 'TENANT_MEMBER' && (
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium text-text-primary">
                          Jenis laporan
                        </legend>
                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            disabled={submitting}
                            aria-pressed={issueType === 'APPLICATION'}
                            onClick={() => {
                              setIssueType('APPLICATION');
                              setFormErrors({});
                            }}
                            className={cn(
                              'flex min-h-11 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                              issueType === 'APPLICATION'
                                ? 'border-brand-primary bg-brand-soft/60 text-brand-hover'
                                : 'border-border-subtle bg-surface text-text-primary hover:bg-surface-muted'
                            )}
                          >
                            <LifeBuoy aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <span>Aplikasi / akun</span>
                          </button>

                          <button
                            type="button"
                            disabled={submitting}
                            aria-pressed={issueType === 'FACILITY'}
                            onClick={() => {
                              setIssueType('FACILITY');
                              setFormErrors({});
                            }}
                            className={cn(
                              'flex min-h-11 items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-1',
                              issueType === 'FACILITY'
                                ? 'border-brand-primary bg-brand-soft/60 text-brand-hover'
                                : 'border-border-subtle bg-surface text-text-primary hover:bg-surface-muted'
                            )}
                          >
                            <Wrench aria-hidden="true" className="h-4 w-4 shrink-0" />
                            <span>Fasilitas lapak</span>
                          </button>
                        </div>
                      </fieldset>
                    )}

                    {issueType === 'FACILITY' && (
                      <Field
                        label="Kategori fasilitas"
                        htmlFor="ticket-facility-category"
                        required
                      >
                        {(a11y) => (
                          <Select
                            {...a11y}
                            disabled={submitting}
                            value={facilityCategory}
                            onChange={(event) =>
                              setFacilityCategory(event.target.value as typeof facilityCategory)
                            }
                          >
                            <option value="LISTRIK">Listrik</option>
                            <option value="AIR">Air</option>
                            <option value="KEBERSIHAN">Kebersihan</option>
                            <option value="BANGUNAN">Bangunan</option>
                          </Select>
                        )}
                      </Field>
                    )}

                    <Field
                      label="Judul tiket"
                      htmlFor="ticket-subject"
                      error={formErrors.subject}
                      required
                    >
                      {(a11y) => (
                        <Input
                          {...a11y}
                          required
                          minLength={4}
                          maxLength={120}
                          disabled={submitting}
                          value={subject}
                          onChange={(event) => {
                            setSubject(event.target.value);
                            if (formErrors.subject) {
                              setFormErrors((prev) => ({ ...prev, subject: undefined }));
                            }
                          }}
                          placeholder={
                            issueType === 'FACILITY'
                              ? 'Contoh: keran air bocor'
                              : 'Contoh: tidak bisa membuka tagihan'
                          }
                        />
                      )}
                    </Field>

                    <Field
                      label="Jelaskan kendala"
                      htmlFor="ticket-message"
                      hint="Minimal 10 karakter. Jangan sertakan kata sandi, PIN, atau data pembayaran rahasia."
                      error={formErrors.message}
                      required
                    >
                      {(a11y) => (
                        <Textarea
                          {...a11y}
                          required
                          minLength={10}
                          maxLength={issueType === 'FACILITY' ? 800 : 5000}
                          rows={4}
                          disabled={submitting}
                          value={message}
                          onChange={(event) => {
                            setMessage(event.target.value);
                            if (formErrors.message) {
                              setFormErrors((prev) => ({ ...prev, message: undefined }));
                            }
                          }}
                          placeholder="Ceritakan lokasi, waktu kejadian, dan kendala yang dialami"
                        />
                      )}
                    </Field>

                    <Field
                      label="Foto (opsional)"
                      htmlFor="ticket-attachment"
                      hint="PNG, JPEG, atau WebP, maksimal 5 MB. Di ponsel, Anda dapat mengambil foto langsung."
                      error={formErrors.attachment}
                    >
                      {(a11y) => (
                        <input
                          {...a11y}
                          ref={fileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                          capture="environment"
                          disabled={submitting}
                          onChange={handleFileChange}
                          className="flex min-h-11 w-full cursor-pointer items-center rounded-lg border border-border-input bg-surface px-3 py-1.5 text-base text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-primary hover:file:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
                        />
                      )}
                    </Field>

                    {attachment && (
                      <div className="flex items-center justify-between gap-3 rounded-lg border border-border-subtle bg-surface-muted px-3.5 py-2.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-text-primary">
                            {attachment.name}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatFileSize(attachment.size)}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={submitting}
                          onClick={clearAttachment}
                          aria-label="Hapus foto lampiran"
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4 text-status-danger" />
                          <span>Hapus</span>
                        </Button>
                      </div>
                    )}

                    <Separator />

                    <Button
                      type="submit"
                      disabled={submitting}
                      isLoading={submitting}
                      className="w-full"
                    >
                      <Send aria-hidden="true" className="h-4 w-4" />
                      <span>Kirim tiket</span>
                    </Button>
                  </form>
                </CardContent>
              </Card>
            </Section>
          </FadeIn>

          <FadeIn as="div" delay={0.05} className="lg:col-span-7">
            {ticketsTabsSection}
          </FadeIn>
        </div>
      ) : (
        <FadeIn as="div">{ticketsTabsSection}</FadeIn>
      )}
    </PageTransition>
  );
}
