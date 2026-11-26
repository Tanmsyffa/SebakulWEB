'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRightLeft,
  Check,
  Copy,
  Store,
  UserPlus,
  Users,
  Utensils,
} from 'lucide-react';
import { SuperAdminCharts } from '@/components/charts/dashboard-overview-charts';
import { PageHeader, Section } from '@/components/layout';
import { FadeIn, PageTransition } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatActionError } from '@/lib/utils';
import { registerAccount, transferAccount } from '@/server/actions/admin.actions';
import { AccountManagement } from './account-management';
import { LapakManagement } from './lapak-management';
import type {
  EditableAccountRole,
  LapakItem,
  ManagedAccount,
  SuperAdminAnalyticsData,
  TemporaryCredential,
  WarungItem,
} from './types';
import { WarungManagement } from './warung-management';

interface AdminMasterProps {
  lapaks: LapakItem[];
  warungs: WarungItem[];
  accounts: ManagedAccount[];
  analytics?: SuperAdminAnalyticsData;
}

export function AdminMasterClient({
  lapaks,
  warungs,
  accounts,
  analytics,
}: AdminMasterProps) {
  const router = useRouter();
  const [visibleLapaks, setVisibleLapaks] = React.useState(lapaks);
  const [visibleWarungs, setVisibleWarungs] = React.useState(warungs);
  const [visibleAccounts, setVisibleAccounts] = React.useState(accounts);

  React.useEffect(() => setVisibleLapaks(lapaks), [lapaks]);
  React.useEffect(() => setVisibleWarungs(warungs), [warungs]);
  React.useEffect(() => setVisibleAccounts(accounts), [accounts]);

  const [activeTab, setActiveTab] = React.useState('lapak');
  const [busy, setBusy] = React.useState(false);
  const [feedback, setFeedback] = React.useState('');
  const [newCredential, setNewCredential] = React.useState<TemporaryCredential | null>(null);
  const [copiedCredential, setCopiedCredential] = React.useState(false);

  // Quick-action dialog visibility
  const [registerOpen, setRegisterOpen] = React.useState(false);
  const [transferOpen, setTransferOpen] = React.useState(false);
  const [createLapakOpen, setCreateLapakOpen] = React.useState(false);
  const [createWarungOpen, setCreateWarungOpen] = React.useState(false);

  // Register account form state
  const [role, setRole] = React.useState<EditableAccountRole>('TENANT_MEMBER');
  const [warungId, setWarungId] = React.useState(warungs[0]?.id ?? '');
  const [email, setEmail] = React.useState('');
  const [fullName, setFullName] = React.useState('');
  const [registerError, setRegisterError] = React.useState('');

  // Transfer warung ownership form state
  const [transferWarungId, setTransferWarungId] = React.useState(warungs[0]?.id ?? '');
  const [oldEmail, setOldEmail] = React.useState('');
  const [newEmail, setNewEmail] = React.useState('');
  const [newOwnerName, setNewOwnerName] = React.useState('');
  const [transferError, setTransferError] = React.useState('');

  React.useEffect(() => {
    if (visibleWarungs.length === 0) {
      setWarungId('');
      setTransferWarungId('');
      return;
    }
    if (!visibleWarungs.some((w) => w.id === warungId)) {
      setWarungId(visibleWarungs[0].id);
    }
    if (!visibleWarungs.some((w) => w.id === transferWarungId)) {
      setTransferWarungId(visibleWarungs[0].id);
    }
  }, [visibleWarungs, warungId, transferWarungId]);

  const activeAccountCount = React.useMemo(
    () =>
      visibleAccounts.filter(
        (account) => !account.email.endsWith('@deleted.sebakul.invalid')
      ).length,
    [visibleAccounts]
  );

  function showSuccess(message: string) {
    setFeedback(message);
  }

  function showCredential(credential: TemporaryCredential) {
    setCopiedCredential(false);
    setNewCredential(credential);
  }

  function openRegisterDialog() {
    setRegisterError('');
    setRole('TENANT_MEMBER');
    setWarungId((current) => current || visibleWarungs[0]?.id || '');
    setEmail('');
    setFullName('');
    setRegisterOpen(true);
  }

  function findWarungOwnerEmail(targetWarungId: string) {
    const owner = visibleAccounts.find(
      (account) =>
        account.role === 'TENANT_MEMBER' &&
        account.warungId === targetWarungId &&
        !account.email.endsWith('@deleted.sebakul.invalid')
    );
    return owner?.email ?? '';
  }

  function openTransferDialog() {
    setTransferError('');
    const initialWarungId = transferWarungId || visibleWarungs[0]?.id || '';
    setTransferWarungId(initialWarungId);
    setOldEmail(findWarungOwnerEmail(initialWarungId));
    setNewEmail('');
    setNewOwnerName('');
    setTransferOpen(true);
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setRegisterError('');
    setBusy(true);
    try {
      const result = await registerAccount({
        email,
        fullName,
        role,
        warungId: role === 'TENANT_MEMBER' ? warungId : null,
      });
      if (!result.success) {
        setRegisterError(result.error);
        return;
      }
      setVisibleAccounts((current) =>
        current.some(
          (account) =>
            account.id === result.account.id && account.role === result.account.role
        )
          ? current
          : [...current, result.account]
      );
      showCredential({
        email: result.account.email,
        password: result.temporaryPassword,
      });
      showSuccess(
        'Akun berhasil dibuat. Salin kata sandi sementara sebelum menutup pemberitahuan.'
      );
      setEmail('');
      setFullName('');
      setRegisterOpen(false);
      router.refresh();
    } catch (cause) {
      setRegisterError(formatActionError(cause, 'Gagal mendaftarkan akun.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleTransfer(event: React.FormEvent) {
    event.preventDefault();
    setTransferError('');
    setBusy(true);
    try {
      const result = await transferAccount({
        warungId: transferWarungId,
        oldEmail,
        newEmail,
        newFullName: newOwnerName.trim() || undefined,
      });
      if (!result.success) {
        setTransferError(result.error);
        return;
      }
      setVisibleAccounts((current) => {
        const filtered = current.filter(
          (account) =>
            !(
              account.id === result.oldUserId &&
              account.role === 'TENANT_MEMBER' &&
              account.warungId === result.warungId
            )
        );
        const alreadyPresent = filtered.some(
          (account) =>
            account.id === result.newUserId &&
            account.role === 'TENANT_MEMBER' &&
            account.warungId === result.warungId
        );
        return alreadyPresent ? filtered : [...filtered, result.createdAccount];
      });
      if (result.temporaryPassword) {
        showCredential({
          email: result.createdAccount.email,
          password: result.temporaryPassword,
        });
        showSuccess(
          'Kepemilikan warung berhasil dipindahkan dan akun baru telah dibuat. Salin kata sandi sementara di atas.'
        );
      } else {
        showSuccess('Kepemilikan warung berhasil dipindahkan.');
      }
      setOldEmail('');
      setNewEmail('');
      setNewOwnerName('');
      setTransferOpen(false);
      router.refresh();
    } catch (cause) {
      setTransferError(formatActionError(cause, 'Gagal memindahkan kepemilikan warung.'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCredential() {
    if (!newCredential) return;
    try {
      await navigator.clipboard.writeText(newCredential.password);
      setCopiedCredential(true);
      window.setTimeout(() => setCopiedCredential(false), 2000);
    } catch {
      // Clipboard may be blocked; text remains selectable in code block
    }
  }

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Super Admin"
        title="Admin master"
        description="Kelola lapak, warung, kontrak sewa, transfer kepemilikan, dan akses akun sentra kuliner."
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              disabled={busy || visibleWarungs.length === 0}
              onClick={openTransferDialog}
            >
              <ArrowRightLeft aria-hidden="true" className="h-4 w-4" />
              <span>Transfer warung</span>
            </Button>
            <Button type="button" disabled={busy} onClick={openRegisterDialog}>
              <UserPlus aria-hidden="true" className="h-4 w-4" />
              <span>Daftarkan akun</span>
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

      {newCredential && (
        <section aria-label="Kredensial akun sementara">
          <Alert
            variant="warning"
            title={`Kata sandi sementara untuk ${newCredential.email}`}
            action={
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => void handleCopyCredential()}
                >
                  {copiedCredential ? (
                    <Check aria-hidden="true" className="h-4 w-4 text-status-success" />
                  ) : (
                    <Copy aria-hidden="true" className="h-4 w-4" />
                  )}
                  <span>{copiedCredential ? 'Tersalin' : 'Salin sandi'}</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setNewCredential(null)}
                >
                  Saya sudah menyalin, tutup
                </Button>
              </div>
            }
          >
            <p>
              Tampil satu kali di halaman ini. Bagikan melalui saluran pribadi dan minta pengguna
              segera menggantinya saat masuk pertama kali.
            </p>
            <code className="mt-2 block break-all rounded-xl border border-border-subtle bg-surface p-3 font-mono text-sm text-text-primary select-all">
              {newCredential.password}
            </code>
          </Alert>
        </section>
      )}

      {analytics && (
        <FadeIn>
          <Section
            title="Ringkasan usaha"
            description="Kondisi hunian lapak, tunggakan sewa, dan arus kas sentra dalam enam bulan terakhir."
          >
            <SuperAdminCharts data={analytics} />
          </Section>
        </FadeIn>
      )}

      <Section
        title="Data master dan akun"
        description="Pilih tab untuk mengelola lapak, profil warung, atau akun pengguna."
      >
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList label="Kategori data master">
            <TabsTrigger value="lapak">
              <Store aria-hidden="true" className="h-4 w-4" />
              <span>Lapak ({visibleLapaks.length})</span>
            </TabsTrigger>
            <TabsTrigger value="warung">
              <Utensils aria-hidden="true" className="h-4 w-4" />
              <span>Warung ({visibleWarungs.length})</span>
            </TabsTrigger>
            <TabsTrigger value="akun">
              <Users aria-hidden="true" className="h-4 w-4" />
              <span>Akun ({activeAccountCount})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="lapak">
            <LapakManagement
              lapaks={visibleLapaks}
              warungs={visibleWarungs}
              busy={busy}
              onBusyChange={setBusy}
              onFeedback={showSuccess}
              onLapaksChange={setVisibleLapaks}
              onAfterMutation={() => router.refresh()}
              createOpen={createLapakOpen}
              onCreateOpenChange={setCreateLapakOpen}
            />
          </TabsContent>

          <TabsContent value="warung">
            <WarungManagement
              warungs={visibleWarungs}
              lapaks={visibleLapaks}
              busy={busy}
              onBusyChange={setBusy}
              onFeedback={showSuccess}
              onWarungsChange={setVisibleWarungs}
              onLapaksChange={setVisibleLapaks}
              onAfterMutation={() => router.refresh()}
              createOpen={createWarungOpen}
              onCreateOpenChange={setCreateWarungOpen}
              onOpenTransfer={openTransferDialog}
            />
          </TabsContent>

          <TabsContent value="akun">
            <AccountManagement
              accounts={visibleAccounts}
              warungs={visibleWarungs}
              busy={busy}
              onBusyChange={setBusy}
              onFeedback={showSuccess}
              onCredential={showCredential}
              onAccountsChange={setVisibleAccounts}
              onAfterMutation={() => router.refresh()}
              onOpenRegister={openRegisterDialog}
            />
          </TabsContent>
        </Tabs>
      </Section>

      {/* Dialog: Daftarkan Akun */}
      <Dialog
        open={registerOpen}
        onOpenChange={(open) => {
          if (!busy) {
            if (!open) setRegisterError('');
            setRegisterOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Daftarkan akun baru</DialogTitle>
            <DialogDescription>
              Sistem membuat kata sandi sementara acak dan menampilkannya satu kali setelah akun
              dibuat.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRegister} className="space-y-4">
            {registerError && <Alert variant="danger">{registerError}</Alert>}
            <Field label="Nama lengkap" htmlFor="account-name" required>
              <Input
                id="account-name"
                required
                minLength={2}
                maxLength={100}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Nama pemilik atau pengelola"
              />
            </Field>
            <Field label="Email" htmlFor="account-email" required>
              <Input
                id="account-email"
                type="email"
                required
                autoComplete="off"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@contoh.id"
              />
            </Field>
            <Field label="Peran" htmlFor="account-role" required>
              <Select
                id="account-role"
                value={role}
                onChange={(event) => setRole(event.target.value as EditableAccountRole)}
              >
                <option value="TENANT_MEMBER">Penyewa lapak</option>
                <option value="PENGELOLA_ADMIN">Pengelola sentra</option>
              </Select>
            </Field>
            {role === 'TENANT_MEMBER' && (
              <Field
                label="Warung"
                htmlFor="account-warung"
                error={
                  visibleWarungs.length === 0
                    ? 'Tambahkan warung terlebih dahulu sebelum mendaftarkan penyewa.'
                    : undefined
                }
                required
              >
                <Select
                  id="account-warung"
                  required
                  disabled={visibleWarungs.length === 0}
                  value={warungId}
                  onChange={(event) => setWarungId(event.target.value)}
                >
                  {visibleWarungs.map((warung) => (
                    <option key={warung.id} value={warung.id}>
                      {warung.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setRegisterOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={busy || (role === 'TENANT_MEMBER' && !warungId)}
                isLoading={busy}
              >
                Buat akun
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Transfer Kepemilikan Warung */}
      <Dialog
        open={transferOpen}
        onOpenChange={(open) => {
          if (!busy) {
            if (!open) setTransferError('');
            setTransferOpen(open);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer kepemilikan warung</DialogTitle>
            <DialogDescription>
              Pindahkan akses warung ke email pemilik baru. Jika email belum terdaftar, sistem
              otomatis membuatkan akun beserta kata sandi sementara.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-4">
            {transferError && <Alert variant="danger">{transferError}</Alert>}
            <Field label="Warung" htmlFor="transfer-warung" required>
              <Select
                id="transfer-warung"
                required
                value={transferWarungId}
                onChange={(event) => {
                  const nextId = event.target.value;
                  setTransferWarungId(nextId);
                  setOldEmail(findWarungOwnerEmail(nextId));
                }}
              >
                {visibleWarungs.map((warung) => (
                  <option key={warung.id} value={warung.id}>
                    {warung.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Email pemilik lama" htmlFor="old-email" required>
              <Input
                id="old-email"
                type="email"
                required
                value={oldEmail}
                onChange={(event) => setOldEmail(event.target.value)}
                placeholder="pemilik.lama@contoh.id"
              />
            </Field>
            <Field label="Email pemilik baru" htmlFor="new-email" required>
              <Input
                id="new-email"
                type="email"
                required
                value={newEmail}
                onChange={(event) => setNewEmail(event.target.value)}
                placeholder="pemilik.baru@contoh.id"
              />
            </Field>
            <Field
              label="Nama pemilik baru (opsional)"
              htmlFor="new-owner-name"
              hint="Digunakan apabila email pemilik baru belum memiliki akun di SEBAKUL."
            >
              <Input
                id="new-owner-name"
                maxLength={100}
                value={newOwnerName}
                onChange={(event) => setNewOwnerName(event.target.value)}
                placeholder="Contoh: Sultan"
              />
            </Field>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={busy}
                onClick={() => setTransferOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="submit"
                disabled={busy || !transferWarungId}
                isLoading={busy}
              >
                Transfer kepemilikan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
