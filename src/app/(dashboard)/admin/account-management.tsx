'use client';

import * as React from 'react';
import {
  Ban,
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  Pencil,
  Power,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { FilterBar } from '@/components/layout';
import { Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { UserAvatar } from '@/components/ui/avatar';
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
import {
  deleteAccount,
  resetAccountPassword,
  setAccountActive,
  updateAccount,
} from '@/server/actions/admin.actions';
import {
  formatAccountRoleLabel,
  type AccountRole,
  type EditableAccountRole,
  type ManagedAccount,
  type TemporaryCredential,
  type WarungItem,
} from './types';

type WarungOption = Pick<WarungItem, 'id' | 'name' | 'slug'>;
type RoleFilter = 'ALL' | AccountRole;
type ActiveFilter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const isDeleted = (account: ManagedAccount) =>
  account.email.endsWith('@deleted.sebakul.invalid');

interface AccountManagementProps {
  accounts: ManagedAccount[];
  warungs: WarungOption[];
  busy?: boolean;
  onBusyChange?: (busy: boolean) => void;
  onFeedback?: (message: string) => void;
  onCredential?: (credential: TemporaryCredential) => void;
  onAccountsChange?: React.Dispatch<React.SetStateAction<ManagedAccount[]>>;
  onAfterMutation?: () => void;
  onOpenRegister?: () => void;
}

export function AccountManagement({
  accounts,
  warungs,
  busy: controlledBusy,
  onBusyChange,
  onFeedback,
  onCredential,
  onAccountsChange,
  onAfterMutation,
  onOpenRegister,
}: AccountManagementProps) {
  const [internalRows, setInternalRows] = React.useState(accounts);
  const rows = onAccountsChange ? accounts : internalRows;
  const setRows = onAccountsChange ?? setInternalRows;

  React.useEffect(() => {
    if (!onAccountsChange) setInternalRows(accounts);
  }, [accounts, onAccountsChange]);

  const [internalBusy, setInternalBusy] = React.useState(false);
  const busy = controlledBusy ?? internalBusy;
  const setBusy = onBusyChange ?? setInternalBusy;

  const [localFeedback, setLocalFeedback] = React.useState('');
  const [localCredential, setLocalCredential] = React.useState<TemporaryCredential | null>(null);
  const [copiedLocal, setCopiedLocal] = React.useState(false);

  const [query, setQuery] = React.useState('');
  const [roleFilter, setRoleFilter] = React.useState<RoleFilter>('ALL');
  const [statusFilter, setStatusFilter] = React.useState<ActiveFilter>('ALL');

  // Edit dialog state
  const [editing, setEditing] = React.useState<ManagedAccount | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editEmail, setEditEmail] = React.useState('');
  const [editPhone, setEditPhone] = React.useState('');
  const [editRole, setEditRole] = React.useState<EditableAccountRole>('TENANT_MEMBER');
  const [editWarungId, setEditWarungId] = React.useState('');
  const [editError, setEditError] = React.useState('');

  // Confirm dialogs state
  const [resetTarget, setResetTarget] = React.useState<ManagedAccount | null>(null);
  const [resetError, setResetError] = React.useState('');
  const [toggleTarget, setToggleTarget] = React.useState<ManagedAccount | null>(null);
  const [toggleError, setToggleError] = React.useState('');
  const [deleting, setDeleting] = React.useState<ManagedAccount | null>(null);
  const [deleteError, setDeleteError] = React.useState('');

  const warungNameMap = React.useMemo(
    () => new Map(warungs.map((w) => [w.id, w.name])),
    [warungs]
  );

  const activeRows = React.useMemo(
    () => rows.filter((account) => !isDeleted(account)),
    [rows]
  );

  const filteredRows = React.useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return activeRows.filter((account) => {
      if (roleFilter !== 'ALL' && account.role !== roleFilter) return false;
      if (statusFilter === 'ACTIVE' && !account.isActive) return false;
      if (statusFilter === 'INACTIVE' && account.isActive) return false;
      if (!keyword) return true;
      const warungName = account.warungId ? warungNameMap.get(account.warungId) ?? '' : '';
      const roleLabel = formatAccountRoleLabel(account.role);
      const haystack = `${account.fullName} ${account.email} ${account.phoneNumber ?? ''} ${account.role} ${roleLabel} ${warungName}`.toLowerCase();
      return haystack.includes(keyword);
    });
  }, [activeRows, roleFilter, statusFilter, query, warungNameMap]);

  function notifySuccess(message: string) {
    if (onFeedback) onFeedback(message);
    else setLocalFeedback(message);
  }

  function openEditor(account: ManagedAccount) {
    setEditError('');
    setEditing(account);
    setEditName(account.fullName);
    setEditEmail(account.email);
    setEditPhone(account.phoneNumber ?? '');
    setEditRole(account.role === 'PENGELOLA_ADMIN' ? 'PENGELOLA_ADMIN' : 'TENANT_MEMBER');
    setEditWarungId(account.warungId ?? warungs[0]?.id ?? '');
  }

  async function handleUpdate(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditError('');
    setBusy(true);
    try {
      const nextWarungId = editRole === 'PENGELOLA_ADMIN' ? null : editWarungId || null;
      await updateAccount({
        userId: editing.id,
        roleId: editing.roleId,
        email: editEmail,
        fullName: editName,
        phoneNumber: editPhone || null,
        role: editRole,
        warungId: nextWarungId,
      });
      setRows((current) =>
        current.map((account) =>
          account.id !== editing.id
            ? account
            : {
                ...account,
                email: editEmail.trim().toLowerCase(),
                fullName: editName.trim(),
                phoneNumber: editPhone.trim() || null,
                ...(account.roleId === editing.roleId && account.role !== 'SUPER_ADMIN'
                  ? { role: editRole, warungId: nextWarungId }
                  : {}),
              }
        )
      );
      notifySuccess(`Data akun ${editName.trim()} berhasil diperbarui.`);
      setEditing(null);
      onAfterMutation?.();
    } catch (cause) {
      setEditError(
        cause instanceof Error ? cause.message : 'Perubahan akun gagal disimpan.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmReset() {
    if (!resetTarget) return;
    setResetError('');
    setBusy(true);
    try {
      const result = await resetAccountPassword(resetTarget.id);
      const credential = { email: result.email, password: result.temporaryPassword };
      if (onCredential) {
        onCredential(credential);
      } else {
        setCopiedLocal(false);
        setLocalCredential(credential);
      }
      notifySuccess(
        `Kata sandi sementara untuk ${result.email} telah dibuat dan hanya tampil satu kali.`
      );
      setResetTarget(null);
    } catch (cause) {
      setResetError(cause instanceof Error ? cause.message : 'Reset kata sandi gagal.');
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirmActiveToggle() {
    if (!toggleTarget) return;
    const nextActive = !toggleTarget.isActive;
    setToggleError('');
    setBusy(true);
    try {
      await setAccountActive(toggleTarget.id, nextActive);
      setRows((current) =>
        current.map((item) =>
          item.id === toggleTarget.id ? { ...item, isActive: nextActive } : item
        )
      );
      notifySuccess(
        nextActive
          ? `Akun ${toggleTarget.fullName} diaktifkan kembali.`
          : `Akun ${toggleTarget.fullName} dinonaktifkan dan sesi login diblokir.`
      );
      setToggleTarget(null);
      onAfterMutation?.();
    } catch (cause) {
      setToggleError(
        cause instanceof Error ? cause.message : 'Status akun gagal diperbarui.'
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    setDeleteError('');
    setBusy(true);
    try {
      await deleteAccount(deleting.id);
      setRows((current) => current.filter((account) => account.id !== deleting.id));
      notifySuccess(
        'Akses akun dihapus. Riwayat transaksi dan audit tetap disimpan dengan identitas yang disamarkan.'
      );
      setDeleting(null);
      onAfterMutation?.();
    } catch (cause) {
      if (
        cause instanceof Error &&
        (cause.message.includes('data dipseudonimkan') ||
          cause.message.includes('Akun sudah dinonaktifkan'))
      ) {
        setRows((current) => current.filter((account) => account.id !== deleting.id));
        setDeleting(null);
        notifySuccess(cause.message);
      } else {
        setDeleteError(cause instanceof Error ? cause.message : 'Penghapusan akun gagal.');
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyLocalPassword() {
    if (!localCredential) return;
    try {
      await navigator.clipboard.writeText(localCredential.password);
      setCopiedLocal(true);
      window.setTimeout(() => setCopiedLocal(false), 2000);
    } catch {
      // Clipboard may be blocked; text remains selectable in code block
    }
  }

  return (
    <div className="space-y-4">
      {!onFeedback && localFeedback && (
        <Alert variant="info">{localFeedback}</Alert>
      )}

      {!onCredential && localCredential && (
        <Alert
          variant="warning"
          title={`Kata sandi sementara untuk ${localCredential.email}`}
          action={
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => void handleCopyLocalPassword()}
              >
                {copiedLocal ? (
                  <Check aria-hidden="true" className="h-4 w-4 text-status-success" />
                ) : (
                  <Copy aria-hidden="true" className="h-4 w-4" />
                )}
                <span>{copiedLocal ? 'Tersalin' : 'Salin sandi'}</span>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={() => setLocalCredential(null)}
              >
                Tutup
              </Button>
            </div>
          }
        >
          <p>Tampil satu kali. Salin dan bagikan lewat saluran pribadi.</p>
          <code className="mt-2 block break-all rounded-xl border border-border-subtle bg-surface p-3 font-mono text-sm text-text-primary select-all">
            {localCredential.password}
          </code>
        </Alert>
      )}

      <FilterBar
        actions={
          onOpenRegister ? (
            <Button type="button" onClick={onOpenRegister} disabled={busy}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              <span>Daftarkan akun</span>
            </Button>
          ) : undefined
        }
      >
        <div className="min-w-0 flex-1 sm:min-w-[220px]">
          <Field label="Cari akun" htmlFor="account-search">
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
              />
              <Input
                id="account-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nama, email, peran, atau warung"
                className="pl-10"
              />
            </div>
          </Field>
        </div>
        <div className="w-full sm:w-48">
          <Field label="Peran" htmlFor="account-role-filter">
            <Select
              id="account-role-filter"
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
            >
              <option value="ALL">Semua peran ({activeRows.length})</option>
              <option value="TENANT_MEMBER">Penyewa lapak</option>
              <option value="PENGELOLA_ADMIN">Pengelola sentra</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </Select>
          </Field>
        </div>
        <div className="w-full sm:w-40">
          <Field label="Status" htmlFor="account-status-filter">
            <Select
              id="account-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as ActiveFilter)}
            >
              <option value="ALL">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="INACTIVE">Nonaktif</option>
            </Select>
          </Field>
        </div>
      </FilterBar>

      {activeRows.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Belum ada akun tersimpan"
          description="Daftarkan akun pengelola sentra atau penyewa lapak untuk memberi akses masuk."
          action={
            onOpenRegister ? (
              <Button type="button" onClick={onOpenRegister}>
                <UserPlus aria-hidden="true" className="h-4 w-4" />
                <span>Daftarkan akun pertama</span>
              </Button>
            ) : undefined
          }
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          compact
          icon={Search}
          title="Akun tidak ditemukan"
          description="Tidak ada akun yang sesuai dengan pencarian atau filter peran saat ini."
          action={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setQuery('');
                setRoleFilter('ALL');
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
                    <TableHead>Nama & Kontak</TableHead>
                    <TableHead>Email Login</TableHead>
                    <TableHead>Peran & Warung</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((account) => {
                    const roleLabel = formatAccountRoleLabel(account.role);
                    const warungName = account.warungId
                      ? warungNameMap.get(account.warungId)
                      : undefined;
                    return (
                      <TableRow key={account.roleId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <UserAvatar name={account.fullName} size="sm" />
                            <div className="min-w-0 space-y-0.5">
                              <p className="font-semibold text-text-primary">{account.fullName}</p>
                              {account.phoneNumber && (
                                <p className="font-mono text-xs text-text-secondary">
                                  {account.phoneNumber}
                                </p>
                              )}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="break-all text-sm text-text-secondary">
                            {account.email}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="space-y-1">
                            <Badge
                              variant={
                                account.role === 'SUPER_ADMIN'
                                  ? 'brand'
                                  : account.role === 'PENGELOLA_ADMIN'
                                  ? 'info'
                                  : 'neutral'
                              }
                            >
                              {account.role === 'SUPER_ADMIN' && (
                                <ShieldCheck aria-hidden="true" className="h-3.5 w-3.5" />
                              )}
                              <span>{roleLabel}</span>
                            </Badge>
                            {warungName && (
                              <p className="text-xs font-medium text-text-secondary">
                                {warungName}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {account.isActive ? (
                            <Badge variant="success">
                              <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Aktif</span>
                            </Badge>
                          ) : (
                            <Badge variant="warning">
                              <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                              <span>Nonaktif</span>
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex flex-wrap items-center justify-end gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => openEditor(account)}
                            >
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                              <span>Edit</span>
                            </Button>
                            {account.role !== 'SUPER_ADMIN' && (
                              <>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setResetError('');
                                    setResetTarget(account);
                                  }}
                                >
                                  <KeyRound aria-hidden="true" className="h-4 w-4" />
                                  <span>Reset sandi</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="secondary"
                                  disabled={busy}
                                  onClick={() => {
                                    setToggleError('');
                                    setToggleTarget(account);
                                  }}
                                >
                                  <Power aria-hidden="true" className="h-4 w-4" />
                                  <span>{account.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  disabled={busy}
                                  onClick={() => {
                                    setDeleteError('');
                                    setDeleting(account);
                                  }}
                                >
                                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                                  <span>Hapus</span>
                                </Button>
                              </>
                            )}
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
          <Stagger itemCount={filteredRows.length} className="space-y-3 md:hidden">
            {filteredRows.map((account) => {
              const roleLabel = formatAccountRoleLabel(account.role);
              const warungName = account.warungId
                ? warungNameMap.get(account.warungId)
                : undefined;
              return (
                <StaggerItem key={account.roleId}>
                  <Card>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <p className="truncate text-base font-bold text-text-primary">
                            {account.fullName}
                          </p>
                          <p className="break-all text-xs text-text-secondary">{account.email}</p>
                          {account.phoneNumber && (
                            <p className="font-mono text-xs text-text-secondary">
                              {account.phoneNumber}
                            </p>
                          )}
                        </div>
                        {account.isActive ? (
                          <Badge variant="success">
                            <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                            <span>Aktif</span>
                          </Badge>
                        ) : (
                          <Badge variant="warning">
                            <Ban aria-hidden="true" className="h-3.5 w-3.5" />
                            <span>Nonaktif</span>
                          </Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
                        <Badge
                          variant={
                            account.role === 'SUPER_ADMIN'
                              ? 'brand'
                              : account.role === 'PENGELOLA_ADMIN'
                              ? 'info'
                              : 'neutral'
                          }
                        >
                          <span>{roleLabel}</span>
                        </Badge>
                        {warungName && <span className="font-medium">{warungName}</span>}
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={busy}
                          onClick={() => openEditor(account)}
                        >
                          <Pencil aria-hidden="true" className="h-4 w-4" />
                          <span>Edit</span>
                        </Button>
                        {account.role !== 'SUPER_ADMIN' && (
                          <>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setResetError('');
                                setResetTarget(account);
                              }}
                            >
                              <KeyRound aria-hidden="true" className="h-4 w-4" />
                              <span>Reset sandi</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={busy}
                              onClick={() => {
                                setToggleError('');
                                setToggleTarget(account);
                              }}
                            >
                              <Power aria-hidden="true" className="h-4 w-4" />
                              <span>{account.isActive ? 'Nonaktifkan' : 'Aktifkan'}</span>
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="danger"
                              disabled={busy}
                              onClick={() => {
                                setDeleteError('');
                                setDeleting(account);
                              }}
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                              <span>Hapus</span>
                            </Button>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </StaggerItem>
              );
            })}
          </Stagger>
        </>
      )}

      {/* Dialog: Edit Akun */}
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setEditError('');
            setEditing(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit akun</DialogTitle>
            <DialogDescription>
              Perbarui identitas pengguna dan penugasan peran pada sistem.
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleUpdate} className="space-y-4">
              {editError && <Alert variant="danger">{editError}</Alert>}
              <Field label="Nama lengkap" htmlFor="edit-account-name" required>
                <Input
                  id="edit-account-name"
                  required
                  minLength={2}
                  maxLength={100}
                  value={editName}
                  onChange={(event) => setEditName(event.target.value)}
                />
              </Field>
              <Field
                label="Email login"
                htmlFor="edit-account-email"
                hint="Perubahan email diterapkan langsung pada akun login."
                required
              >
                <Input
                  id="edit-account-email"
                  type="email"
                  required
                  value={editEmail}
                  onChange={(event) => setEditEmail(event.target.value)}
                />
              </Field>
              <Field label="Nomor telepon (opsional)" htmlFor="edit-account-phone">
                <Input
                  id="edit-account-phone"
                  type="tel"
                  maxLength={30}
                  value={editPhone}
                  onChange={(event) => setEditPhone(event.target.value)}
                  placeholder="081234567890"
                />
              </Field>
              {editing.role === 'SUPER_ADMIN' ? (
                <Alert variant="neutral">
                  Peran Super Admin dilindungi dan tidak dapat diubah dari halaman ini.
                </Alert>
              ) : (
                <>
                  <Field
                    label="Peran pada akun ini"
                    htmlFor="edit-account-role"
                    hint="Perubahan peran hanya mengganti penugasan yang dipilih. Peran akun lain tetap ada."
                    required
                  >
                    <Select
                      id="edit-account-role"
                      value={editRole}
                      onChange={(event) =>
                        setEditRole(event.target.value as EditableAccountRole)
                      }
                    >
                      <option value="TENANT_MEMBER">Penyewa lapak</option>
                      <option value="PENGELOLA_ADMIN">Pengelola sentra</option>
                    </Select>
                  </Field>
                  {editRole !== 'PENGELOLA_ADMIN' && (
                    <Field label="Warung" htmlFor="edit-account-warung" required>
                      <Select
                        id="edit-account-warung"
                        required
                        value={editWarungId}
                        onChange={(event) => setEditWarungId(event.target.value)}
                      >
                        {warungs.map((warung) => (
                          <option key={warung.id} value={warung.id}>
                            {warung.name}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </>
              )}
              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={() => setEditing(null)}
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={busy || (editing.role !== 'SUPER_ADMIN' && editRole !== 'PENGELOLA_ADMIN' && !editWarungId)}
                  isLoading={busy}
                >
                  Simpan perubahan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Reset Kata Sandi */}
      <Dialog
        open={!!resetTarget}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setResetError('');
            setResetTarget(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Reset kata sandi akun?</DialogTitle>
            <DialogDescription>
              Kata sandi lama tidak lagi berlaku dan sistem akan membuat kata sandi sementara baru
              yang wajib diganti saat login berikutnya.
            </DialogDescription>
          </DialogHeader>
          {resetError && <Alert variant="danger">{resetError}</Alert>}
          {resetTarget && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
              <p className="font-semibold text-text-primary">{resetTarget.fullName}</p>
              <p className="break-all text-xs text-text-secondary">{resetTarget.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setResetTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleConfirmReset()}
            >
              Buat sandi sementara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Aktifkan/Nonaktifkan Akun */}
      <Dialog
        open={!!toggleTarget}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setToggleError('');
            setToggleTarget(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {toggleTarget?.isActive ? 'Nonaktifkan akun?' : 'Aktifkan akun kembali?'}
            </DialogTitle>
            <DialogDescription>
              {toggleTarget?.isActive
                ? 'Pengguna tidak dapat masuk dan sesi login aktifnya akan diblokir sampai akun diaktifkan kembali.'
                : 'Pengguna akan diizinkan masuk kembali ke akunnya.'}
            </DialogDescription>
          </DialogHeader>
          {toggleError && <Alert variant="danger">{toggleError}</Alert>}
          {toggleTarget && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
              <p className="font-semibold text-text-primary">{toggleTarget.fullName}</p>
              <p className="break-all text-xs text-text-secondary">{toggleTarget.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setToggleTarget(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant={toggleTarget?.isActive ? 'destructive' : 'default'}
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleConfirmActiveToggle()}
            >
              {toggleTarget?.isActive ? 'Nonaktifkan akun' : 'Aktifkan akun'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Konfirmasi Hapus Akun */}
      <Dialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setDeleteError('');
            setDeleting(null);
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Hapus akun?</DialogTitle>
            <DialogDescription>
              Akses login akan dicabut dan data kontak disamarkan. Catatan transaksi, tagihan, dan
              audit dipertahankan agar riwayat usaha tetap utuh.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          {deleting && (
            <div className="rounded-xl border border-border-subtle bg-surface-muted p-3 text-sm">
              <p className="font-semibold text-text-primary">{deleting.fullName}</p>
              <p className="break-all text-xs text-text-secondary">{deleting.email}</p>
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => setDeleting(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={busy}
              isLoading={busy}
              onClick={() => void handleDelete()}
            >
              Hapus akun
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
