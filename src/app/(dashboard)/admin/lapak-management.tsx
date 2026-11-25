'use client';

import * as React from 'react';
import {
  AlertTriangle,
  Calendar,
  FileText,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
} from 'lucide-react';
import { FilterBar } from '@/components/layout';
import { Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, LapakStatusBadge } from '@/components/ui/badge';
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
import { Textarea } from '@/components/ui/textarea';
import { getBusinessDateString } from '@/lib/business-date';
import { formatRupiah } from '@/lib/utils/currency';
import {
  createLapak,
  deleteLapak,
  updateLapak,
  updateLapakContract,
} from '@/server/actions/admin.actions';
import type { BillingCycle, LapakStatus } from '@/types';
import {
  formatBillingCycleLabel,
  formatShortDateId,
  type LapakItem,
  type WarungItem,
} from './types';

interface LapakManagementProps {
  lapaks: LapakItem[];
  warungs: WarungItem[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onFeedback: (message: string) => void;
  onLapaksChange: React.Dispatch<React.SetStateAction<LapakItem[]>>;
  onAfterMutation?: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}

type StatusFilter = 'ALL' | LapakStatus | 'EXPIRED';

export function LapakManagement({
  lapaks,
  warungs,
  busy,
  onBusyChange,
  onFeedback,
  onLapaksChange,
  onAfterMutation,
  createOpen,
  onCreateOpenChange,
}: LapakManagementProps) {
  const [query, setQuery] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL');

  // Create Lapak dialog state
  const [lapakCode, setLapakCode] = React.useState('');
  const [lapakWarung, setLapakWarung] = React.useState('');
  const [newBillingCycle, setNewBillingCycle] = React.useState<BillingCycle>('BULANAN');
  const [rent, setRent] = React.useState(0);
  const [createError, setCreateError] = React.useState('');

  // Edit Lapak dialog state
  const [editingLapak, setEditingLapak] = React.useState<LapakItem | null>(null);
  const [editLapakCode, setEditLapakCode] = React.useState('');
  const [editLapakWarungId, setEditLapakWarungId] = React.useState('');
  const [editLapakStatus, setEditLapakStatus] = React.useState<LapakStatus>('KOSONG');
  const [editBillingCycle, setEditBillingCycle] = React.useState<BillingCycle>('BULANAN');
  const [editRent, setEditRent] = React.useState(0);
  const [editError, setEditError] = React.useState('');

  // Contract dialog state
  const [contractLapak, setContractLapak] = React.useState<LapakItem | null>(null);
  const [contractStart, setContractStart] = React.useState('');
  const [contractEnd, setContractEnd] = React.useState('');
  const [securityDeposit, setSecurityDeposit] = React.useState(0);
  const [contractNotes, setContractNotes] = React.useState('');
  const [contractError, setContractError] = React.useState('');

  // Delete confirmation dialog state
  const [deletingLapak, setDeletingLapak] = React.useState<LapakItem | null>(null);
  const [deleteError, setDeleteError] = React.useState('');

  const filteredLapaks = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return lapaks.filter((lapak) => {
      if (statusFilter === 'EXPIRED' && !lapak.contractExpired) return false;
      if (statusFilter !== 'ALL' && statusFilter !== 'EXPIRED' && lapak.status !== statusFilter) {
        return false;
      }
      if (!keyword) return true;
      const haystack = `${lapak.code} ${lapak.warungName ?? ''} ${lapak.status} ${lapak.billingCycle}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [lapaks, query, statusFilter]);

  const availableWarungsForNewLapak = React.useMemo(
    () =>
      warungs.filter(
        (warung) =>
          !lapaks.some((item) => item.warungId === warung.id && !item.contractExpired)
      ),
    [warungs, lapaks]
  );

  const availableWarungsForEditLapak = React.useMemo(
    () =>
      warungs.filter(
        (warung) =>
          !lapaks.some(
            (item) =>
              item.warungId === warung.id &&
              item.id !== editingLapak?.id &&
              !item.contractExpired
          )
      ),
    [warungs, lapaks, editingLapak?.id]
  );

  function openCreateDialog() {
    setCreateError('');
    setLapakCode('');
    setLapakWarung('');
    setNewBillingCycle('BULANAN');
    setRent(0);
    onCreateOpenChange(true);
  }

  function openLapakEditor(lapak: LapakItem) {
    setEditError('');
    setEditingLapak(lapak);
    setEditLapakCode(lapak.code);
    setEditLapakWarungId(lapak.warungId ?? '');
    setEditLapakStatus(lapak.status);
    setEditBillingCycle(lapak.billingCycle);
    setEditRent(lapak.baseRentAmount);
  }

  function openContractEditor(lapak: LapakItem) {
    setContractError('');
    setContractLapak(lapak);
    setContractStart(lapak.contractStart ?? '');
    setContractEnd(lapak.contractEnd ?? '');
    setSecurityDeposit(lapak.securityDepositAmount);
    setContractNotes(lapak.contractNotes ?? '');
  }

  async function handleCreateLapak(event: React.FormEvent) {
    event.preventDefault();
    setCreateError('');
    const trimmedCode = lapakCode.trim();
    if (!/^[A-Za-z0-9-]{2,20}$/.test(trimmedCode)) {
      setCreateError('Kode lapak harus 2 sampai 20 karakter (huruf, angka, atau tanda hubung).');
      return;
    }

    onBusyChange(true);
    try {
      const result = await createLapak({
        code: trimmedCode,
        warungId: lapakWarung || null,
        billingCycle: newBillingCycle,
        baseRentAmount: rent,
      });
      const assignedWarung = warungs.find((w) => w.id === result.lapak.warungId);
      const createdLapak: LapakItem = {
        ...result.lapak,
        contractExpired: false,
        warungName: assignedWarung?.name ?? null,
        warungSlug: assignedWarung?.slug ?? null,
      };
      onLapaksChange((current) => [
        ...current.map((lapak) =>
          result.releasedExpiredLapak?.id === lapak.id
            ? {
                ...lapak,
                warungId: null,
                warungName: null,
                warungSlug: null,
                status: 'KOSONG' as const,
                contractStart: null,
                contractEnd: null,
                contractExpired: false,
                securityDepositAmount: 0,
                contractNotes: null,
              }
            : lapak
        ),
        ...(current.some((lapak) => lapak.id === result.lapak.id) ? [] : [createdLapak]),
      ]);
      onFeedback(`Lapak ${createdLapak.code} berhasil dibuat.`);
      onCreateOpenChange(false);
      setLapakCode('');
      setLapakWarung('');
      setRent(0);
      setNewBillingCycle('BULANAN');
      onAfterMutation?.();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Gagal membuat lapak.');
    } finally {
      onBusyChange(false);
    }
  }

  async function handleUpdateLapak(event: React.FormEvent) {
    event.preventDefault();
    if (!editingLapak) return;
    setEditError('');

    const trimmedCode = editLapakCode.trim();
    if (!/^[A-Za-z0-9-]{2,20}$/.test(trimmedCode)) {
      setEditError('Kode lapak harus 2 sampai 20 karakter (huruf, angka, atau tanda hubung).');
      return;
    }

    const selectedWarungId = ['KOSONG', 'PERBAIKAN'].includes(editLapakStatus)
      ? null
      : editLapakWarungId || null;

    if (['TERISI', 'LIBUR'].includes(editLapakStatus) && !selectedWarungId) {
      setEditError('Pilih warung yang menempati untuk status Terisi atau Libur.');
      return;
    }

    onBusyChange(true);
    try {
      const result = await updateLapak({
        lapakId: editingLapak.id,
        code: trimmedCode,
        warungId: selectedWarungId,
        status: editLapakStatus,
        billingCycle: editBillingCycle,
        baseRentAmount: editRent,
      });
      const today = getBusinessDateString();
      const warung = warungs.find((item) => item.id === result.lapak.warungId);
      onLapaksChange((current) =>
        current.map((item) => {
          if (result.releasedExpiredLapak?.id === item.id) {
            return {
              ...item,
              warungId: null,
              warungName: null,
              warungSlug: null,
              status: 'KOSONG',
              contractStart: null,
              contractEnd: null,
              contractExpired: false,
              securityDepositAmount: 0,
              contractNotes: null,
            };
          }
          if (item.id === result.lapak.id) {
            return {
              ...item,
              ...result.lapak,
              contractExpired: Boolean(
                result.lapak.contractEnd && result.lapak.contractEnd < today
              ),
              warungName: warung?.name ?? null,
              warungSlug: warung?.slug ?? null,
            };
          }
          return item;
        })
      );
      onFeedback(`Lapak ${result.lapak.code} dan penempatan warung berhasil diperbarui.`);
      setEditingLapak(null);
      onAfterMutation?.();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Perubahan lapak gagal disimpan.');
    } finally {
      onBusyChange(false);
    }
  }

  async function handleSaveContract(event: React.FormEvent) {
    event.preventDefault();
    if (!contractLapak) return;
    setContractError('');

    if (contractStart && contractEnd && contractEnd < contractStart) {
      setContractError('Tanggal berakhir kontrak harus setelah atau sama dengan tanggal mulai.');
      return;
    }

    onBusyChange(true);
    try {
      await updateLapakContract({
        lapakId: contractLapak.id,
        contractStart: contractStart || null,
        contractEnd: contractEnd || null,
        securityDepositAmount: securityDeposit,
        contractNotes: contractNotes.trim() || null,
      });
      const today = getBusinessDateString();
      const nextEnd = contractEnd || null;
      onLapaksChange((current) =>
        current.map((lapak) =>
          lapak.id === contractLapak.id
            ? {
                ...lapak,
                contractStart: contractStart || null,
                contractEnd: nextEnd,
                contractExpired: Boolean(nextEnd && nextEnd < today),
                securityDepositAmount: securityDeposit,
                contractNotes: contractNotes.trim() || null,
              }
            : lapak
        )
      );
      onFeedback(`Detail kontrak Lapak ${contractLapak.code} berhasil disimpan.`);
      setContractLapak(null);
      onAfterMutation?.();
    } catch (cause) {
      setContractError(cause instanceof Error ? cause.message : 'Detail kontrak gagal disimpan.');
    } finally {
      onBusyChange(false);
    }
  }

  async function handleDeleteLapak() {
    if (!deletingLapak) return;
    setDeleteError('');
    onBusyChange(true);
    try {
      await deleteLapak(deletingLapak.id);
      onLapaksChange((current) => current.filter((item) => item.id !== deletingLapak.id));
      onFeedback(`Lapak ${deletingLapak.code} berhasil dihapus.`);
      setDeletingLapak(null);
      onAfterMutation?.();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Data lapak gagal dihapus.');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-4">
      <FilterBar
        actions={
          <Button type="button" onClick={openCreateDialog} disabled={busy}>
            <Plus aria-hidden="true" className="h-4 w-4" />
            <span>Tambah lapak</span>
          </Button>
        }
      >
        <div className="min-w-0 flex-1 sm:min-w-[220px]">
          <Field label="Cari lapak" htmlFor="lapak-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                id="lapak-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kode lapak atau nama warung"
                className="pl-10"
              />
            </div>
          </Field>
        </div>
        <div className="w-full sm:w-52">
          <Field label="Filter status" htmlFor="lapak-status-filter">
            <Select
              id="lapak-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="ALL">Semua status ({lapaks.length})</option>
              <option value="TERISI">Terisi</option>
              <option value="KOSONG">Kosong</option>
              <option value="LIBUR">Libur sementara</option>
              <option value="PERBAIKAN">Perbaikan</option>
              <option value="EXPIRED">Kontrak habis</option>
            </Select>
          </Field>
        </div>
      </FilterBar>

      {lapaks.length === 0 ? (
        <EmptyState
          icon={Store}
          title="Belum ada data lapak"
          description="Tambahkan unit lapak sentra untuk mulai menempatkan warung dan mengatur tarif sewa."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Tambah lapak pertama</span>
            </Button>
          }
        />
      ) : filteredLapaks.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="Lapak tidak ditemukan"
          description="Tidak ada lapak yang cocok dengan pencarian atau filter status saat ini."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setStatusFilter('ALL');
              }}
            >
              Reset filter
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
                    <TableHead>Lapak</TableHead>
                    <TableHead>Warung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Siklus & Tarif</TableHead>
                    <TableHead>Masa Kontrak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLapaks.map((lapak) => (
                    <TableRow key={lapak.id}>
                      <TableCell>
                        <div className="space-y-1">
                          <span className="font-mono font-bold text-text-primary">
                            Lapak {lapak.code}
                          </span>
                          {lapak.contractExpired && (
                            <div>
                              <Badge variant="warning">
                                <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                                <span>Kontrak habis</span>
                              </Badge>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {lapak.warungName ? (
                          <span className="font-medium text-text-primary">{lapak.warungName}</span>
                        ) : (
                          <span className="text-text-muted">Belum ditempati</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <LapakStatusBadge status={lapak.status} />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-mono font-semibold text-text-primary tabular-nums">
                            {formatRupiah(lapak.baseRentAmount)}
                          </p>
                          <p className="text-xs text-text-secondary">
                            {formatBillingCycleLabel(lapak.billingCycle)} (termasuk utilitas)
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {lapak.contractStart || lapak.contractEnd ? (
                          <div className="space-y-0.5 text-xs text-text-secondary">
                            <p className="font-medium text-text-primary">
                              {formatShortDateId(lapak.contractStart)} sampai{' '}
                              {formatShortDateId(lapak.contractEnd)}
                            </p>
                            {lapak.securityDepositAmount > 0 && (
                              <p className="font-mono tabular-nums">
                                Deposit disepakati: {formatRupiah(lapak.securityDepositAmount)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-text-muted">Belum dicatat</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-2">
                          {lapak.warungId && (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => openContractEditor(lapak)}
                            >
                              <FileText aria-hidden="true" className="h-4 w-4" />
                              <span>Kontrak</span>
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => openLapakEditor(lapak)}
                          >
                            <Pencil aria-hidden="true" className="h-4 w-4" />
                            <span>Edit</span>
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => {
                              setDeleteError('');
                              setDeletingLapak(lapak);
                            }}
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                            <span>Hapus</span>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </div>

          {/* Mobile Card List */}
          <Stagger itemCount={filteredLapaks.length} className="space-y-3 md:hidden">
            {filteredLapaks.map((lapak) => (
              <StaggerItem key={lapak.id}>
                <Card>
                  <CardContent className="space-y-3 pt-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-0.5">
                        <p className="font-mono text-base font-bold text-text-primary">
                          Lapak {lapak.code}
                        </p>
                        <p className="truncate text-sm font-medium text-text-secondary">
                          {lapak.warungName ?? 'Belum ditempati'}
                        </p>
                      </div>
                      <LapakStatusBadge status={lapak.status} />
                    </div>

                    {lapak.contractExpired && (
                      <Badge variant="warning">
                        <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                        <span>Kontrak habis, dapat dialihkan</span>
                      </Badge>
                    )}

                    <div className="space-y-1 rounded-xl border border-border-subtle bg-surface-muted p-3 text-xs text-text-secondary">
                      <div className="flex items-center justify-between gap-2">
                        <span>Tarif ({formatBillingCycleLabel(lapak.billingCycle)})</span>
                        <span className="font-mono text-sm font-bold text-text-primary tabular-nums">
                          {formatRupiah(lapak.baseRentAmount)}
                        </span>
                      </div>
                      {(lapak.contractStart || lapak.contractEnd) && (
                        <div className="flex items-center gap-1.5 pt-1">
                          <Calendar aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {formatShortDateId(lapak.contractStart)} sampai{' '}
                            {formatShortDateId(lapak.contractEnd)}
                          </span>
                        </div>
                      )}
                      {lapak.securityDepositAmount > 0 && (
                        <p className="font-mono tabular-nums">
                          Deposit kesepakatan: {formatRupiah(lapak.securityDepositAmount)}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {lapak.warungId && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => openContractEditor(lapak)}
                          className="flex-1"
                        >
                          <FileText aria-hidden="true" className="h-4 w-4" />
                          <span>Kontrak</span>
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => openLapakEditor(lapak)}
                        className="flex-1"
                      >
                        <Pencil aria-hidden="true" className="h-4 w-4" />
                        <span>Edit</span>
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="danger"
                        disabled={busy}
                        onClick={() => {
                          setDeleteError('');
                          setDeletingLapak(lapak);
                        }}
                      >
                        <Trash2 aria-hidden="true" className="h-4 w-4" />
                        <span>Hapus</span>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </StaggerItem>
            ))}
          </Stagger>
        </>
      )}

      {/* Dialog: Tambah Lapak */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          if (!busy) {
            if (!open) setCreateError('');
            onCreateOpenChange(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah lapak</DialogTitle>
            <DialogDescription>
              Daftarkan unit lapak baru beserta siklus penagihan dan tarif sewa pokok.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateLapak} className="space-y-4">
            {createError && <Alert variant="danger">{createError}</Alert>}
            <Field
              label="Kode lapak"
              htmlFor="lapak-code"
              hint="Contoh: A-01 atau B-12 (2 sampai 20 karakter)"
              required
            >
              <Input
                id="lapak-code"
                required
                minLength={2}
                maxLength={20}
                pattern="[A-Za-z0-9-]+"
                value={lapakCode}
                onChange={(event) => setLapakCode(event.target.value)}
                placeholder="A-01"
              />
            </Field>
            <Field
              label="Tempatkan warung (opsional)"
              htmlFor="lapak-warung"
              hint="Satu warung hanya dapat menempati satu lapak aktif."
            >
              <Select
                id="lapak-warung"
                value={lapakWarung}
                onChange={(event) => setLapakWarung(event.target.value)}
              >
                <option value="">Belum ditempati</option>
                {availableWarungsForNewLapak.map((warung) => (
                  <option key={warung.id} value={warung.id}>
                    {warung.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Siklus tagihan" htmlFor="new-lapak-cycle" required>
              <Select
                id="new-lapak-cycle"
                value={newBillingCycle}
                onChange={(event) => setNewBillingCycle(event.target.value as BillingCycle)}
              >
                <option value="HARIAN">Harian</option>
                <option value="MINGGUAN">Mingguan</option>
                <option value="BULANAN">Bulanan</option>
              </Select>
            </Field>
            <Field
              label="Tarif sewa lapak"
              htmlFor="lapak-rent"
              hint="Tarif sewa sudah mencakup listrik, air, dan kebersihan."
              required
            >
              <RupiahInput
                id="lapak-rent"
                required
                value={rent}
                onValueChange={(value) => setRent(Math.min(999_999_999, value))}
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => onCreateOpenChange(false)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy} isLoading={busy}>
                Simpan lapak
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Lapak */}
      <Dialog
        open={!!editingLapak}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditError('');
            setEditingLapak(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit lapak dan penempatan</DialogTitle>
            <DialogDescription>
              Perbarui kode, status fisik, warung penghuni, dan tarif sewa lapak.
            </DialogDescription>
          </DialogHeader>
          {editingLapak && (
            <form onSubmit={handleUpdateLapak} className="space-y-4">
              {editError && <Alert variant="danger">{editError}</Alert>}
              <Field label="Kode lapak" htmlFor="edit-lapak-code" required>
                <Input
                  id="edit-lapak-code"
                  required
                  minLength={2}
                  maxLength={20}
                  pattern="[A-Za-z0-9-]+"
                  value={editLapakCode}
                  onChange={(event) => setEditLapakCode(event.target.value)}
                />
              </Field>
              <Field label="Status lapak" htmlFor="edit-lapak-status" required>
                <Select
                  id="edit-lapak-status"
                  value={editLapakStatus}
                  onChange={(event) => {
                    const status = event.target.value as LapakStatus;
                    setEditLapakStatus(status);
                    if (status === 'KOSONG' || status === 'PERBAIKAN') {
                      setEditLapakWarungId('');
                    }
                  }}
                >
                  <option value="KOSONG">Kosong</option>
                  <option value="TERISI">Terisi</option>
                  <option value="LIBUR">Libur sementara</option>
                  <option value="PERBAIKAN">Perbaikan</option>
                </Select>
              </Field>
              <Field
                label="Warung yang menempati"
                htmlFor="edit-lapak-warung"
                hint="Warung hanya dapat menempati satu lapak. Status kosong atau perbaikan otomatis melepas penempatan."
                required={editLapakStatus === 'TERISI' || editLapakStatus === 'LIBUR'}
              >
                <Select
                  id="edit-lapak-warung"
                  disabled={editLapakStatus === 'KOSONG' || editLapakStatus === 'PERBAIKAN'}
                  required={editLapakStatus === 'TERISI' || editLapakStatus === 'LIBUR'}
                  value={editLapakWarungId}
                  onChange={(event) => {
                    const nextWarungId = event.target.value;
                    setEditLapakWarungId(nextWarungId);
                    if (
                      nextWarungId &&
                      (editLapakStatus === 'KOSONG' || editLapakStatus === 'PERBAIKAN')
                    ) {
                      setEditLapakStatus('TERISI');
                    }
                  }}
                >
                  <option value="">Belum ditempati</option>
                  {availableWarungsForEditLapak.map((warung) => (
                    <option key={warung.id} value={warung.id}>
                      {warung.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Siklus tagihan" htmlFor="edit-lapak-cycle" required>
                <Select
                  id="edit-lapak-cycle"
                  value={editBillingCycle}
                  onChange={(event) => setEditBillingCycle(event.target.value as BillingCycle)}
                >
                  <option value="HARIAN">Harian</option>
                  <option value="MINGGUAN">Mingguan</option>
                  <option value="BULANAN">Bulanan</option>
                </Select>
              </Field>
              <Field label="Tarif sewa" htmlFor="edit-lapak-rent" required>
                <RupiahInput
                  id="edit-lapak-rent"
                  required
                  value={editRent}
                  onValueChange={(value) => setEditRent(Math.min(999_999_999, value))}
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditingLapak(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={
                    busy ||
                    ((editLapakStatus === 'TERISI' || editLapakStatus === 'LIBUR') &&
                      !editLapakWarungId)
                  }
                  isLoading={busy}
                >
                  Simpan lapak
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Kontrak Lapak */}
      <Dialog
        open={!!contractLapak}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setContractError('');
            setContractLapak(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Detail kontrak {contractLapak ? `Lapak ${contractLapak.code}` : 'lapak'}
            </DialogTitle>
            <DialogDescription>
              {contractLapak?.warungName
                ? `Warung penghuni: ${contractLapak.warungName}`
                : 'Catat masa berlaku sewa dan deposit yang disepakati.'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveContract} className="space-y-4">
            {contractError && <Alert variant="danger">{contractError}</Alert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Tanggal mulai" htmlFor="contract-start">
                <Input
                  id="contract-start"
                  type="date"
                  value={contractStart}
                  onChange={(event) => setContractStart(event.target.value)}
                />
              </Field>
              <Field label="Tanggal berakhir" htmlFor="contract-end">
                <Input
                  id="contract-end"
                  type="date"
                  value={contractEnd}
                  onChange={(event) => setContractEnd(event.target.value)}
                />
              </Field>
            </div>
            <Field
              label="Deposit yang disepakati"
              htmlFor="contract-deposit"
              hint="Nilai ini hanya mencatat kesepakatan kontrak; pembayaran tetap dicatat pada buku tagihan dan deposit."
            >
              <RupiahInput
                id="contract-deposit"
                value={securityDeposit}
                onValueChange={(value) => setSecurityDeposit(Math.min(999_999_999, value))}
              />
            </Field>
            <Field label="Catatan kontrak (opsional)" htmlFor="contract-notes">
              <Textarea
                id="contract-notes"
                maxLength={1000}
                value={contractNotes}
                onChange={(event) => setContractNotes(event.target.value)}
                placeholder="Ketentuan khusus masa sewa atau kesepakatan tambahan"
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setContractLapak(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={busy} isLoading={busy}>
                Simpan detail
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Hapus Lapak */}
      <Dialog
        open={!!deletingLapak}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteError('');
            setDeletingLapak(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Hapus Lapak {deletingLapak?.code}?</DialogTitle>
            <DialogDescription>
              Lapak akan dihapus permanen jika sudah tidak ditempati dan belum memiliki riwayat
              tagihan maupun tiket kendala.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setDeletingLapak(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleDeleteLapak()}
            >
              Hapus lapak
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
