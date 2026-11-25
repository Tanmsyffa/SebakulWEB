'use client';

import * as React from 'react';
import { ArrowRightLeft, Pencil, Plus, Search, Store, Trash2, Utensils } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
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
import { formatRupiah } from '@/lib/utils/currency';
import { createWarung, deleteWarung, updateWarung } from '@/server/actions/admin.actions';
import { suggestSlug, type LapakItem, type WarungItem } from './types';

interface WarungManagementProps {
  warungs: WarungItem[];
  lapaks: LapakItem[];
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onFeedback: (message: string) => void;
  onWarungsChange: React.Dispatch<React.SetStateAction<WarungItem[]>>;
  onLapaksChange: React.Dispatch<React.SetStateAction<LapakItem[]>>;
  onAfterMutation?: () => void;
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
  onOpenTransfer: () => void;
}

export function WarungManagement({
  warungs,
  lapaks,
  busy,
  onBusyChange,
  onFeedback,
  onWarungsChange,
  onLapaksChange,
  onAfterMutation,
  createOpen,
  onCreateOpenChange,
  onOpenTransfer,
}: WarungManagementProps) {
  const [query, setQuery] = React.useState('');

  // Create Warung dialog state
  const [warungName, setWarungName] = React.useState('');
  const [slug, setSlug] = React.useState('');
  const [slugTouched, setSlugTouched] = React.useState(false);
  const [category, setCategory] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [newWarungLapakId, setNewWarungLapakId] = React.useState('');
  const [createError, setCreateError] = React.useState('');

  // Edit Warung dialog state
  const [editingWarung, setEditingWarung] = React.useState<WarungItem | null>(null);
  const [editWarungName, setEditWarungName] = React.useState('');
  const [editWarungSlug, setEditWarungSlug] = React.useState('');
  const [editWarungCategory, setEditWarungCategory] = React.useState('');
  const [editWarungDescription, setEditWarungDescription] = React.useState('');
  const [editWarungLapakId, setEditWarungLapakId] = React.useState('');
  const [editError, setEditError] = React.useState('');

  // Delete Warung confirmation state
  const [deletingWarung, setDeletingWarung] = React.useState<WarungItem | null>(null);
  const [deleteError, setDeleteError] = React.useState('');

  const lapakByWarungId = React.useMemo(() => {
    const map = new Map<string, LapakItem>();
    for (const lapak of lapaks) {
      if (lapak.warungId) map.set(lapak.warungId, lapak);
    }
    return map;
  }, [lapaks]);

  const filteredWarungs = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return warungs;
    return warungs.filter((warung) => {
      const lapak = lapakByWarungId.get(warung.id);
      const haystack = `${warung.name} ${warung.slug} ${warung.category} ${lapak?.code ?? ''}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [warungs, query, lapakByWarungId]);

  const availableLapaksForNewWarung = React.useMemo(
    () =>
      lapaks.filter(
        (lapak) =>
          lapak.status !== 'PERBAIKAN' &&
          ((!lapak.warungId && lapak.status === 'KOSONG') || lapak.contractExpired)
      ),
    [lapaks]
  );

  const availableLapaksForEditWarung = React.useMemo(
    () =>
      lapaks.filter(
        (lapak) =>
          lapak.status !== 'PERBAIKAN' &&
          (!lapak.warungId || lapak.warungId === editingWarung?.id || lapak.contractExpired)
      ),
    [lapaks, editingWarung?.id]
  );

  function openCreateDialog() {
    setCreateError('');
    setWarungName('');
    setSlug('');
    setSlugTouched(false);
    setCategory('');
    setDescription('');
    setNewWarungLapakId('');
    onCreateOpenChange(true);
  }

  function openWarungEditor(warung: WarungItem) {
    setEditError('');
    setEditingWarung(warung);
    setEditWarungName(warung.name);
    setEditWarungSlug(warung.slug);
    setEditWarungCategory(warung.category);
    setEditWarungDescription(warung.description ?? '');
    setEditWarungLapakId(lapaks.find((lapak) => lapak.warungId === warung.id)?.id ?? '');
  }

  async function handleCreateWarung(event: React.FormEvent) {
    event.preventDefault();
    setCreateError('');
    const trimmedSlug = slug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setCreateError('Kode unik warung hanya boleh huruf kecil, angka, dan tanda hubung.');
      return;
    }

    onBusyChange(true);
    try {
      const result = await createWarung({
        name: warungName,
        slug: trimmedSlug,
        category,
        description: description.trim() || null,
        lapakId: newWarungLapakId || null,
      });
      onWarungsChange((current) =>
        current.some((warung) => warung.id === result.warung.id)
          ? current
          : [...current, result.warung]
      );
      if (result.lapak) {
        onLapaksChange((current) =>
          current.map((lapak) =>
            lapak.id === result.lapak!.id
              ? {
                  ...lapak,
                  ...result.lapak!,
                  contractExpired: false,
                  warungName: result.warung.name,
                  warungSlug: result.warung.slug,
                }
              : lapak
          )
        );
      }
      onFeedback(
        result.lapak
          ? `Warung ${result.warung.name} berhasil dibuat dan ditempatkan pada lapak.`
          : `Warung ${result.warung.name} berhasil dibuat.`
      );
      onCreateOpenChange(false);
      setWarungName('');
      setSlug('');
      setSlugTouched(false);
      setCategory('');
      setDescription('');
      setNewWarungLapakId('');
      onAfterMutation?.();
    } catch (cause) {
      setCreateError(cause instanceof Error ? cause.message : 'Gagal membuat warung.');
    } finally {
      onBusyChange(false);
    }
  }

  async function handleUpdateWarung(event: React.FormEvent) {
    event.preventDefault();
    if (!editingWarung) return;
    setEditError('');

    const trimmedSlug = editWarungSlug.trim();
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmedSlug)) {
      setEditError('Kode unik warung hanya boleh huruf kecil, angka, dan tanda hubung.');
      return;
    }

    onBusyChange(true);
    try {
      const result = await updateWarung({
        warungId: editingWarung.id,
        lapakId: editWarungLapakId || null,
        name: editWarungName,
        slug: trimmedSlug,
        category: editWarungCategory,
        description: editWarungDescription.trim() || null,
      });
      onWarungsChange((current) =>
        current.map((item) =>
          item.id === result.warung.id ? { ...item, ...result.warung } : item
        )
      );
      if (result.lapakChanges.length) {
        onLapaksChange((current) =>
          current.map((lapak) => {
            const change = result.lapakChanges.find((item) => item.id === lapak.id);
            if (!change) return lapak;
            const assigned = change.warungId ? result.warung : null;
            return {
              ...lapak,
              warungId: change.warungId,
              status: change.status,
              contractStart: null,
              contractEnd: null,
              contractExpired: false,
              securityDepositAmount: 0,
              contractNotes: null,
              warungName: assigned?.name ?? null,
              warungSlug: assigned?.slug ?? null,
            };
          })
        );
      } else {
        onLapaksChange((current) =>
          current.map((lapak) =>
            lapak.warungId === result.warung.id
              ? { ...lapak, warungName: result.warung.name, warungSlug: result.warung.slug }
              : lapak
          )
        );
      }
      onFeedback(`Data warung ${result.warung.name} berhasil diperbarui.`);
      setEditingWarung(null);
      onAfterMutation?.();
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : 'Perubahan warung gagal disimpan.');
    } finally {
      onBusyChange(false);
    }
  }

  async function handleDeleteWarung() {
    if (!deletingWarung) return;
    setDeleteError('');
    onBusyChange(true);
    try {
      await deleteWarung(deletingWarung.id);
      onWarungsChange((current) => current.filter((item) => item.id !== deletingWarung.id));
      onFeedback(`Warung ${deletingWarung.name} berhasil dihapus.`);
      setDeletingWarung(null);
      onAfterMutation?.();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Data warung gagal dihapus.');
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <div className="space-y-4">
      <FilterBar
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={onOpenTransfer}
              disabled={busy || warungs.length === 0}
            >
              <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
              <span>Transfer warung</span>
            </Button>
            <Button type="button" onClick={openCreateDialog} disabled={busy}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Tambah warung</span>
            </Button>
          </>
        }
      >
        <div className="min-w-0 flex-1 sm:min-w-[240px]">
          <Field label="Cari warung" htmlFor="warung-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                id="warung-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama warung, kategori, atau kode lapak"
                className="pl-10"
              />
            </div>
          </Field>
        </div>
      </FilterBar>

      {warungs.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title="Belum ada warung terdaftar"
          description="Tambahkan warung kuliner untuk mulai menautkan lapak dan akun penyewa."
          action={
            <Button type="button" onClick={openCreateDialog}>
              <Plus aria-hidden="true" className="h-4 w-4" />
              <span>Tambah warung pertama</span>
            </Button>
          }
        />
      ) : filteredWarungs.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="Warung tidak ditemukan"
          description="Tidak ada warung yang cocok dengan kata kunci pencarian."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={() => setQuery('')}>
              Reset pencarian
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
                    <TableHead>Warung</TableHead>
                    <TableHead>Kode Unik</TableHead>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Penempatan Lapak</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredWarungs.map((warung) => {
                    const lapak = lapakByWarungId.get(warung.id);
                    return (
                      <TableRow key={warung.id}>
                        <TableCell>
                          <div className="max-w-xs space-y-0.5">
                            <p className="font-semibold text-text-primary">{warung.name}</p>
                            {warung.description && (
                              <p className="truncate text-xs text-text-secondary">
                                {warung.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="rounded-lg border border-border-subtle bg-surface-muted px-2 py-1 font-mono text-xs text-text-primary">
                            {warung.slug}
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge variant="neutral">{warung.category}</Badge>
                        </TableCell>
                        <TableCell>
                          {lapak ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono font-semibold text-text-primary">
                                Lapak {lapak.code}
                              </span>
                              <LapakStatusBadge status={lapak.status} />
                              <span className="font-mono text-xs text-text-secondary tabular-nums">
                                ({formatRupiah(lapak.baseRentAmount)})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-text-muted">Belum memiliki lapak</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => openWarungEditor(warung)}
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
                                setDeletingWarung(warung);
                              }}
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                              <span>Hapus</span>
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

          {/* Mobile Card List */}
          <Stagger itemCount={filteredWarungs.length} className="space-y-3 md:hidden">
            {filteredWarungs.map((warung) => {
              const lapak = lapakByWarungId.get(warung.id);
              return (
                <StaggerItem key={warung.id}>
                  <Card>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-1">
                          <p className="text-base font-bold text-text-primary">{warung.name}</p>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="neutral">{warung.category}</Badge>
                            <code className="font-mono text-xs text-text-secondary">
                              {warung.slug}
                            </code>
                          </div>
                        </div>
                      </div>

                      {warung.description && (
                        <p className="text-xs leading-relaxed text-text-secondary">
                          {warung.description}
                        </p>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border-subtle bg-surface-muted p-3 text-xs">
                        {lapak ? (
                          <>
                            <span className="inline-flex items-center gap-1.5 font-mono font-semibold text-text-primary">
                              <Store aria-hidden="true" className="h-3.5 w-3.5 text-brand-primary" />
                              Lapak {lapak.code}
                            </span>
                            <span className="font-mono text-text-secondary tabular-nums">
                              Sewa {formatRupiah(lapak.baseRentAmount)}
                            </span>
                          </>
                        ) : (
                          <span className="text-text-muted">Belum memiliki lapak</span>
                        )}
                      </div>

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => openWarungEditor(warung)}
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
                            setDeletingWarung(warung);
                          }}
                        >
                          <Trash2 aria-hidden="true" className="h-4 w-4" />
                          <span>Hapus</span>
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}

      {/* Dialog: Tambah Warung */}
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
            <DialogTitle>Tambah warung</DialogTitle>
            <DialogDescription>
              Buat profil warung baru dan tempatkan pada lapak yang tersedia jika sudah siap.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateWarung} className="space-y-4">
            {createError && <Alert variant="danger">{createError}</Alert>}
            <Field label="Nama warung" htmlFor="warung-name" required>
              <Input
                id="warung-name"
                required
                minLength={2}
                maxLength={100}
                value={warungName}
                onChange={(event) => {
                  const nextName = event.target.value;
                  setWarungName(nextName);
                  if (!slugTouched) setSlug(suggestSlug(nextName));
                }}
                placeholder="Contoh: Soto Ayam Bu Tini"
              />
            </Field>
            <Field
              label="Kode unik warung"
              htmlFor="warung-slug"
              hint="Hanya huruf kecil, angka, dan tanda hubung (pengenal internal)."
              required
            >
              <Input
                id="warung-slug"
                required
                maxLength={80}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  setSlug(event.target.value.toLowerCase());
                }}
                placeholder="soto-ayam-bu-tini"
                className="font-mono"
              />
            </Field>
            <Field label="Kategori" htmlFor="warung-category" required>
              <Input
                id="warung-category"
                required
                minLength={2}
                maxLength={60}
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Makanan Berat, Minuman, atau Camilan"
              />
            </Field>
            <Field label="Penempatan lapak (opsional)" htmlFor="new-warung-lapak">
              <Select
                id="new-warung-lapak"
                value={newWarungLapakId}
                onChange={(event) => setNewWarungLapakId(event.target.value)}
              >
                <option value="">Belum ditempatkan</option>
                {availableLapaksForNewWarung.map((lapak) => (
                  <option key={lapak.id} value={lapak.id}>
                    Lapak {lapak.code} ({formatRupiah(lapak.baseRentAmount)})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Deskripsi (opsional)" htmlFor="warung-description">
              <Textarea
                id="warung-description"
                maxLength={500}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Ringkasan menu atau catatan warung"
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
                Simpan warung
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Edit Warung */}
      <Dialog
        open={!!editingWarung}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditError('');
            setEditingWarung(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit data warung</DialogTitle>
            <DialogDescription>
              Perbarui identitas warung atau ubah penempatan lapaknya.
            </DialogDescription>
          </DialogHeader>
          {editingWarung && (
            <form onSubmit={handleUpdateWarung} className="space-y-4">
              {editError && <Alert variant="danger">{editError}</Alert>}
              <Field label="Nama warung" htmlFor="edit-warung-name" required>
                <Input
                  id="edit-warung-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={editWarungName}
                  onChange={(event) => setEditWarungName(event.target.value)}
                />
              </Field>
              <Field
                label="Kode unik warung (internal)"
                htmlFor="edit-warung-slug"
                hint="Hanya huruf kecil, angka, dan tanda hubung."
                required
              >
                <Input
                  id="edit-warung-slug"
                  required
                  maxLength={80}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  value={editWarungSlug}
                  onChange={(event) => setEditWarungSlug(event.target.value.toLowerCase())}
                  className="font-mono"
                />
              </Field>
              <Field label="Kategori" htmlFor="edit-warung-category" required>
                <Input
                  id="edit-warung-category"
                  required
                  minLength={2}
                  maxLength={60}
                  value={editWarungCategory}
                  onChange={(event) => setEditWarungCategory(event.target.value)}
                />
              </Field>
              <Field
                label="Penempatan lapak"
                htmlFor="edit-warung-lapak"
                hint="Jika lapak dipindahkan, lapak sebelumnya otomatis ditandai kosong."
              >
                <Select
                  id="edit-warung-lapak"
                  value={editWarungLapakId}
                  onChange={(event) => setEditWarungLapakId(event.target.value)}
                >
                  <option value="">Belum ditempatkan</option>
                  {availableLapaksForEditWarung.map((lapak) => (
                    <option key={lapak.id} value={lapak.id}>
                      Lapak {lapak.code} ({formatRupiah(lapak.baseRentAmount)})
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Deskripsi (opsional)" htmlFor="edit-warung-description">
                <Textarea
                  id="edit-warung-description"
                  maxLength={500}
                  value={editWarungDescription}
                  onChange={(event) => setEditWarungDescription(event.target.value)}
                />
              </Field>
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditingWarung(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={busy} isLoading={busy}>
                  Simpan perubahan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Hapus Warung */}
      <Dialog
        open={!!deletingWarung}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteError('');
            setDeletingWarung(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Hapus {deletingWarung?.name}?</DialogTitle>
            <DialogDescription>
              Warung akan dihapus permanen jika belum terhubung ke akun, lapak, atau riwayat
              transaksi maupun tagihan.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setDeletingWarung(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleDeleteWarung()}
            >
              Hapus warung
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
