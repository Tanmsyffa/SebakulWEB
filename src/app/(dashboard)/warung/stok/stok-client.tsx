'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Package,
  PackageCheck,
  Plus,
  RotateCcw,
  Search,
  ShoppingCart,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  createInventoryItem,
  createWarungSupplier,
  deleteWarungSupplier,
  receiveWarungPurchase,
  updateInventoryStocks,
} from '@/server/actions/warung.actions';
import { formatRupiah } from '@/lib/utils/currency';
import { formatDateWIB } from '@/lib/utils/date';
import { cn } from '@/lib/utils';
import { PageHeader, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
import { Alert } from '@/components/ui/alert';
import { Badge, StockStatusBadge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { InferSelectModel } from 'drizzle-orm';
import type { warungPurchases, warungSuppliers } from '@/db/schema';
import type { WarungInventory } from '@/types';

interface StokClientProps {
  initialInventory: WarungInventory[];
  initialSuppliers: InferSelectModel<typeof warungSuppliers>[];
  initialPurchases: InferSelectModel<typeof warungPurchases>[];
  initialMovements: {
    id: string;
    itemName: string;
    movementType: string;
    quantityDelta: number;
    balanceAfter: number;
    notes: string | null;
    createdAt: Date;
  }[];
}

function parseWholeNumber(raw: string, max = 1_000_000): number {
  const digits = raw.replace(/\D/g, '');
  if (!digits) return 0;
  return Math.min(max, parseInt(digits, 10));
}

export function StokClient({
  initialInventory,
  initialSuppliers,
  initialPurchases,
  initialMovements,
}: StokClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = React.useState<'opname' | 'pengadaan' | 'riwayat'>('opname');
  const [inventory, setInventory] = React.useState(initialInventory);
  const [stockDrafts, setStockDrafts] = React.useState<Record<string, string>>({});
  const [stockFilter, setStockFilter] = React.useState<'ALL' | 'LOW'>('ALL');
  const [stockQuery, setStockQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');

  // Add Item Dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [newItemName, setNewItemName] = React.useState('');
  const [newItemUnit, setNewItemUnit] = React.useState('pcs');
  const [newItemStock, setNewItemStock] = React.useState('0');
  const [newItemThreshold, setNewItemThreshold] = React.useState('5');
  const [isAdding, setIsAdding] = React.useState(false);
  const [addError, setAddError] = React.useState('');

  // Supplier & Purchase state
  const [suppliers, setSuppliers] = React.useState(initialSuppliers);
  const [supplierName, setSupplierName] = React.useState('');
  const [supplierContact, setSupplierContact] = React.useState('');
  const [supplierError, setSupplierError] = React.useState('');
  const [supplierId, setSupplierId] = React.useState('');
  const [purchaseItemId, setPurchaseItemId] = React.useState(initialInventory[0]?.id ?? '');
  const [purchaseQty, setPurchaseQty] = React.useState('1');
  const [purchaseUnitCost, setPurchaseUnitCost] = React.useState(0);
  const [purchaseNote, setPurchaseNote] = React.useState('');
  const [purchaseError, setPurchaseError] = React.useState('');
  const [purchaseBusy, setPurchaseBusy] = React.useState(false);
  const [supplierToDelete, setSupplierToDelete] = React.useState<string | null>(null);
  const [deletingSupplier, setDeletingSupplier] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState('');

  React.useEffect(() => {
    setInventory(initialInventory);
  }, [initialInventory]);

  React.useEffect(() => {
    setSuppliers(initialSuppliers);
  }, [initialSuppliers]);

  React.useEffect(() => {
    if (!purchaseItemId && inventory[0]) setPurchaseItemId(inventory[0].id);
  }, [inventory, purchaseItemId]);

  React.useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(''), 4000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  const supplierMap = React.useMemo(
    () => new Map(suppliers.map((s) => [s.id, s.name])),
    [suppliers]
  );

  const getCurrentStockVal = (item: WarungInventory): number => {
    const draft = stockDrafts[item.id];
    if (draft === undefined) return item.currentStock;
    return parseWholeNumber(draft);
  };

  const getDraftDisplay = (item: WarungInventory): string => {
    const draft = stockDrafts[item.id];
    return draft !== undefined ? draft : String(item.currentStock);
  };

  const pendingEdits = React.useMemo(() => {
    return inventory
      .map((item) => {
        const draft = stockDrafts[item.id];
        if (draft === undefined) return null;
        const parsed = parseWholeNumber(draft);
        if (parsed === item.currentStock) return null;
        return { id: item.id, currentStock: parsed };
      })
      .filter((entry): entry is { id: string; currentStock: number } => entry !== null);
  }, [inventory, stockDrafts]);

  const lowStockCount = inventory.filter((item) => item.currentStock <= item.minThreshold).length;

  const visibleInventory = React.useMemo(() => {
    const q = stockQuery.trim().toLowerCase();
    return inventory.filter((item) => {
      const draft = stockDrafts[item.id];
      const currentVal = draft === undefined ? item.currentStock : parseWholeNumber(draft);
      if (stockFilter === 'LOW' && currentVal > item.minThreshold) return false;
      if (q && !item.itemName.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [inventory, stockDrafts, stockFilter, stockQuery]);

  const handleStockDraftChange = (item: WarungInventory, rawValue: string) => {
    const cleaned = rawValue.replace(/\D/g, '');
    if (cleaned === '') {
      setStockDrafts((prev) => ({ ...prev, [item.id]: '' }));
      return;
    }
    const clamped = Math.min(1_000_000, parseInt(cleaned, 10));
    if (clamped === item.currentStock) {
      setStockDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } else {
      setStockDrafts((prev) => ({ ...prev, [item.id]: String(clamped) }));
    }
  };

  const handleStockBlur = (item: WarungInventory) => {
    const draft = stockDrafts[item.id];
    if (draft === '') {
      if (item.currentStock === 0) {
        setStockDrafts((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } else {
        setStockDrafts((prev) => ({ ...prev, [item.id]: '0' }));
      }
    }
  };

  const handleSaveOpname = async () => {
    if (saving) return;
    setErrorMsg('');
    if (pendingEdits.length === 0) {
      setSuccessMsg('Tidak ada perubahan stok untuk disimpan.');
      return;
    }

    setSaving(true);
    try {
      await updateInventoryStocks(pendingEdits);
      setStockDrafts({});
      setSuccessMsg(`Opname stok untuk ${pendingEdits.length} bahan berhasil disimpan.`);
      router.refresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Gagal menyimpan opname stok.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAdding) return;
    setAddError('');
    if (!newItemName.trim()) {
      setAddError('Nama bahan baku wajib diisi.');
      return;
    }

    setIsAdding(true);
    try {
      await createInventoryItem({
        itemName: newItemName.trim(),
        unit: newItemUnit.trim() || 'pcs',
        currentStock: parseWholeNumber(newItemStock),
        minThreshold: parseWholeNumber(newItemThreshold),
      });

      setNewItemName('');
      setNewItemUnit('pcs');
      setNewItemStock('0');
      setNewItemThreshold('5');
      setIsAddOpen(false);
      setSuccessMsg('Bahan baku baru berhasil ditambahkan.');
      router.refresh();
    } catch (err) {
      setAddError(err instanceof Error ? err.message : 'Gagal menambahkan bahan baku.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseBusy) return;
    setSupplierError('');
    setErrorMsg('');

    const trimmedName = supplierName.trim();
    if (trimmedName.length < 2) {
      setSupplierError('Nama pemasok minimal 2 karakter.');
      return;
    }

    setPurchaseBusy(true);
    try {
      const result = await createWarungSupplier({
        name: trimmedName,
        contact: supplierContact.trim() || null,
      });
      setSuppliers((current) =>
        [...current, result.supplier].sort((a, b) => a.name.localeCompare(b.name))
      );
      setSupplierId(result.supplier.id);
      setSupplierName('');
      setSupplierContact('');
      setSuccessMsg(`Pemasok "${result.supplier.name}" ditambahkan.`);
      router.refresh();
    } catch (cause) {
      setSupplierError(cause instanceof Error ? cause.message : 'Gagal menyimpan pemasok.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierToDelete || deletingSupplier) return;
    setDeletingSupplier(true);
    setDeleteError('');
    try {
      await deleteWarungSupplier(supplierToDelete);
      setSuppliers((current) => current.filter((supplier) => supplier.id !== supplierToDelete));
      if (supplierId === supplierToDelete) setSupplierId('');
      setSupplierToDelete(null);
      setSuccessMsg('Pemasok dihapus dari daftar aktif. Riwayat pembelian tetap tersimpan.');
      router.refresh();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'Gagal menghapus pemasok.');
    } finally {
      setDeletingSupplier(false);
    }
  };

  const parsedPurchaseQty = parseWholeNumber(purchaseQty, 100_000);
  const purchaseTotal = parsedPurchaseQty * purchaseUnitCost;

  const handlePurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purchaseBusy) return;
    setPurchaseError('');
    setErrorMsg('');

    if (!purchaseItemId) {
      setPurchaseError('Pilih bahan baku terlebih dahulu.');
      return;
    }
    if (parsedPurchaseQty <= 0) {
      setPurchaseError('Jumlah pembelian minimal 1.');
      return;
    }
    if (purchaseUnitCost <= 0) {
      setPurchaseError('Harga satuan harus lebih dari Rp0.');
      return;
    }
    if (purchaseTotal <= 0 || purchaseTotal > 999_999_999) {
      setPurchaseError('Total pembelian harus lebih dari Rp0 dan maksimal Rp999.999.999.');
      return;
    }

    setPurchaseBusy(true);
    try {
      await receiveWarungPurchase({
        supplierId: supplierId || null,
        notes: purchaseNote.trim() || null,
        items: [
          {
            inventoryId: purchaseItemId,
            quantity: parsedPurchaseQty,
            unitCost: purchaseUnitCost,
          },
        ],
      });
      setPurchaseNote('');
      setPurchaseQty('1');
      setPurchaseUnitCost(0);
      setSuccessMsg('Pembelian tersimpan, stok bertambah, dan tercatat di Buku kas.');
      router.refresh();
    } catch (cause) {
      setPurchaseError(cause instanceof Error ? cause.message : 'Gagal mencatat pembelian.');
    } finally {
      setPurchaseBusy(false);
    }
  };

  const selectedPurchaseItem = inventory.find((item) => item.id === purchaseItemId);

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Persediaan warung"
        title="Stok bahan"
        description="Lakukan opname stok harian, catat pengadaan dari pemasok, dan pantau pergerakan bahan baku."
        actions={
          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (open) setAddError('');
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default" size="default">
                <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Tambah bahan</span>
              </Button>
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>Tambah bahan baku</DialogTitle>
                <DialogDescription>
                  Daftarkan bahan baru beserta satuan dan batas minimum peringatan stok.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleAddItem} className="space-y-4" noValidate>
                {addError && <Alert variant="danger">{addError}</Alert>}

                <Field label="Nama bahan baku" htmlFor="new-item-name" required>
                  <Input
                    id="new-item-name"
                    type="text"
                    required
                    maxLength={255}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    placeholder="Contoh: Mie Kuning Basah"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Satuan" htmlFor="new-item-unit" required>
                    <Select
                      id="new-item-unit"
                      value={newItemUnit}
                      onChange={(e) => setNewItemUnit(e.target.value)}
                    >
                      <option value="kg">kg</option>
                      <option value="pcs">pcs</option>
                      <option value="liter">liter</option>
                      <option value="tabung">tabung</option>
                      <option value="box">box</option>
                      <option value="porsi">porsi</option>
                    </Select>
                  </Field>

                  <Field
                    label="Batas minimum"
                    htmlFor="new-item-threshold"
                    hint="Status menipis aktif saat stok mencapai batas ini."
                  >
                    <Input
                      id="new-item-threshold"
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={1000000}
                      value={newItemThreshold}
                      onChange={(e) => setNewItemThreshold(e.target.value)}
                      className="font-mono tabular-nums"
                    />
                  </Field>
                </div>

                <Field label="Stok awal" htmlFor="new-item-stock" required>
                  <Input
                    id="new-item-stock"
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={1000000}
                    value={newItemStock}
                    onChange={(e) => setNewItemStock(e.target.value)}
                    className="font-mono tabular-nums"
                  />
                </Field>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={isAdding}
                    onClick={() => setIsAddOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={isAdding} isLoading={isAdding}>
                    Simpan bahan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {successMsg && <Alert variant="success">{successMsg}</Alert>}
      {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}

      <Stagger itemCount={3} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StaggerItem>
          <StatCard
            label="Total bahan baku"
            value={<AnimatedNumber value={inventory.length} />}
            icon={Package}
            tone="brand"
            hint="Terdaftar dalam inventaris warung"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Stok menipis"
            value={<AnimatedNumber value={lowStockCount} />}
            icon={lowStockCount > 0 ? AlertTriangle : PackageCheck}
            tone={lowStockCount > 0 ? 'warning' : 'success'}
            hint={
              lowStockCount > 0
                ? 'Perlu segera diisi ulang'
                : 'Semua bahan di atas batas minimum'
            }
          />
        </StaggerItem>
        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Pemasok aktif"
            value={<AnimatedNumber value={suppliers.length} />}
            icon={Truck}
            tone="neutral"
            hint={`${initialPurchases.length} pembelian terakhir tercatat`}
          />
        </StaggerItem>
      </Stagger>

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as 'opname' | 'pengadaan' | 'riwayat')}
      >
        <TabsList label="Bagian pengelolaan stok">
          <TabsTrigger value="opname">
            <span>Opname stok</span>
            {pendingEdits.length > 0 && (
              <Badge variant="warning" className="px-2 py-0.5">
                {pendingEdits.length} ubah
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pengadaan">Pengadaan &amp; pemasok</TabsTrigger>
          <TabsTrigger value="riwayat">Riwayat pergerakan</TabsTrigger>
        </TabsList>

        <TabsContent value="opname" className="space-y-4">
          <FadeIn>
            <Section
              title="Opname harian bahan baku"
              description="Sesuaikan jumlah stok fisik saat ini lalu simpan perubahan secara bersamaan."
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  {pendingEdits.length > 0 && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={saving}
                      onClick={() => setStockDrafts({})}
                    >
                      <RotateCcw aria-hidden="true" className="h-4 w-4" />
                      <span>Reset ({pendingEdits.length})</span>
                    </Button>
                  )}
                  <Button
                    type="button"
                    onClick={handleSaveOpname}
                    disabled={saving}
                    isLoading={saving}
                    size="sm"
                  >
                    Simpan opname{pendingEdits.length > 0 ? ` (${pendingEdits.length})` : ''}
                  </Button>
                </div>
              }
            >
              {inventory.length === 0 ? (
                <EmptyState
                  icon={Package}
                  title="Belum ada bahan baku"
                  description="Tambahkan bahan baku pertama untuk mulai melakukan opname harian dan pengadaan."
                  action={
                    <Button type="button" onClick={() => setIsAddOpen(true)}>
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      <span>Tambah bahan</span>
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 rounded-2xl border border-border-subtle bg-surface p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
                    <div className="relative flex-1 sm:max-w-xs">
                      <Search
                        aria-hidden="true"
                        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
                      />
                      <Input
                        type="search"
                        aria-label="Cari bahan baku"
                        value={stockQuery}
                        onChange={(e) => setStockQuery(e.target.value)}
                        placeholder="Cari nama bahan..."
                        className="pl-10"
                      />
                    </div>
                    <div
                      role="group"
                      aria-label="Filter status stok"
                      className="inline-flex rounded-xl border border-border-subtle bg-surface-muted p-1"
                    >
                      <button
                        type="button"
                        aria-pressed={stockFilter === 'ALL'}
                        onClick={() => setStockFilter('ALL')}
                        className={cn(
                          'min-h-11 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                          stockFilter === 'ALL'
                            ? 'bg-surface text-text-primary shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        )}
                      >
                        Semua ({inventory.length})
                      </button>
                      <button
                        type="button"
                        aria-pressed={stockFilter === 'LOW'}
                        onClick={() => setStockFilter('LOW')}
                        className={cn(
                          'min-h-11 rounded-lg px-3.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                          stockFilter === 'LOW'
                            ? 'bg-surface text-status-warning shadow-xs'
                            : 'text-text-secondary hover:text-text-primary'
                        )}
                      >
                        Menipis ({lowStockCount})
                      </button>
                    </div>
                  </div>

                  {visibleInventory.length === 0 ? (
                    <EmptyState
                      compact
                      icon={Search}
                      title="Bahan tidak ditemukan"
                      description="Coba ubah kata kunci pencarian atau tampilkan semua bahan."
                    />
                  ) : (
                    <>
                      <div className="hidden md:block">
                        <TableContainer>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Bahan baku</TableHead>
                                <TableHead numeric>Batas min.</TableHead>
                                <TableHead numeric>Rata-rata HPP</TableHead>
                                <TableHead numeric>Jumlah stok</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {visibleInventory.map((item) => {
                                const currentVal = getCurrentStockVal(item);
                                const isModified = currentVal !== item.currentStock;
                                return (
                                  <TableRow
                                    key={item.id}
                                    className={isModified ? 'bg-brand-soft/40' : undefined}
                                  >
                                    <TableCell>
                                      <p className="font-semibold text-text-primary">
                                        {item.itemName}
                                      </p>
                                      {isModified && (
                                        <p className="text-xs font-medium text-brand-primary">
                                          Sebelumnya: {item.currentStock} {item.unit}
                                        </p>
                                      )}
                                    </TableCell>
                                    <TableCell numeric>
                                      {item.minThreshold} {item.unit}
                                    </TableCell>
                                    <TableCell numeric>
                                      {item.averageUnitCost > 0
                                        ? `${formatRupiah(item.averageUnitCost)}/${item.unit}`
                                        : 'Belum ada'}
                                    </TableCell>
                                    <TableCell numeric>
                                      <div className="inline-flex items-center justify-end gap-2">
                                        <Input
                                          type="number"
                                          inputMode="numeric"
                                          min={0}
                                          max={1000000}
                                          aria-label={`Stok ${item.itemName} (${item.unit})`}
                                          value={getDraftDisplay(item)}
                                          onChange={(e) =>
                                            handleStockDraftChange(item, e.target.value)
                                          }
                                          onBlur={() => handleStockBlur(item)}
                                          className="w-28 text-right font-mono font-bold tabular-nums"
                                        />
                                        <span className="w-12 text-left text-xs font-medium text-text-secondary">
                                          {item.unit}
                                        </span>
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <StockStatusBadge
                                        currentStock={currentVal}
                                        minThreshold={item.minThreshold}
                                      />
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      </div>

                      <div className="space-y-3 md:hidden">
                        {visibleInventory.map((item) => {
                          const currentVal = getCurrentStockVal(item);
                          const isModified = currentVal !== item.currentStock;
                          return (
                            <Card
                              key={item.id}
                              className={cn(isModified && 'border-brand-primary bg-brand-soft/30')}
                            >
                              <CardContent className="p-4 space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-bold text-text-primary">
                                      {item.itemName}
                                    </p>
                                    <p className="mt-0.5 text-xs text-text-secondary">
                                      Min. {item.minThreshold} {item.unit}
                                      {item.averageUnitCost > 0
                                        ? ` · Rata-rata ${formatRupiah(item.averageUnitCost)}/${item.unit}`
                                        : ''}
                                    </p>
                                  </div>
                                  <StockStatusBadge
                                    currentStock={currentVal}
                                    minThreshold={item.minThreshold}
                                  />
                                </div>

                                <div className="flex items-center justify-between gap-3 pt-1">
                                  <label
                                    htmlFor={`mobile-stock-${item.id}`}
                                    className="text-sm font-medium text-text-secondary"
                                  >
                                    Stok fisik ({item.unit})
                                  </label>
                                  <Input
                                    id={`mobile-stock-${item.id}`}
                                    type="number"
                                    inputMode="numeric"
                                    min={0}
                                    max={1000000}
                                    value={getDraftDisplay(item)}
                                    onChange={(e) => handleStockDraftChange(item, e.target.value)}
                                    onBlur={() => handleStockBlur(item)}
                                    className="w-28 text-right font-mono font-bold tabular-nums"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      <div className="flex flex-col-reverse gap-2.5 sm:flex-row sm:justify-end">
                        {pendingEdits.length > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={saving}
                            onClick={() => setStockDrafts({})}
                          >
                            Batalkan perubahan
                          </Button>
                        )}
                        <Button
                          type="button"
                          onClick={handleSaveOpname}
                          disabled={saving}
                          isLoading={saving}
                          className="w-full sm:w-auto"
                        >
                          Simpan opname
                          {pendingEdits.length > 0 ? ` (${pendingEdits.length} bahan)` : ''}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </Section>
          </FadeIn>
        </TabsContent>

        <TabsContent value="pengadaan" className="space-y-6">
          <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
            <FadeIn className="space-y-6 lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle>Catat pembelian stok</CardTitle>
                  <CardDescription>
                    Pembelian otomatis menambah stok, menghitung rata-rata HPP bahan, dan mencatat
                    pengeluaran ke Buku kas.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {inventory.length === 0 ? (
                    <EmptyState
                      compact
                      icon={ShoppingCart}
                      title="Belum ada bahan baku"
                      description="Tambahkan bahan baku terlebih dahulu sebelum mencatat pembelian stok."
                      action={
                        <Button type="button" size="sm" onClick={() => setIsAddOpen(true)}>
                          Tambah bahan
                        </Button>
                      }
                    />
                  ) : (
                    <form onSubmit={handlePurchase} className="space-y-4" noValidate>
                      {purchaseError && <Alert variant="danger">{purchaseError}</Alert>}

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field label="Pemasok" htmlFor="purchase-supplier">
                          <Select
                            id="purchase-supplier"
                            value={supplierId}
                            onChange={(e) => setSupplierId(e.target.value)}
                          >
                            <option value="">Tanpa pemasok</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </Select>
                        </Field>

                        <Field label="Bahan baku" htmlFor="purchase-item" required>
                          <Select
                            id="purchase-item"
                            required
                            value={purchaseItemId}
                            onChange={(e) => setPurchaseItemId(e.target.value)}
                          >
                            {inventory.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.itemName} ({item.unit})
                              </option>
                            ))}
                          </Select>
                        </Field>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <Field
                          label={`Jumlah beli${selectedPurchaseItem ? ` (${selectedPurchaseItem.unit})` : ''}`}
                          htmlFor="purchase-qty"
                          required
                        >
                          <Input
                            id="purchase-qty"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={100000}
                            required
                            value={purchaseQty}
                            onChange={(e) => setPurchaseQty(e.target.value)}
                            className="font-mono tabular-nums"
                          />
                        </Field>

                        <Field
                          label="Harga satuan"
                          htmlFor="purchase-unit-cost"
                          hint="Minimal Rp1 per satuan."
                          required
                        >
                          <RupiahInput
                            id="purchase-unit-cost"
                            value={purchaseUnitCost}
                            onValueChange={setPurchaseUnitCost}
                            placeholder="0"
                          />
                        </Field>
                      </div>

                      <Field label="Catatan pembelian" htmlFor="purchase-note" hint="Opsional">
                        <Input
                          id="purchase-note"
                          type="text"
                          maxLength={500}
                          placeholder="Contoh: Nota pasar pagi"
                          value={purchaseNote}
                          onChange={(e) => setPurchaseNote(e.target.value)}
                        />
                      </Field>

                      <div className="flex flex-col gap-3 rounded-xl border border-border-subtle bg-surface-muted p-3.5 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs font-medium text-text-secondary">
                            Total pembelian tercatat ke Buku kas
                          </p>
                          <p className="font-mono text-lg font-bold text-text-primary tabular-nums">
                            {formatRupiah(purchaseTotal)}
                          </p>
                        </div>
                        <Button
                          type="submit"
                          disabled={purchaseBusy || !purchaseItemId}
                          isLoading={purchaseBusy}
                        >
                          Catat pembelian
                        </Button>
                      </div>
                    </form>
                  )}
                </CardContent>
              </Card>

              <Section
                title="Pembelian terakhir"
                description="Menampilkan hingga 30 catatan pembelian terbaru."
              >
                {initialPurchases.length === 0 ? (
                  <EmptyState
                    compact
                    icon={ShoppingCart}
                    title="Belum ada riwayat pembelian"
                    description="Pembelian bahan baku yang dicatat akan muncul di sini."
                  />
                ) : (
                  <TableContainer>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Pemasok &amp; catatan</TableHead>
                          <TableHead numeric>Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {initialPurchases.map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                              {formatDateWIB(purchase.purchasedAt)}
                            </TableCell>
                            <TableCell>
                              <p className="font-semibold text-text-primary">
                                {purchase.supplierId
                                  ? supplierMap.get(purchase.supplierId) ?? 'Pemasok nonaktif'
                                  : 'Tanpa pemasok'}
                              </p>
                              {purchase.notes && (
                                <p className="text-xs text-text-secondary">{purchase.notes}</p>
                              )}
                            </TableCell>
                            <TableCell numeric className="font-bold">
                              {formatRupiah(purchase.totalAmount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Section>
            </FadeIn>

            <FadeIn delay={0.06} className="lg:col-span-5">
              <Card>
                <CardHeader>
                  <CardTitle>Daftar pemasok</CardTitle>
                  <CardDescription>
                    Simpan pemasok langganan agar pencatatan pembelian lebih cepat.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleSupplier} className="space-y-3" noValidate>
                    {supplierError && <Alert variant="danger">{supplierError}</Alert>}

                    <Field label="Nama pemasok" htmlFor="supplier-name" required>
                      <Input
                        id="supplier-name"
                        required
                        minLength={2}
                        maxLength={120}
                        placeholder="Contoh: Toko Bahan Makmur"
                        value={supplierName}
                        onChange={(e) => setSupplierName(e.target.value)}
                      />
                    </Field>

                    <Field label="Kontak pemasok" htmlFor="supplier-contact" hint="Opsional">
                      <Input
                        id="supplier-contact"
                        maxLength={120}
                        placeholder="Nomor telepon atau WhatsApp"
                        value={supplierContact}
                        onChange={(e) => setSupplierContact(e.target.value)}
                      />
                    </Field>

                    <Button
                      type="submit"
                      variant="secondary"
                      disabled={purchaseBusy}
                      className="w-full"
                    >
                      <Plus aria-hidden="true" className="h-4 w-4" />
                      <span>Tambah pemasok</span>
                    </Button>
                  </form>

                  <div className="border-t border-border-subtle pt-4">
                    <h3 className="text-sm font-semibold text-text-primary">
                      Pemasok aktif ({suppliers.length})
                    </h3>
                    {suppliers.length === 0 ? (
                      <p className="mt-2 text-sm text-text-secondary">
                        Belum ada pemasok tersimpan.
                      </p>
                    ) : (
                      <ul className="mt-2 divide-y divide-border-subtle">
                        {suppliers.map((supplier) => (
                          <li
                            key={supplier.id}
                            className="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-text-primary">
                                {supplier.name}
                              </p>
                              <p className="truncate text-xs text-text-secondary">
                                {supplier.contact || 'Kontak belum diisi'}
                              </p>
                            </div>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              aria-label={`Hapus pemasok ${supplier.name}`}
                              disabled={purchaseBusy || deletingSupplier}
                              onClick={() => {
                                setDeleteError('');
                                setSupplierToDelete(supplier.id);
                              }}
                              className="shrink-0 text-status-danger hover:bg-status-danger-bg hover:text-status-danger"
                            >
                              <Trash2 aria-hidden="true" className="h-4 w-4" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          </div>
        </TabsContent>

        <TabsContent value="riwayat">
          <FadeIn>
            <Section
              title="Riwayat pergerakan stok"
              description="Menampilkan hingga 30 perubahan stok terakhir dalam waktu WIB."
            >
              {initialMovements.length === 0 ? (
                <EmptyState
                  compact
                  icon={Package}
                  title="Belum ada pergerakan stok"
                  description="Pembelian bahan atau penyesuaian opname akan tercatat secara otomatis di sini."
                />
              ) : (
                <>
                  <div className="hidden md:block">
                    <TableContainer>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Waktu (WIB)</TableHead>
                            <TableHead>Bahan baku</TableHead>
                            <TableHead>Jenis</TableHead>
                            <TableHead numeric>Perubahan</TableHead>
                            <TableHead numeric>Saldo akhir</TableHead>
                            <TableHead>Catatan</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {initialMovements.map((movement) => (
                            <TableRow key={movement.id}>
                              <TableCell className="whitespace-nowrap text-xs text-text-secondary">
                                {formatDateWIB(movement.createdAt)}
                              </TableCell>
                              <TableCell className="font-semibold">{movement.itemName}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={movement.movementType === 'PURCHASE' ? 'info' : 'neutral'}
                                >
                                  {movement.movementType === 'PURCHASE' ? (
                                    <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                                  ) : (
                                    <ArrowDownRight aria-hidden="true" className="h-3.5 w-3.5" />
                                  )}
                                  <span>
                                    {movement.movementType === 'PURCHASE' ? 'Pembelian' : 'Opname'}
                                  </span>
                                </Badge>
                              </TableCell>
                              <TableCell
                                numeric
                                className={cn(
                                  'font-bold',
                                  movement.quantityDelta > 0
                                    ? 'text-status-success'
                                    : 'text-status-danger'
                                )}
                              >
                                {movement.quantityDelta > 0 ? '+' : ''}
                                {movement.quantityDelta}
                              </TableCell>
                              <TableCell numeric>{movement.balanceAfter}</TableCell>
                              <TableCell className="text-text-secondary">
                                {movement.notes || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </div>

                  <Card className="md:hidden">
                    <CardContent className="p-4 divide-y divide-border-subtle">
                      {initialMovements.map((movement) => (
                        <div
                          key={movement.id}
                          className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0 space-y-1">
                            <p className="truncate text-sm font-semibold text-text-primary">
                              {movement.itemName}
                            </p>
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge
                                variant={movement.movementType === 'PURCHASE' ? 'info' : 'neutral'}
                              >
                                {movement.movementType === 'PURCHASE' ? 'Pembelian' : 'Opname'}
                              </Badge>
                              <span className="text-xs text-text-secondary">
                                Saldo: {movement.balanceAfter}
                              </span>
                            </div>
                            <p className="text-xs text-text-secondary">
                              {formatDateWIB(movement.createdAt)}
                              {movement.notes ? ` · ${movement.notes}` : ''}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 font-mono text-sm font-bold tabular-nums',
                              movement.quantityDelta > 0
                                ? 'text-status-success'
                                : 'text-status-danger'
                            )}
                          >
                            {movement.quantityDelta > 0 ? '+' : ''}
                            {movement.quantityDelta}
                          </span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </>
              )}
            </Section>
          </FadeIn>
        </TabsContent>
      </Tabs>

      <Dialog
        open={supplierToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletingSupplier) {
            setSupplierToDelete(null);
            setDeleteError('');
          }
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Hapus pemasok dari daftar aktif?</DialogTitle>
            <DialogDescription>
              Pemasok tidak akan muncul saat mencatat pembelian berikutnya, sedangkan riwayat
              pembelian lama tetap tersimpan.
            </DialogDescription>
          </DialogHeader>
          {deleteError && <Alert variant="danger">{deleteError}</Alert>}
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={deletingSupplier}
              onClick={() => setSupplierToDelete(null)}
            >
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deletingSupplier}
              isLoading={deletingSupplier}
              onClick={() => void handleDeleteSupplier()}
            >
              Hapus pemasok
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
