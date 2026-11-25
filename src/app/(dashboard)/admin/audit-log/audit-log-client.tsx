'use client';

import * as React from 'react';
import {
  Eye,
  History,
  Receipt,
  Search,
  Shield,
  Store,
  UserCheck,
  Users,
} from 'lucide-react';
import { FilterBar, PageHeader, ResponsiveGrid, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { ExportCSVButton } from '@/components/reports/export-buttons';
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
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
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
import { formatRupiah } from '@/lib/utils/currency';
import { formatDateWIB } from '@/lib/utils/date';
import { getAuditLogs } from '@/server/actions/admin.actions';

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue: string | null;
  newValue: string | null;
  ipAddress?: string | null;
  createdAt: Date | string;
  actorEmail: string | null;
  actorName: string | null;
}

type AuditCategory = 'ALL' | 'ACCOUNT' | 'MASTER' | 'BILLING' | 'COMMUNITY';

const ACCOUNT_ACTIONS = new Set([
  'REGISTER_ACCOUNT',
  'UPDATE_ACCOUNT',
  'RESET_ACCOUNT_PASSWORD',
  'ACTIVATE_ACCOUNT',
  'DEACTIVATE_ACCOUNT',
  'DELETE_ACCOUNT',
  'TRANSFER_ACCOUNT',
  'CHANGE_PASSWORD',
]);

const MASTER_ACTIONS = new Set([
  'CREATE_WARUNG',
  'UPDATE_WARUNG',
  'DELETE_WARUNG',
  'CREATE_LAPAK',
  'UPDATE_LAPAK',
  'DELETE_LAPAK',
  'ASSIGN_LAPAK',
  'UNASSIGN_LAPAK',
  'REASSIGN_EXPIRED_LAPAK',
  'RELEASE_EXPIRED_LAPAK',
  'UPDATE_LAPAK_CONTRACT',
  'UPDATE_LAPAK_STATUS',
  'REVIEW_LAPAK_RENEWAL',
]);

const BILLING_ACTIONS = new Set([
  'GENERATE_INVOICE',
  'GENERATE_INVOICE_SINGLE',
  'CREATE_INVOICE',
  'RECORD_PAYMENT',
  'REJECT_PAYMENT_PROOF',
  'CREATE_SENTRA_EXPENSE',
]);

const COMMUNITY_ACTIONS = new Set([
  'CREATE_EVENT',
  'CREATE_POLL',
  'CLOSE_POLL',
  'RECORD_GUYUB_SAVINGS',
  'UPDATE_FACILITY_TICKET',
  'RESOLVE_TICKET',
  'CREATE_SUPPORT_REQUEST',
  'UPDATE_SUPPORT_REQUEST',
]);

const ACTION_LABELS: Record<string, string> = {
  REGISTER_ACCOUNT: 'Pendaftaran akun baru',
  UPDATE_ACCOUNT: 'Pembaruan data akun',
  RESET_ACCOUNT_PASSWORD: 'Reset kata sandi akun',
  ACTIVATE_ACCOUNT: 'Aktivasi akun',
  DEACTIVATE_ACCOUNT: 'Penonaktifan akun',
  DELETE_ACCOUNT: 'Penghapusan akses akun',
  TRANSFER_ACCOUNT: 'Transfer kepemilikan warung',
  CHANGE_PASSWORD: 'Perubahan kata sandi',
  CREATE_WARUNG: 'Penambahan warung',
  UPDATE_WARUNG: 'Pembaruan data warung',
  DELETE_WARUNG: 'Penghapusan warung',
  CREATE_LAPAK: 'Penambahan lapak',
  UPDATE_LAPAK: 'Pembaruan data lapak',
  DELETE_LAPAK: 'Penghapusan lapak',
  ASSIGN_LAPAK: 'Penempatan lapak',
  UNASSIGN_LAPAK: 'Pelepasan lapak',
  REASSIGN_EXPIRED_LAPAK: 'Pengalihan lapak habis kontrak',
  RELEASE_EXPIRED_LAPAK: 'Pelepasan lapak habis kontrak',
  UPDATE_LAPAK_CONTRACT: 'Pembaruan kontrak lapak',
  UPDATE_LAPAK_STATUS: 'Perubahan status lapak',
  REVIEW_LAPAK_RENEWAL: 'Tinjauan perpanjangan sewa',
  GENERATE_INVOICE: 'Pembuatan tagihan massal',
  GENERATE_INVOICE_SINGLE: 'Pembuatan tagihan lapak',
  CREATE_INVOICE: 'Pembuatan tagihan',
  RECORD_PAYMENT: 'Pencatatan pembayaran sewa',
  REJECT_PAYMENT_PROOF: 'Penolakan bukti bayar',
  CREATE_SENTRA_EXPENSE: 'Pengeluaran kas sentra',
  CREATE_EVENT: 'Pembuatan acara Guyub',
  CREATE_POLL: 'Pembukaan polling Guyub',
  CLOSE_POLL: 'Penutupan polling Guyub',
  RECORD_GUYUB_SAVINGS: 'Pembayaran iuran Guyub',
  UPDATE_FACILITY_TICKET: 'Pembaruan tiket fasilitas',
  RESOLVE_TICKET: 'Penyelesaian tiket fasilitas',
  CREATE_SUPPORT_REQUEST: 'Pengajuan tiket dukungan',
  UPDATE_SUPPORT_REQUEST: 'Tanggapan tiket dukungan',
};

function getAuditCategory(log: AuditItem): Exclude<AuditCategory, 'ALL'> {
  if (ACCOUNT_ACTIONS.has(log.action)) return 'ACCOUNT';
  if (MASTER_ACTIONS.has(log.action)) return 'MASTER';
  if (BILLING_ACTIONS.has(log.action)) return 'BILLING';
  if (COMMUNITY_ACTIONS.has(log.action)) return 'COMMUNITY';
  if (log.entityType === 'users') return 'ACCOUNT';
  if (log.entityType === 'warungs' || log.entityType === 'lapaks' || log.entityType === 'lapak_renewal_requests') {
    return 'MASTER';
  }
  if (log.entityType === 'invoices' || log.entityType === 'payment_proofs' || log.entityType === 'sentra_ledger') {
    return 'BILLING';
  }
  return 'COMMUNITY';
}

function getCategoryBadgeVariant(category: Exclude<AuditCategory, 'ALL'>) {
  switch (category) {
    case 'ACCOUNT':
      return 'brand' as const;
    case 'MASTER':
      return 'info' as const;
    case 'BILLING':
      return 'success' as const;
    case 'COMMUNITY':
      return 'neutral' as const;
  }
}

function getCategoryLabel(category: Exclude<AuditCategory, 'ALL'>) {
  switch (category) {
    case 'ACCOUNT':
      return 'Akun';
    case 'MASTER':
      return 'Lapak & Warung';
    case 'BILLING':
      return 'Tagihan & Kas';
    case 'COMMUNITY':
      return 'Guyub & Tiket';
  }
}

function parseJsonObject(raw: string | null): Record<string, unknown> | null {
  if (!raw || !raw.trim().startsWith('{')) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function summarizePayload(log: AuditItem): string {
  const nextObj = parseJsonObject(log.newValue);
  const prevObj = parseJsonObject(log.oldValue);
  const source = nextObj ?? prevObj;

  if (!source) {
    if (log.newValue && !log.newValue.startsWith('{')) {
      return log.newValue;
    }
    return `${log.entityType} (${log.entityId.slice(0, 8)})`;
  }

  if (typeof source.name === 'string') return source.name;
  if (typeof source.code === 'string') return `Lapak ${source.code}`;
  if (typeof source.title === 'string') return source.title;
  if (typeof source.question === 'string') return source.question;
  if (typeof source.subject === 'string') return source.subject;
  if (typeof source.email === 'string') return source.email;
  if (typeof source.periodStart === 'string') {
    const countText = typeof source.count === 'number' ? ` (${source.count} tagihan)` : '';
    return `Periode ${source.periodStart.slice(0, 7)}${countText}`;
  }
  if (typeof source.amount === 'number') {
    const method =
      typeof source.paymentMethod === 'string' ? ` (${source.paymentMethod})` : '';
    const desc =
      typeof source.description === 'string' ? `${source.description}: ` : '';
    return `${desc}${formatRupiah(source.amount)}${method}`;
  }
  if (typeof source.status === 'string') {
    return `${log.entityType}: ${source.status}`;
  }
  if (typeof source.isActive === 'boolean') {
    return source.isActive ? 'Akun diaktifkan' : 'Akun dinonaktifkan';
  }
  if (source.deleted === true) {
    return `${log.entityType} dihapus`;
  }
  return `${log.entityType} (${log.entityId.slice(0, 8)})`;
}

function formatJsonPreview(raw: string | null): string {
  if (!raw) return 'Tidak ada data';
  const obj = parseJsonObject(raw);
  if (obj) return JSON.stringify(obj, null, 2);
  return raw;
}

export function AuditLogClient({ initialLogs }: { initialLogs: AuditItem[] }) {
  const [logs, setLogs] = React.useState<AuditItem[]>(initialLogs);
  const [filter, setFilter] = React.useState<AuditCategory>('ALL');
  const [query, setQuery] = React.useState('');
  const [selectedLog, setSelectedLog] = React.useState<AuditItem | null>(null);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [hasMore, setHasMore] = React.useState(initialLogs.length >= 50);
  const [loadError, setLoadError] = React.useState('');

  React.useEffect(() => {
    setLogs(initialLogs);
    setHasMore(initialLogs.length >= 50);
  }, [initialLogs]);

  const counts = React.useMemo(() => {
    let account = 0;
    let master = 0;
    let billing = 0;
    let community = 0;
    for (const log of logs) {
      const cat = getAuditCategory(log);
      if (cat === 'ACCOUNT') account += 1;
      else if (cat === 'MASTER') master += 1;
      else if (cat === 'BILLING') billing += 1;
      else community += 1;
    }
    return { account, master, billing, community };
  }, [logs]);

  const filteredLogs = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return logs.filter((log) => {
      const category = getAuditCategory(log);
      if (filter !== 'ALL' && category !== filter) return false;
      if (!keyword) return true;
      const label = ACTION_LABELS[log.action] ?? log.action;
      const summary = summarizePayload(log);
      const actor = log.actorName || log.actorEmail || 'Sistem';
      const haystack = `${log.action} ${label} ${log.entityType} ${summary} ${actor} ${log.actorEmail ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [logs, filter, query]);

  async function handleLoadMore() {
    setLoadError('');
    setLoadingMore(true);
    try {
      const older = await getAuditLogs({ limit: 50, offset: logs.length });
      setLogs((current) => {
        const seen = new Set(current.map((item) => item.id));
        const additions = older.filter((item) => !seen.has(item.id));
        return [...current, ...additions];
      });
      setHasMore(older.length >= 50);
    } catch (cause) {
      setLoadError(
        cause instanceof Error ? cause.message : 'Gagal memuat riwayat audit berikutnya.'
      );
    } finally {
      setLoadingMore(false);
    }
  }

  const csvRows = React.useMemo(
    () =>
      filteredLogs.map((log) => [
        formatDateWIB(log.createdAt),
        log.action,
        ACTION_LABELS[log.action] ?? log.action,
        getCategoryLabel(getAuditCategory(log)),
        summarizePayload(log),
        log.actorName || log.actorEmail || 'Sistem',
        log.actorEmail || '-',
      ]),
    [filteredLogs]
  );

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Audit log"
        description="Catatan aktivitas sensitif dan perubahan operasional yang bersifat permanen serta tidak dapat diubah."
        actions={
          filteredLogs.length > 0 ? (
            <ExportCSVButton
              headers={[
                'Waktu (WIB)',
                'Kode Aksi',
                'Aktivitas',
                'Kategori',
                'Ringkasan Entitas',
                'Pelaku',
                'Email Pelaku',
              ]}
              rows={csvRows}
              filename="audit-log-sebakul"
            />
          ) : undefined
        }
      />

      <ResponsiveGrid cols={4}>
        <StatCard
          label="Catatan dimuat"
          value={<AnimatedNumber value={logs.length} />}
          hint="Log permanen terbaru"
          icon={Shield}
          tone="neutral"
        />
        <StatCard
          label="Akun & akses"
          value={<AnimatedNumber value={counts.account} />}
          hint="Pendaftaran, edit, transfer"
          icon={UserCheck}
          tone="brand"
        />
        <StatCard
          label="Lapak & warung"
          value={<AnimatedNumber value={counts.master} />}
          hint="Master data dan kontrak"
          icon={Store}
          tone="info"
        />
        <StatCard
          label="Tagihan & kas"
          value={<AnimatedNumber value={counts.billing} />}
          hint="Tagihan, bayar, pengeluaran"
          icon={Receipt}
          tone="success"
        />
      </ResponsiveGrid>

      <Section
        title="Riwayat aktivitas"
        description="Saring catatan menurut kategori atau cari berdasarkan aksi, pelaku, maupun nama entitas."
      >
        <div className="space-y-4">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as AuditCategory)}
          >
            <TabsList label="Kategori log audit">
              <TabsTrigger value="ALL">Semua ({logs.length})</TabsTrigger>
              <TabsTrigger value="ACCOUNT">Akun ({counts.account})</TabsTrigger>
              <TabsTrigger value="MASTER">Lapak & Warung ({counts.master})</TabsTrigger>
              <TabsTrigger value="BILLING">Tagihan & Kas ({counts.billing})</TabsTrigger>
              <TabsTrigger value="COMMUNITY">Guyub & Tiket ({counts.community})</TabsTrigger>
            </TabsList>
          </Tabs>

          <FilterBar>
            <div className="min-w-0 flex-1">
              <Field label="Cari catatan audit" htmlFor="audit-search">
                <div className="relative">
                  <Search
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                  />
                  <Input
                    id="audit-search"
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Cari kode aksi, warung, lapak, atau nama pelaku"
                    className="pl-10"
                  />
                </div>
              </Field>
            </div>
          </FilterBar>

          {loadError && <Alert variant="danger">{loadError}</Alert>}

          {logs.length === 0 ? (
            <EmptyState
              icon={History}
              title="Belum ada catatan audit"
              description="Setiap perubahan akun, lapak, tagihan, dan acara Guyub akan tercatat otomatis di sini."
            />
          ) : filteredLogs.length === 0 ? (
            <EmptyState
              compact
              icon={Search}
              title="Catatan tidak ditemukan"
              description="Tidak ada riwayat aktivitas pada kategori atau kata kunci ini."
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setFilter('ALL');
                    setQuery('');
                  }}
                >
                  Tampilkan semua catatan
                </Button>
              }
            />
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden md:block">
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Waktu (WIB)</TableHead>
                        <TableHead>Aktivitas</TableHead>
                        <TableHead>Kategori</TableHead>
                        <TableHead>Ringkasan</TableHead>
                        <TableHead>Pelaku</TableHead>
                        <TableHead className="text-right">Detail</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLogs.map((log) => {
                        const category = getAuditCategory(log);
                        const actionTitle = ACTION_LABELS[log.action] ?? log.action;
                        const summary = summarizePayload(log);
                        const actorDisplay = log.actorName || log.actorEmail || 'Sistem';
                        return (
                          <TableRow key={log.id}>
                            <TableCell className="whitespace-nowrap font-mono text-xs text-text-secondary">
                              {formatDateWIB(log.createdAt)}
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="font-semibold text-text-primary">{actionTitle}</p>
                                <code className="font-mono text-xs text-text-secondary">
                                  {log.action}
                                </code>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant={getCategoryBadgeVariant(category)}>
                                {getCategoryLabel(category)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <p className="max-w-xs truncate font-medium text-text-primary">
                                {summary}
                              </p>
                            </TableCell>
                            <TableCell>
                              <div className="space-y-0.5">
                                <p className="text-sm font-medium text-text-primary">
                                  {actorDisplay}
                                </p>
                                {log.actorEmail && log.actorName && (
                                  <p className="text-xs text-text-secondary">{log.actorEmail}</p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                onClick={() => setSelectedLog(log)}
                                aria-label={`Lihat rincian ${actionTitle}`}
                              >
                                <Eye aria-hidden="true" className="h-4 w-4" />
                                <span>Rincian</span>
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </div>

              {/* Mobile Card List */}
              <Stagger itemCount={filteredLogs.length} className="space-y-3 md:hidden">
                {filteredLogs.map((log) => {
                  const category = getAuditCategory(log);
                  const actionTitle = ACTION_LABELS[log.action] ?? log.action;
                  const summary = summarizePayload(log);
                  const actorDisplay = log.actorName || log.actorEmail || 'Sistem';

                  return (
                    <StaggerItem key={log.id}>
                      <Card>
                        <CardContent className="space-y-3 pt-4">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-sm font-bold text-text-primary">
                                {actionTitle}
                              </p>
                              <code className="block font-mono text-xs text-text-secondary">
                                {log.action}
                              </code>
                            </div>
                            <Badge variant={getCategoryBadgeVariant(category)}>
                              {getCategoryLabel(category)}
                            </Badge>
                          </div>

                          <p className="text-sm font-medium text-text-primary">{summary}</p>

                          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-xs text-text-secondary">
                            <div className="space-y-0.5">
                              <p className="inline-flex items-center gap-1.5 font-medium text-text-primary">
                                <Users aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>{actorDisplay}</span>
                              </p>
                              <p className="font-mono">{formatDateWIB(log.createdAt)}</p>
                            </div>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye aria-hidden="true" className="h-4 w-4" />
                              <span>Rincian</span>
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </StaggerItem>
                  );
                })}
              </Stagger>

              {hasMore && (
                <div className="flex justify-center pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loadingMore}
                    isLoading={loadingMore}
                    onClick={() => void handleLoadMore()}
                  >
                    Muat 50 catatan lebih lama
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </Section>

      {/* Dialog: Detail Payload Audit */}
      <Dialog
        open={!!selectedLog}
        onOpenChange={(open) => {
          if (!open) setSelectedLog(null);
        }}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {selectedLog
                ? ACTION_LABELS[selectedLog.action] ?? selectedLog.action
                : 'Rincian catatan audit'}
            </DialogTitle>
            <DialogDescription>
              {selectedLog ? `${selectedLog.action} pada ${formatDateWIB(selectedLog.createdAt)}` : ''}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-border-subtle bg-surface-muted p-4 text-xs sm:grid-cols-2">
                <div>
                  <p className="font-semibold text-text-secondary">Pelaku</p>
                  <p className="mt-0.5 text-sm font-semibold text-text-primary">
                    {selectedLog.actorName || selectedLog.actorEmail || 'Sistem'}
                  </p>
                  {selectedLog.actorEmail && (
                    <p className="text-text-secondary">{selectedLog.actorEmail}</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold text-text-secondary">Entitas & ID</p>
                  <p className="mt-0.5 font-mono text-sm font-semibold text-text-primary">
                    {selectedLog.entityType}
                  </p>
                  <p className="break-all font-mono text-text-secondary">
                    {selectedLog.entityId}
                  </p>
                </div>
              </div>

              {selectedLog.oldValue && (
                <div className="space-y-1.5">
                  <p className="text-xs font-medium text-text-muted">
                    Nilai sebelumnya
                  </p>
                  <pre className="max-h-48 overflow-auto rounded-lg border border-border-subtle bg-surface-muted p-3 font-mono text-xs text-text-primary">
                    {formatJsonPreview(selectedLog.oldValue)}
                  </pre>
                </div>
              )}

              <div className="space-y-1.5">
                <p className="text-xs font-medium text-text-muted">
                  Nilai baru / tercatat
                </p>
                <pre className="max-h-56 overflow-auto rounded-lg border border-border-subtle bg-surface-muted p-3 font-mono text-xs text-text-primary">
                  {formatJsonPreview(selectedLog.newValue)}
                </pre>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => setSelectedLog(null)}>
              Tutup
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
