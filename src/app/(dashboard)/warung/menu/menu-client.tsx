'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  Pencil,
  Plus,
  Search,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import {
  createMenuItem,
  saveWarungMenuRecipe,
  updateMenuItem,
  updateMenuSortOrder,
} from '@/server/actions/warung.actions';
import { formatRupiah } from '@/lib/utils/currency';
import { cn, formatActionError } from '@/lib/utils';
import { FilterBar, PageHeader, Section, StatCard } from '@/components/layout';
import { AnimatedNumber, FadeIn, PageTransition, Stagger, StaggerItem } from '@/components/motion';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { Field } from '@/components/ui/field';
import { Input, RupiahInput } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import type { WarungInventory, WarungMenu } from '@/types';

interface MenuClientProps {
  initialMenus: WarungMenu[];
  inventory: WarungInventory[];
  initialRecipes: {
    menuId: string;
    inventoryId: string;
    itemName: string;
    quantity: number;
    averageUnitCost: number;
  }[];
}

export function MenuClient({ initialMenus, inventory, initialRecipes }: MenuClientProps) {
  const router = useRouter();
  const [menus, setMenus] = React.useState(initialMenus);
  const [availabilityFilter, setAvailabilityFilter] = React.useState<'ALL' | 'AVAILABLE' | 'OUT'>('ALL');
  const [searchQuery, setSearchQuery] = React.useState('');

  // Create Dialog state
  const [isAddOpen, setIsAddOpen] = React.useState(false);
  const [name, setName] = React.useState('');
  const [price, setPrice] = React.useState(0);
  const [isFeatured, setIsFeatured] = React.useState(false);
  const [menuSource, setMenuSource] = React.useState<'MANUAL' | 'STOCK'>('MANUAL');
  const [selectedStockId, setSelectedStockId] = React.useState('');
  const [newRecipeQuantities, setNewRecipeQuantities] = React.useState<Record<string, number>>({});
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [createError, setCreateError] = React.useState('');

  // Edit Menu Dialog state
  const [editingMenu, setEditingMenu] = React.useState<WarungMenu | null>(null);
  const [editName, setEditName] = React.useState('');
  const [editPrice, setEditPrice] = React.useState(0);
  const [editFeatured, setEditFeatured] = React.useState(false);
  const [editBusy, setEditBusy] = React.useState(false);
  const [editError, setEditError] = React.useState('');

  // Recipe Dialog state
  const [recipeMenuId, setRecipeMenuId] = React.useState<string | null>(null);
  const [recipeQuantities, setRecipeQuantities] = React.useState<Record<string, number>>({});
  const [recipeBusy, setRecipeBusy] = React.useState(false);
  const [recipeError, setRecipeError] = React.useState('');

  // Global feedback & item-level busy flags
  const [successMsg, setSuccessMsg] = React.useState('');
  const [errorMsg, setErrorMsg] = React.useState('');
  const [busyMenuId, setBusyMenuId] = React.useState<string | null>(null);
  const [reordering, setReordering] = React.useState(false);

  React.useEffect(() => {
    setMenus(initialMenus);
  }, [initialMenus]);

  React.useEffect(() => {
    if (!successMsg) return;
    const timer = window.setTimeout(() => setSuccessMsg(''), 4000);
    return () => window.clearTimeout(timer);
  }, [successMsg]);

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const recipeCosts = React.useMemo(() => {
    const map = new Map<string, { amount: number; complete: boolean }>();
    for (const recipe of initialRecipes) {
      const current = map.get(recipe.menuId) ?? { amount: 0, complete: true };
      map.set(recipe.menuId, {
        amount: current.amount + recipe.quantity * recipe.averageUnitCost,
        complete: current.complete && recipe.averageUnitCost > 0,
      });
    }
    return map;
  }, [initialRecipes]);

  const isDefaultOrderView = availabilityFilter === 'ALL' && searchQuery.trim() === '';

  const filteredMenus = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return menus.filter((item) => {
      if (availabilityFilter === 'AVAILABLE' && !item.isAvailable) return false;
      if (availabilityFilter === 'OUT' && item.isAvailable) return false;
      if (q && !item.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [menus, availabilityFilter, searchQuery]);

  const handleSelectImageFile = (file: File | null) => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(file);
    setImagePreviewUrl(file ? URL.createObjectURL(file) : null);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setCreateError('');
    setErrorMsg('');

    if (!name.trim()) {
      setCreateError('Nama menu wajib diisi.');
      return;
    }
    if (price <= 0) {
      setCreateError('Harga jual harus lebih dari Rp0.');
      return;
    }
    if (menuSource === 'STOCK' && !selectedStockId) {
      setCreateError('Pilih bahan baku dari stok.');
      return;
    }

    setLoading(true);
    try {
      let imageUrl: string | undefined;
      if (imageFile) {
        const { default: compress } = await import('browser-image-compression');
        const compressed = await compress(imageFile, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1024,
          fileType: 'image/webp',
          useWebWorker: true,
        });
        const form = new FormData();
        form.set('file', compressed);
        const response = await fetch('/api/menu-images', { method: 'POST', body: form });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal mengunggah foto menu.');
        imageUrl = result.url;
      }

      const recipeIngredients =
        menuSource === 'STOCK'
          ? selectedStockId
            ? [{ inventoryId: selectedStockId, quantity: 1 }]
            : []
          : Object.entries(newRecipeQuantities)
              .filter(([, quantity]) => quantity > 0)
              .map(([inventoryId, quantity]) => ({ inventoryId, quantity }));

      await createMenuItem({
        name: name.trim(),
        price,
        isFeatured,
        isAvailable: true,
        sortOrder: menus.length,
        imageUrl,
        recipeIngredients,
      });

      setName('');
      setPrice(0);
      setIsFeatured(false);
      handleSelectImageFile(null);
      setMenuSource('MANUAL');
      setSelectedStockId('');
      setNewRecipeQuantities({});
      setIsAddOpen(false);
      setSuccessMsg('Menu baru berhasil ditambahkan.');
      router.refresh();
    } catch (err) {
      setCreateError(formatActionError(err, 'Gagal menambahkan menu.'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (item: WarungMenu) => {
    setEditingMenu(item);
    setEditName(item.name);
    setEditPrice(item.price);
    setEditFeatured(item.isFeatured);
    setEditError('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMenu || editBusy) return;
    setEditError('');

    if (!editName.trim()) {
      setEditError('Nama menu wajib diisi.');
      return;
    }
    if (editPrice <= 0) {
      setEditError('Harga jual harus lebih dari Rp0.');
      return;
    }

    setEditBusy(true);
    try {
      await updateMenuItem(editingMenu.id, {
        name: editName.trim(),
        price: editPrice,
        isFeatured: editFeatured,
      });
      setMenus((prev) =>
        prev.map((m) =>
          m.id === editingMenu.id
            ? { ...m, name: editName.trim(), price: editPrice, isFeatured: editFeatured }
            : m
        )
      );
      setEditingMenu(null);
      setSuccessMsg('Perubahan menu tersimpan.');
      router.refresh();
    } catch (err) {
      setEditError(formatActionError(err, 'Gagal menyimpan perubahan menu.'));
    } finally {
      setEditBusy(false);
    }
  };

  const handleToggleAvailable = async (id: string, current: boolean) => {
    if (busyMenuId) return;
    setBusyMenuId(id);
    setErrorMsg('');
    try {
      await updateMenuItem(id, { isAvailable: !current });
      setMenus((prev) => prev.map((m) => (m.id === id ? { ...m, isAvailable: !current } : m)));
      setSuccessMsg(
        !current ? 'Status menu diubah menjadi tersedia.' : 'Status menu diubah menjadi habis.'
      );
      router.refresh();
    } catch (err) {
      setErrorMsg(formatActionError(err, 'Gagal mengubah status ketersediaan.'));
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleReplaceImage = async (id: string, file: File | undefined) => {
    if (!file || busyMenuId) return;
    setBusyMenuId(id);
    setErrorMsg('');
    try {
      const { default: compress } = await import('browser-image-compression');
      const compressed = await compress(file, {
        maxSizeMB: 0.2,
        maxWidthOrHeight: 1024,
        fileType: 'image/webp',
        useWebWorker: true,
      });
      const form = new FormData();
      form.set('file', compressed);
      const response = await fetch('/api/menu-images', { method: 'POST', body: form });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Gagal mengunggah foto.');
      await updateMenuItem(id, { imageUrl: result.url });
      setMenus((previous) =>
        previous.map((item) => (item.id === id ? { ...item, imageUrl: result.url } : item))
      );
      setSuccessMsg('Foto menu berhasil diperbarui.');
      router.refresh();
    } catch (error) {
      setErrorMsg(formatActionError(error, 'Gagal mengganti foto menu.'));
    } finally {
      setBusyMenuId(null);
    }
  };

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    if (reordering || !isDefaultOrderView) return;
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= menus.length) return;

    const previousMenus = menus;
    const newMenus = [...menus];
    const temp = newMenus[index];
    newMenus[index] = newMenus[targetIdx];
    newMenus[targetIdx] = temp;

    const updatedWithSort = newMenus.map((m, idx) => ({ ...m, sortOrder: idx }));
    setMenus(updatedWithSort);
    setReordering(true);
    setErrorMsg('');

    try {
      await updateMenuSortOrder(updatedWithSort.map((m) => ({ id: m.id, sortOrder: m.sortOrder })));
      router.refresh();
    } catch (err) {
      setMenus(previousMenus);
      setErrorMsg(formatActionError(err, 'Gagal menyimpan urutan menu.'));
    } finally {
      setReordering(false);
    }
  };

  const openRecipe = (menuId: string) => {
    setRecipeMenuId(menuId);
    setRecipeError('');
    setRecipeQuantities(
      Object.fromEntries(
        initialRecipes
          .filter((recipe) => recipe.menuId === menuId)
          .map((recipe) => [recipe.inventoryId, recipe.quantity])
      )
    );
  };

  const saveRecipe = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!recipeMenuId || recipeBusy) return;
    setRecipeBusy(true);
    setRecipeError('');
    try {
      await saveWarungMenuRecipe(
        recipeMenuId,
        Object.entries(recipeQuantities)
          .filter(([, quantity]) => quantity > 0)
          .map(([inventoryId, quantity]) => ({ inventoryId, quantity }))
      );
      setSuccessMsg('Resep menu tersimpan.');
      setRecipeMenuId(null);
      router.refresh();
    } catch (cause) {
      setRecipeError(formatActionError(cause, 'Gagal menyimpan resep.'));
    } finally {
      setRecipeBusy(false);
    }
  };

  const recipeMenu = menus.find((m) => m.id === recipeMenuId) ?? null;
  const liveRecipeCost = React.useMemo(() => {
    let total = 0;
    let complete = true;
    let count = 0;
    for (const item of inventory) {
      const qty = recipeQuantities[item.id] ?? 0;
      if (qty > 0) {
        count += 1;
        total += qty * item.averageUnitCost;
        if (item.averageUnitCost <= 0) complete = false;
      }
    }
    return { total, complete, count };
  }, [inventory, recipeQuantities]);

  const availableCount = menus.filter((m) => m.isAvailable).length;

  return (
    <PageTransition className="space-y-6">
      <PageHeader
        eyebrow="Katalog internal warung"
        title="Menu usaha"
        description="Catat produk, harga jual, dan resep kebutuhan bahan per porsi untuk memantau estimasi biaya bahan. Data ini hanya untuk penyewa."
        actions={
          <Dialog
            open={isAddOpen}
            onOpenChange={(open) => {
              setIsAddOpen(open);
              if (open) setCreateError('');
            }}
          >
            <DialogTrigger asChild>
              <Button variant="default" size="default">
                <Plus aria-hidden="true" className="h-4 w-4 shrink-0" />
                <span>Tambah menu</span>
              </Button>
            </DialogTrigger>
            <DialogContent size="md">
              <DialogHeader>
                <DialogTitle>Tambah menu baru</DialogTitle>
                <DialogDescription>
                  Catat harga jual dan kaitkan bahan dari stok jika ingin menghitung estimasi HPP.
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreate} className="space-y-4" noValidate>
                {createError && <Alert variant="danger">{createError}</Alert>}

                <fieldset className="space-y-1.5">
                  <legend className="text-sm font-medium text-text-primary">Sumber menu</legend>
                  <div className="grid grid-cols-2 gap-2 rounded-xl border border-border-subtle bg-surface-muted p-1">
                    <button
                      type="button"
                      aria-pressed={menuSource === 'STOCK'}
                      onClick={() => setMenuSource('STOCK')}
                      className={cn(
                        'min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                        menuSource === 'STOCK'
                          ? 'bg-surface text-brand-primary shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      Pakai bahan stok
                    </button>
                    <button
                      type="button"
                      aria-pressed={menuSource === 'MANUAL'}
                      onClick={() => setMenuSource('MANUAL')}
                      className={cn(
                        'min-h-11 rounded-lg px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                        menuSource === 'MANUAL'
                          ? 'bg-surface text-brand-primary shadow-xs'
                          : 'text-text-secondary hover:text-text-primary'
                      )}
                    >
                      Menu manual
                    </button>
                  </div>
                </fieldset>

                {menuSource === 'STOCK' && (
                  <Field
                    label="Bahan dari stok"
                    htmlFor="menu-stock-source"
                    hint="Nama dan resep satu satuan terisi otomatis. HPP berasal dari biaya rata-rata pembelian; masukkan harga jual secara terpisah."
                    required
                  >
                    <Select
                      id="menu-stock-source"
                      required
                      value={selectedStockId}
                      onChange={(event) => {
                        const item = inventory.find((entry) => entry.id === event.target.value);
                        setSelectedStockId(event.target.value);
                        if (item) {
                          setName(item.itemName);
                          setNewRecipeQuantities({ [item.id]: 1 });
                        }
                      }}
                    >
                      <option value="">Pilih bahan</option>
                      {inventory.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.itemName} · {item.currentStock} {item.unit} · HPP{' '}
                          {formatRupiah(item.averageUnitCost)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}

                <Field label="Nama menu" htmlFor="new-menu-name" required>
                  <Input
                    id="new-menu-name"
                    type="text"
                    required
                    maxLength={255}
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Es Jeruk Peras Segar"
                  />
                </Field>

                <Field label="Harga jual" htmlFor="new-menu-price" required>
                  <RupiahInput
                    id="new-menu-price"
                    value={price}
                    onValueChange={setPrice}
                    placeholder="0"
                  />
                </Field>

                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-2.5 text-sm font-medium text-text-primary">
                  <input
                    type="checkbox"
                    checked={isFeatured}
                    onChange={(e) => setIsFeatured(e.target.checked)}
                    className="h-5 w-5 rounded border-border-input accent-brand-primary"
                  />
                  <span>Tandai sebagai menu unggulan</span>
                </label>

                {menuSource === 'MANUAL' && inventory.length > 0 && (
                  <details className="rounded-xl border border-border-subtle p-3.5">
                    <summary className="flex min-h-11 cursor-pointer items-center rounded-lg px-1 text-sm font-semibold text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary">
                      Tambahkan bahan resep dari stok (opsional)
                    </summary>
                    <div className="mt-3 space-y-2.5">
                      {inventory.map((item) => (
                        <div key={item.id} className="flex items-center justify-between gap-3">
                          <Label htmlFor={`new-recipe-${item.id}`} className="min-w-0 flex-1">
                            {item.itemName} ({item.unit})
                          </Label>
                          <Input
                            id={`new-recipe-${item.id}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={100000}
                            value={newRecipeQuantities[item.id] ?? 0}
                            onChange={(event) =>
                              setNewRecipeQuantities((current) => ({
                                ...current,
                                [item.id]: Math.max(0, parseInt(event.target.value, 10) || 0),
                              }))
                            }
                            className="w-24 text-right font-mono tabular-nums"
                          />
                        </div>
                      ))}
                    </div>
                  </details>
                )}

                <Field
                  label="Foto menu (opsional)"
                  htmlFor="menu-image"
                  hint="Format PNG, JPEG, atau WebP."
                >
                  <input
                    id="menu-image"
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={(e) => handleSelectImageFile(e.target.files?.[0] ?? null)}
                    className="block min-h-11 w-full cursor-pointer rounded-lg border border-border-input bg-surface px-3 py-1.5 text-base text-text-primary file:mr-3 file:rounded-md file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-brand-primary hover:file:bg-brand-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                  />
                </Field>

                {imagePreviewUrl && (
                  <div className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface-muted p-2.5">
                    <img
                      src={imagePreviewUrl}
                      alt="Pratinjau foto menu baru"
                      className="h-14 w-14 shrink-0 rounded-lg border border-border-subtle object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-text-primary">
                        {imageFile?.name}
                      </p>
                      <p className="text-xs text-text-secondary">Siap diunggah</p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSelectImageFile(null)}
                      className="shrink-0 text-status-danger hover:bg-status-danger-bg hover:text-status-danger"
                    >
                      Hapus foto
                    </Button>
                  </div>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading}
                    onClick={() => setIsAddOpen(false)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={loading} isLoading={loading}>
                    Simpan menu
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
            label="Total menu"
            value={<AnimatedNumber value={menus.length} />}
            icon={UtensilsCrossed}
            tone="brand"
            hint="Terdaftar pada katalog warung"
          />
        </StaggerItem>
        <StaggerItem>
          <StatCard
            label="Menu tersedia"
            value={<AnimatedNumber value={availableCount} />}
            icon={CheckCircle2}
            tone="success"
            hint={`${menus.length - availableCount} menu sedang habis`}
          />
        </StaggerItem>
        <StaggerItem className="sm:col-span-2 lg:col-span-1">
          <StatCard
            label="Memiliki resep HPP"
            value={<AnimatedNumber value={recipeCosts.size} />}
            icon={BookOpen}
            tone="info"
            hint="Menu yang terhubung ke stok bahan"
          />
        </StaggerItem>
      </Stagger>

      <FilterBar
        actions={
          <Tabs
            value={availabilityFilter}
            onValueChange={(value) => setAvailabilityFilter(value as 'ALL' | 'AVAILABLE' | 'OUT')}
            className="w-auto"
          >
            <TabsList label="Filter status ketersediaan menu">
              <TabsTrigger value="ALL">Semua</TabsTrigger>
              <TabsTrigger value="AVAILABLE">Tersedia</TabsTrigger>
              <TabsTrigger value="OUT">Habis</TabsTrigger>
            </TabsList>
          </Tabs>
        }
      >
        <div className="relative w-full lg:w-80">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted"
          />
          <Input
            type="search"
            aria-label="Cari menu"
            placeholder="Cari nama menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </FilterBar>

      <FadeIn delay={0.08}>
        <Section
          title="Daftar menu"
          description={
            isDefaultOrderView
              ? 'Gunakan tombol panah untuk mengatur urutan tampil menu.'
              : 'Pengaturan urutan tersedia saat filter disetel ke Semua tanpa pencarian.'
          }
        >
          {filteredMenus.length === 0 ? (
            <EmptyState
              icon={UtensilsCrossed}
              title={menus.length === 0 ? 'Belum ada menu' : 'Menu tidak ditemukan'}
              description={
                menus.length === 0
                  ? 'Tambahkan menu pertama warung Anda untuk mencatat harga jual dan resep bahan.'
                  : 'Coba ubah filter status atau kata kunci pencarian.'
              }
              action={
                menus.length === 0 ? (
                  <Button type="button" onClick={() => setIsAddOpen(true)}>
                    <Plus aria-hidden="true" className="h-4 w-4" />
                    <span>Tambah menu</span>
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <div className="hidden lg:block">
                <TableContainer>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Urutan</TableHead>
                        <TableHead>Menu</TableHead>
                        <TableHead numeric>Harga jual</TableHead>
                        <TableHead>Estimasi HPP &amp; margin</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMenus.map((item, index) => {
                        const cost = recipeCosts.get(item.id);
                        const isBusy = busyMenuId === item.id;
                        return (
                          <TableRow
                            key={item.id}
                            className={!item.isAvailable ? 'bg-surface-muted/40' : undefined}
                          >
                            <TableCell className="w-24">
                              <div className="inline-flex items-center gap-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={!isDefaultOrderView || index === 0 || reordering}
                                  aria-label={`Naikkan urutan ${item.name}`}
                                  onClick={() => handleMove(index, 'up')}
                                >
                                  <ChevronUp aria-hidden="true" className="h-4 w-4" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  disabled={
                                    !isDefaultOrderView ||
                                    index === filteredMenus.length - 1 ||
                                    reordering
                                  }
                                  aria-label={`Turunkan urutan ${item.name}`}
                                  onClick={() => handleMove(index, 'down')}
                                >
                                  <ChevronDown aria-hidden="true" className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <label
                                  className="relative inline-flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-muted text-text-secondary transition-colors hover:border-brand-primary focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2"
                                  title="Ganti foto menu"
                                >
                                  {item.imageUrl ? (
                                    <img
                                      src={item.imageUrl}
                                      alt={`Foto ${item.name}`}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
                                  )}
                                  <input
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    aria-label={`Ganti foto ${item.name}`}
                                    disabled={isBusy}
                                    onChange={(e) =>
                                      void handleReplaceImage(item.id, e.target.files?.[0])
                                    }
                                    className="sr-only"
                                  />
                                </label>
                                <div className="min-w-0 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-semibold text-text-primary">
                                      {item.name}
                                    </span>
                                    {item.isFeatured && (
                                      <Badge variant="brand">
                                        <Star aria-hidden="true" className="h-3.5 w-3.5" />
                                        <span>Unggulan</span>
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-text-secondary">
                                    Klik foto untuk mengganti gambar
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell numeric className="font-bold">
                              {formatRupiah(item.price)}
                            </TableCell>
                            <TableCell className="text-xs text-text-secondary">
                              {cost ? (
                                cost.complete ? (
                                  <div className="space-y-0.5">
                                    <p className="font-mono tabular-nums text-text-primary">
                                      HPP: {formatRupiah(cost.amount)}
                                    </p>
                                    <p className="font-mono tabular-nums text-status-success">
                                      Margin: {formatRupiah(item.price - cost.amount)}
                                    </p>
                                  </div>
                                ) : (
                                  <span>HPP belum lengkap (isi harga beli di Stok)</span>
                                )
                              ) : (
                                <span>Resep belum diatur</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <button
                                type="button"
                                aria-pressed={item.isAvailable}
                                aria-label={`Ubah status ketersediaan ${item.name}, saat ini ${item.isAvailable ? 'tersedia' : 'habis'}`}
                                disabled={isBusy}
                                onClick={() => handleToggleAvailable(item.id, item.isAvailable)}
                                className="inline-flex min-h-11 items-center rounded-xl px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                              >
                                <Badge variant={item.isAvailable ? 'success' : 'muted'}>
                                  {item.isAvailable ? (
                                    <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                                  ) : (
                                    <MinusCircle aria-hidden="true" className="h-3.5 w-3.5" />
                                  )}
                                  <span>{item.isAvailable ? 'Tersedia' : 'Habis'}</span>
                                </Badge>
                              </button>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="inline-flex items-center justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => openRecipe(item.id)}
                                >
                                  <BookOpen aria-hidden="true" className="h-4 w-4" />
                                  <span>Resep</span>
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={`Ubah menu ${item.name}`}
                                  onClick={() => handleOpenEdit(item)}
                                >
                                  <Pencil aria-hidden="true" className="h-4 w-4" />
                                  <span>Ubah</span>
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

              <div className="space-y-3 lg:hidden">
                {filteredMenus.map((item, index) => {
                  const cost = recipeCosts.get(item.id);
                  const isBusy = busyMenuId === item.id;
                  return (
                    <Card
                      key={item.id}
                      className={!item.isAvailable ? 'bg-surface-muted/60' : undefined}
                    >
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start gap-3">
                          {isDefaultOrderView && (
                            <div className="flex flex-col gap-1 shrink-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={index === 0 || reordering}
                                aria-label={`Naikkan urutan ${item.name}`}
                                onClick={() => handleMove(index, 'up')}
                              >
                                <ChevronUp aria-hidden="true" className="h-4 w-4" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                disabled={index === filteredMenus.length - 1 || reordering}
                                aria-label={`Turunkan urutan ${item.name}`}
                                onClick={() => handleMove(index, 'down')}
                              >
                                <ChevronDown aria-hidden="true" className="h-4 w-4" />
                              </Button>
                            </div>
                          )}

                          <label
                            className="relative inline-flex h-14 w-14 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl border border-border-subtle bg-surface-muted text-text-secondary focus-within:ring-2 focus-within:ring-brand-primary focus-within:ring-offset-2"
                            title="Ganti foto menu"
                          >
                            {item.imageUrl ? (
                              <img
                                src={item.imageUrl}
                                alt={`Foto ${item.name}`}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UtensilsCrossed aria-hidden="true" className="h-5 w-5" />
                            )}
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              aria-label={`Ganti foto ${item.name}`}
                              disabled={isBusy}
                              onChange={(e) =>
                                void handleReplaceImage(item.id, e.target.files?.[0])
                              }
                              className="sr-only"
                            />
                          </label>

                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="truncate text-sm font-bold text-text-primary">
                                {item.name}
                              </p>
                              {item.isFeatured && (
                                <Badge variant="brand">
                                  <Star aria-hidden="true" className="h-3.5 w-3.5" />
                                  <span>Unggulan</span>
                                </Badge>
                              )}
                            </div>
                            <p className="font-mono text-sm font-bold text-text-primary tabular-nums">
                              {formatRupiah(item.price)}
                            </p>
                            {cost && (
                              <p className="text-xs text-text-secondary">
                                {cost.complete
                                  ? `HPP ${formatRupiah(cost.amount)} · Margin ${formatRupiah(item.price - cost.amount)}`
                                  : 'HPP bahan belum lengkap'}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3">
                          <button
                            type="button"
                            aria-pressed={item.isAvailable}
                            aria-label={`Ubah status ketersediaan ${item.name}, saat ini ${item.isAvailable ? 'tersedia' : 'habis'}`}
                            disabled={isBusy}
                            onClick={() => handleToggleAvailable(item.id, item.isAvailable)}
                            className="inline-flex min-h-11 items-center rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
                          >
                            <Badge variant={item.isAvailable ? 'success' : 'muted'}>
                              {item.isAvailable ? (
                                <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />
                              ) : (
                                <MinusCircle aria-hidden="true" className="h-3.5 w-3.5" />
                              )}
                              <span>{item.isAvailable ? 'Tersedia' : 'Habis'}</span>
                            </Badge>
                          </button>

                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="secondary"
                              size="sm"
                              onClick={() => openRecipe(item.id)}
                            >
                              <BookOpen aria-hidden="true" className="h-4 w-4" />
                              <span>Resep</span>
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-label={`Ubah menu ${item.name}`}
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Pencil aria-hidden="true" className="h-4 w-4" />
                              <span>Ubah</span>
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </Section>
      </FadeIn>

      <Dialog
        open={editingMenu !== null}
        onOpenChange={(open) => {
          if (!open && !editBusy) setEditingMenu(null);
        }}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Ubah detail menu</DialogTitle>
            <DialogDescription>
              Perbarui nama, harga jual, atau status menu unggulan.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-4" noValidate>
            {editError && <Alert variant="danger">{editError}</Alert>}

            <Field label="Nama menu" htmlFor="edit-menu-name" required>
              <Input
                id="edit-menu-name"
                type="text"
                required
                maxLength={255}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </Field>

            <Field label="Harga jual" htmlFor="edit-menu-price" required>
              <RupiahInput id="edit-menu-price" value={editPrice} onValueChange={setEditPrice} />
            </Field>

            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-border-subtle bg-surface-muted/60 px-3.5 py-2.5 text-sm font-medium text-text-primary">
              <input
                type="checkbox"
                checked={editFeatured}
                onChange={(e) => setEditFeatured(e.target.checked)}
                className="h-5 w-5 rounded border-border-input accent-brand-primary"
              />
              <span>Tandai sebagai menu unggulan</span>
            </label>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                disabled={editBusy}
                onClick={() => setEditingMenu(null)}
              >
                Batal
              </Button>
              <Button type="submit" disabled={editBusy} isLoading={editBusy}>
                Simpan perubahan
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={recipeMenuId !== null}
        onOpenChange={(open) => {
          if (!open && !recipeBusy) setRecipeMenuId(null);
        }}
      >
        <DialogContent size="md">
          <DialogHeader>
            <DialogTitle>
              Resep bahan{recipeMenu ? `: ${recipeMenu.name}` : ''}
            </DialogTitle>
            <DialogDescription>
              Isi kebutuhan bahan per satu porsi. Angka 0 berarti bahan tidak dipakai.
            </DialogDescription>
          </DialogHeader>

          {inventory.length === 0 ? (
            <EmptyState
              compact
              icon={BookOpen}
              title="Belum ada bahan baku"
              description="Tambahkan bahan terlebih dahulu di halaman Stok bahan."
            />
          ) : (
            <form onSubmit={saveRecipe} className="space-y-4">
              {recipeError && <Alert variant="danger">{recipeError}</Alert>}

              <div className="max-h-72 space-y-2.5 overflow-y-auto pr-1">
                {inventory.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-surface px-3 py-2"
                  >
                    <Label htmlFor={`recipe-item-${item.id}`} className="min-w-0 flex-1">
                      <span className="block truncate">{item.itemName}</span>
                      <span className="block text-xs font-normal text-text-secondary">
                        Satuan: {item.unit}
                        {item.averageUnitCost > 0
                          ? ` · ${formatRupiah(item.averageUnitCost)}/${item.unit}`
                          : ''}
                      </span>
                    </Label>
                    <Input
                      id={`recipe-item-${item.id}`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      max={100000}
                      value={recipeQuantities[item.id] ?? 0}
                      onChange={(e) =>
                        setRecipeQuantities((current) => ({
                          ...current,
                          [item.id]: Math.max(0, parseInt(e.target.value, 10) || 0),
                        }))
                      }
                      className="w-24 text-right font-mono tabular-nums"
                    />
                  </div>
                ))}
              </div>

              {liveRecipeCost.count > 0 && recipeMenu && (
                <div className="rounded-xl border border-border-subtle bg-surface-muted p-3.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-text-secondary">Estimasi HPP bahan</span>
                    <span className="font-mono font-bold text-text-primary tabular-nums">
                      {liveRecipeCost.complete
                        ? formatRupiah(liveRecipeCost.total)
                        : 'Belum lengkap'}
                    </span>
                  </div>
                  {liveRecipeCost.complete && (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-text-secondary">Estimasi margin kotor</span>
                      <span
                        className={cn(
                          'font-mono font-bold tabular-nums',
                          recipeMenu.price - liveRecipeCost.total >= 0
                            ? 'text-status-success'
                            : 'text-status-danger'
                        )}
                      >
                        {formatRupiah(recipeMenu.price - liveRecipeCost.total)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={recipeBusy}
                  onClick={() => setRecipeMenuId(null)}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={recipeBusy} isLoading={recipeBusy}>
                  Simpan resep
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </PageTransition>
  );
}
