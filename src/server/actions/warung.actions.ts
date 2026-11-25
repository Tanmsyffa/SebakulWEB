'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { eq, and, desc, sql, gte, lte, lt, inArray } from 'drizzle-orm';
import { db } from '@/db';
import {
  warungTransactions,
  warungInventory,
  warungMenus,
  warungMenuRecipes,
  warungSuppliers,
  warungPurchases,
  warungPurchaseItems,
  warungInventoryMovements,
  invoices,
  warungs,
} from '@/db/schema';
import { requireWarungPermission } from '@/server/guards/auth-guard';
import { getJakartaDayRange } from '@/lib/utils/date';
import {
  createTransactionSchema,
  type CreateTransactionInput,
  updateInventorySchema,
  type UpdateInventoryInput,
  createMenuItemSchema,
  updateMenuItemSchema,
  type CreateMenuItemInput,
} from '@/lib/validations/warung.schema';

function assertMenuImageUrl(imageUrl: string | null | undefined, warungId: string) {
  if (!imageUrl) return;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) throw new Error('Konfigurasi penyimpanan foto belum lengkap');
  const image = new URL(imageUrl);
  const pattern = new RegExp(
    `^/storage/v1/object/public/menu-images/${warungId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg|png)$`,
    'i',
  );
  if (image.origin !== new URL(base).origin || !pattern.test(image.pathname)) {
    throw new Error('URL foto menu tidak valid');
  }
}

// ─── 1. KAS WARUNG (TRANSACTIONS) ───────────────────────────

export async function createWarungTransaction(input: CreateTransactionInput) {
  const { warungId, userId } = await requireWarungPermission('owner');
  const validated = createTransactionSchema.parse(input);

  const [newTx] = await db
    .insert(warungTransactions)
    .values({
      idempotencyKey: validated.idempotencyKey,
      warungId,
      type: validated.type,
      category: validated.category,
      amount: Math.round(validated.amount),
      notes: validated.notes || null,
      recordedBy: userId,
      transactionDate: validated.transactionDate
        ? new Date(validated.transactionDate)
        : new Date(),
    })
    .onConflictDoNothing({ target: warungTransactions.idempotencyKey })
    .returning();

  revalidatePath('/warung');
  revalidatePath('/warung/kas');
  revalidatePath('/warung/laporan');

  return { success: true, transaction: newTx };
}

export async function getWarungTransactions(options?: {
  type?: 'INCOME' | 'EXPENSE';
  startDate?: string;
  endDate?: string;
  limit?: number;
}) {
  const { warungId } = await requireWarungPermission('owner');
  const parsed = z.object({
    type: z.enum(['INCOME', 'EXPENSE']).optional(),
    startDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Tanggal mulai tidak valid').optional(),
    endDate: z.string().refine((value) => !Number.isNaN(Date.parse(value)), 'Tanggal akhir tidak valid').optional(),
    limit: z.number().int().min(1).max(500).optional(),
  }).parse(options ?? {});

  const conditions = [eq(warungTransactions.warungId, warungId)];

  if (parsed.type) {
    conditions.push(eq(warungTransactions.type, parsed.type));
  }
  if (parsed.startDate) {
    conditions.push(gte(warungTransactions.transactionDate, new Date(parsed.startDate)));
  }
  if (parsed.endDate) {
    conditions.push(lte(warungTransactions.transactionDate, new Date(parsed.endDate)));
  }

  const txs = await db
    .select()
    .from(warungTransactions)
    .where(and(...conditions))
    .orderBy(desc(warungTransactions.transactionDate))
    .limit(parsed.limit ?? 100);

  return txs;
}

const reportPeriodSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).superRefine((value, ctx) => {
  const start = Date.parse(`${value.startDate}T00:00:00+07:00`);
  const end = Date.parse(`${value.endDate}T00:00:00+07:00`);
  const startIso = Number.isFinite(start) ? new Date(start + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
  const endIso = Number.isFinite(end) ? new Date(end + 7 * 60 * 60 * 1000).toISOString().slice(0, 10) : '';
  if (!Number.isFinite(start) || !Number.isFinite(end) || startIso !== value.startDate || endIso !== value.endDate || start > end) ctx.addIssue({ code: 'custom', message: 'Rentang tanggal tidak valid' });
  else if (end - start > 366 * 24 * 60 * 60 * 1000) ctx.addIssue({ code: 'custom', message: 'Rentang laporan maksimal 1 tahun' });
});

export async function getWarungPeriodReport(input: { startDate: string; endDate: string }) {
  const { warungId } = await requireWarungPermission('owner');
  const { startDate, endDate } = reportPeriodSchema.parse(input);
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const endExclusive = new Date(`${endDate}T00:00:00+07:00`);
  endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
  const rows = await db.select({
    type: warungTransactions.type,
    category: warungTransactions.category,
    total: sql<number>`COALESCE(SUM(${warungTransactions.amount}), 0)`,
    count: sql<number>`COUNT(*)`,
  }).from(warungTransactions).where(and(
    eq(warungTransactions.warungId, warungId),
    gte(warungTransactions.transactionDate, start),
    lt(warungTransactions.transactionDate, endExclusive)
  )).groupBy(warungTransactions.type, warungTransactions.category).orderBy(warungTransactions.type, warungTransactions.category);
  const income = rows.filter(row => row.type === 'INCOME').reduce((total, row) => total + Number(row.total), 0);
  const expense = rows.filter(row => row.type === 'EXPENSE').reduce((total, row) => total + Number(row.total), 0);
  return { startDate, endDate, income, expense, net: income - expense, rows: rows.map(row => ({ ...row, total: Number(row.total), count: Number(row.count) })) };
}

export async function getWarungDashboard() {
  const { warungId } = await requireWarungPermission('owner');

  const { start: startOfToday, end: endOfToday } = getJakartaDayRange();
  const sevenDaysAgo = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  // Run all 5 independent dashboard queries concurrently in a single round-trip
  const [todayTxs, pastWeekTxs, lowStockItems, warungRows, inventoryCountRows] = await Promise.all([
    db
      .select({
        type: warungTransactions.type,
        total: sql<number>`COALESCE(SUM(${warungTransactions.amount}), 0)`,
      })
      .from(warungTransactions)
      .where(
        and(
          eq(warungTransactions.warungId, warungId),
          gte(warungTransactions.transactionDate, startOfToday),
          lt(warungTransactions.transactionDate, endOfToday)
        )
      )
      .groupBy(warungTransactions.type),
    db
      .select({
        type: warungTransactions.type,
        amount: warungTransactions.amount,
        transactionDate: warungTransactions.transactionDate,
      })
      .from(warungTransactions)
      .where(
        and(
          eq(warungTransactions.warungId, warungId),
          gte(warungTransactions.transactionDate, sevenDaysAgo)
        )
      )
      .orderBy(warungTransactions.transactionDate),
    db
      .select()
      .from(warungInventory)
      .where(
        and(
          eq(warungInventory.warungId, warungId),
          sql`${warungInventory.currentStock} <= ${warungInventory.minThreshold}`
        )
      )
      .limit(10),
    db
      .select()
      .from(warungs)
      .where(eq(warungs.id, warungId))
      .limit(1),
    db
      .select({ total: sql<number>`count(*)::int` })
      .from(warungInventory)
      .where(eq(warungInventory.warungId, warungId)),
  ]);

  let todayIncome = 0;
  let todayExpense = 0;
  for (const item of todayTxs) {
    if (item.type === 'INCOME') todayIncome = Number(item.total);
    if (item.type === 'EXPENSE') todayExpense = Number(item.total);
  }
  const todayProfit = todayIncome - todayExpense;

  // Group by day name
  const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  const chartMap: Record<string, { income: number; expense: number; date: string }> = {};

  for (let i = 6; i >= 0; i--) {
    const d = new Date(startOfToday.getTime() - i * 24 * 60 * 60 * 1000 + 7 * 60 * 60 * 1000);
    const dayKey = dayNames[d.getUTCDay()];
    chartMap[dayKey] = {
      date: dayKey,
      income: 0,
      expense: 0,
    };
  }

  for (const tx of pastWeekTxs) {
    const dayKey = dayNames[new Date(tx.transactionDate.getTime() + 7 * 60 * 60 * 1000).getUTCDay()];
    if (chartMap[dayKey]) {
      if (tx.type === 'INCOME') chartMap[dayKey].income += tx.amount;
      if (tx.type === 'EXPENSE') chartMap[dayKey].expense += tx.amount;
    }
  }

  const [warung] = warungRows;

  return {
    warung,
    todayIncome,
    todayExpense,
    todayProfit,
    cashflowChart: Object.values(chartMap),
    lowStockItems,
    inventoryCount: Number(inventoryCountRows[0]?.total ?? 0),
  };
}

// ─── 2. STOK BAHAN BAKU (INVENTORY) ─────────────────────────

export async function getWarungInventory() {
  const { warungId } = await requireWarungPermission('stock');

  return await db
    .select()
    .from(warungInventory)
    .where(eq(warungInventory.warungId, warungId))
    .orderBy(warungInventory.itemName);
}

export async function getWarungInventoryMovements() {
  const { warungId } = await requireWarungPermission('stock');
  return db.select({ id: warungInventoryMovements.id, itemName: warungInventory.itemName, movementType: warungInventoryMovements.movementType, quantityDelta: warungInventoryMovements.quantityDelta, balanceAfter: warungInventoryMovements.balanceAfter, notes: warungInventoryMovements.notes, createdAt: warungInventoryMovements.createdAt })
    .from(warungInventoryMovements).innerJoin(warungInventory, eq(warungInventory.id, warungInventoryMovements.inventoryId))
    .where(eq(warungInventoryMovements.warungId, warungId)).orderBy(desc(warungInventoryMovements.createdAt)).limit(30);
}

export async function createInventoryItem(input: UpdateInventoryInput) {
  const { warungId } = await requireWarungPermission('stock');
  const validated = updateInventorySchema.parse(input);

  const [item] = await db
    .insert(warungInventory)
    .values({
      warungId,
      itemName: validated.itemName,
      unit: validated.unit,
      currentStock: validated.currentStock,
      minThreshold: validated.minThreshold ?? 5,
    })
    .returning();

  revalidatePath('/warung/stok');
  revalidatePath('/warung');
  return { success: true, item };
}

export async function updateInventoryStocks(items: { id: string; currentStock: number }[]) {
  const { warungId, userId } = await requireWarungPermission('stock');
  const data = z.array(z.object({ id: z.string().uuid(), currentStock: z.number().int().min(0).max(1_000_000) }))
    .min(1).max(500).parse(items);
  if (new Set(data.map(item => item.id)).size !== data.length) throw new Error('Daftar stok mengandung item ganda');
  const itemIds = data.map(item => item.id);
  const cases = sql.join(data.map(item => sql`WHEN ${item.id}::uuid THEN ${item.currentStock}`), sql` `);
  await db.transaction(async tx => {
    const previous = await tx.select({ id: warungInventory.id, currentStock: warungInventory.currentStock }).from(warungInventory)
      .where(and(eq(warungInventory.warungId, warungId), inArray(warungInventory.id, itemIds)))
      .orderBy(warungInventory.id).for('update');
    if (previous.length !== data.length) throw new Error('Sebagian bahan tidak ditemukan pada warung ini. Muat ulang lalu coba lagi.');
    await tx.update(warungInventory).set({ currentStock: sql`CASE ${warungInventory.id} ${cases} ELSE ${warungInventory.currentStock} END`, updatedAt: new Date() })
      .where(and(eq(warungInventory.warungId, warungId), inArray(warungInventory.id, itemIds)));
    const oldStocks = new Map(previous.map(item => [item.id, item.currentStock]));
    const movements = data.map(item => ({ inventoryId: item.id, delta: item.currentStock - (oldStocks.get(item.id) ?? 0), balanceAfter: item.currentStock }))
      .filter(item => item.delta !== 0);
    if (movements.length) await tx.insert(warungInventoryMovements).values(movements.map(item => ({ warungId, inventoryId: item.inventoryId, movementType: 'ADJUSTMENT', quantityDelta: item.delta, balanceAfter: item.balanceAfter, notes: 'Penyesuaian stok / opname', recordedBy: userId })));
  });

  revalidatePath('/warung/stok');
  revalidatePath('/warung');
  return { success: true };
}

const supplierInputSchema = z.object({ name: z.string().trim().min(2).max(120), contact: z.string().trim().max(120).nullish() });

export async function getWarungPurchasingData() {
  const { warungId } = await requireWarungPermission('stock');
  const [suppliers, purchases] = await Promise.all([
    db.select().from(warungSuppliers).where(and(eq(warungSuppliers.warungId, warungId), eq(warungSuppliers.isActive, true))).orderBy(warungSuppliers.name),
    db.select().from(warungPurchases).where(eq(warungPurchases.warungId, warungId)).orderBy(desc(warungPurchases.purchasedAt)).limit(30),
  ]);
  return { suppliers, purchases };
}

export async function createWarungSupplier(input: z.input<typeof supplierInputSchema>) {
  const { warungId } = await requireWarungPermission('stock');
  const data = supplierInputSchema.parse(input);
  const [supplier] = await db.insert(warungSuppliers).values({ warungId, name: data.name, contact: data.contact || null }).returning();
  revalidatePath('/warung/stok');
  return { success: true, supplier };
}

export async function deleteWarungSupplier(supplierId: string) {
  const { warungId } = await requireWarungPermission('stock');
  const id = z.string().uuid().parse(supplierId);
  const [supplier] = await db.update(warungSuppliers)
    .set({ isActive: false })
    .where(and(eq(warungSuppliers.id, id), eq(warungSuppliers.warungId, warungId), eq(warungSuppliers.isActive, true)))
    .returning({ id: warungSuppliers.id });
  if (!supplier) throw new Error('Pemasok tidak ditemukan atau sudah dihapus.');
  revalidatePath('/warung/stok');
  return { success: true };
}

const purchaseInputSchema = z.object({
  supplierId: z.string().uuid().nullable(),
  notes: z.string().trim().max(500).nullish(),
  items: z.array(z.object({
    inventoryId: z.string().uuid(),
    quantity: z.number().int().positive().max(100_000),
    unitCost: z.number().int().positive('Harga satuan harus lebih dari Rp0.').max(999_999_999),
  })).min(1).max(100),
});

export async function receiveWarungPurchase(input: z.input<typeof purchaseInputSchema>) {
  const { warungId, userId } = await requireWarungPermission('stock');
  const data = purchaseInputSchema.parse(input);
  const ids = data.items.map(item => item.inventoryId);
  if (new Set(ids).size !== ids.length) throw new Error('Bahan tidak boleh dicatat dua kali dalam satu pembelian.');
  const totalBig = data.items.reduce((total, item) => total + BigInt(item.quantity) * BigInt(item.unitCost), BigInt(0));
  if (totalBig <= BigInt(0) || totalBig > BigInt(999_999_999)) throw new Error('Total pembelian tidak valid.');
  const totalAmount = Number(totalBig);

  await db.transaction(async tx => {
    if (data.supplierId) {
      const [supplier] = await tx.select({ id: warungSuppliers.id }).from(warungSuppliers).where(and(eq(warungSuppliers.id, data.supplierId), eq(warungSuppliers.warungId, warungId), eq(warungSuppliers.isActive, true))).limit(1);
      if (!supplier) throw new Error('Pemasok tidak ditemukan pada warung ini.');
    }
    const inventory = await tx.select({ id: warungInventory.id, currentStock: warungInventory.currentStock, averageUnitCost: warungInventory.averageUnitCost }).from(warungInventory)
      .where(and(eq(warungInventory.warungId, warungId), inArray(warungInventory.id, ids))).orderBy(warungInventory.id).for('update');
    if (inventory.length !== ids.length) throw new Error('Bahan tidak ditemukan pada warung ini. Muat ulang lalu coba lagi.');
    const [purchase] = await tx.insert(warungPurchases).values({ warungId, supplierId: data.supplierId, totalAmount, notes: data.notes || null, recordedBy: userId }).returning({ id: warungPurchases.id });
    await tx.insert(warungPurchaseItems).values(data.items.map(item => ({ purchaseId: purchase.id, inventoryId: item.inventoryId, quantity: item.quantity, unitCost: item.unitCost, lineTotal: item.quantity * item.unitCost })));
    const inventoryById = new Map(inventory.map(item => [item.id, item]));
    for (const item of data.items) {
      const current = inventoryById.get(item.inventoryId)!;
      const nextStock = current.currentStock + item.quantity;
      const averageUnitCost = current.currentStock > 0
        ? Number((BigInt(current.currentStock) * BigInt(current.averageUnitCost) + BigInt(item.quantity) * BigInt(item.unitCost) + BigInt(nextStock) / BigInt(2)) / BigInt(nextStock))
        : item.unitCost;
      if (!Number.isSafeInteger(nextStock) || nextStock > 2_000_000_000 || !Number.isSafeInteger(averageUnitCost)) throw new Error('Jumlah stok atau harga rata-rata melampaui batas.');
      await tx.update(warungInventory).set({ currentStock: nextStock, averageUnitCost, updatedAt: new Date() }).where(and(eq(warungInventory.id, item.inventoryId), eq(warungInventory.warungId, warungId)));
      await tx.insert(warungInventoryMovements).values({ warungId, inventoryId: item.inventoryId, movementType: 'PURCHASE', quantityDelta: item.quantity, balanceAfter: nextStock, notes: data.notes || 'Penerimaan pembelian', recordedBy: userId });
    }
    await tx.insert(warungTransactions).values({ idempotencyKey: randomUUID(), warungId, type: 'EXPENSE', category: 'BELANJA_BAHAN', amount: totalAmount, notes: data.notes || 'Pembelian stok', recordedBy: userId });
  });
  revalidatePath('/warung/stok'); revalidatePath('/warung/kas'); revalidatePath('/warung/laporan'); revalidatePath('/warung');
  return { success: true };
}

// ─── 3. SEWA LAPAK & BUKTI BAYAR ────────────────────────────

export async function getWarungInvoices() {
  const { warungId } = await requireWarungPermission('owner');

  return await db
    .select()
    .from(invoices)
    .where(eq(invoices.warungId, warungId))
    .orderBy(desc(invoices.createdAt));
}

// ─── 4. KATALOG MENU QR ─────────────────────────────────────

export async function getWarungMenuPageData() {
  const { warungId } = await requireWarungPermission('stock');
  const [menus, inventory, recipes, [warung]] = await Promise.all([
    db.select().from(warungMenus).where(eq(warungMenus.warungId, warungId)).orderBy(warungMenus.sortOrder, warungMenus.name),
    db.select().from(warungInventory).where(eq(warungInventory.warungId, warungId)).orderBy(warungInventory.itemName),
    db.select({ menuId: warungMenuRecipes.menuId, inventoryId: warungMenuRecipes.inventoryId, itemName: warungInventory.itemName, averageUnitCost: warungInventory.averageUnitCost, quantity: warungMenuRecipes.quantity }).from(warungMenuRecipes).innerJoin(warungInventory, eq(warungInventory.id, warungMenuRecipes.inventoryId)).where(eq(warungMenuRecipes.warungId, warungId)),
    db.select({ slug: warungs.slug }).from(warungs).where(eq(warungs.id, warungId)).limit(1),
  ]);
  return { menus, inventory, recipes, slug: warung?.slug ?? 'warung' };
}

export async function saveWarungMenuRecipe(menuId: string, ingredients: { inventoryId: string; quantity: number }[]) {
  const { warungId } = await requireWarungPermission('stock');
  const id = z.string().uuid().parse(menuId);
  const data = z.array(z.object({ inventoryId: z.string().uuid(), quantity: z.number().int().positive().max(100_000) })).max(100).parse(ingredients);
  if (new Set(data.map(item => item.inventoryId)).size !== data.length) throw new Error('Bahan resep tidak boleh ganda.');
  await db.transaction(async tx => {
    const [menu] = await tx.select({ id: warungMenus.id }).from(warungMenus).where(and(eq(warungMenus.id, id), eq(warungMenus.warungId, warungId))).limit(1);
    if (!menu) throw new Error('Menu tidak ditemukan pada warung ini.');
    if (data.length) {
      const items = await tx.select({ id: warungInventory.id }).from(warungInventory).where(and(eq(warungInventory.warungId, warungId), inArray(warungInventory.id, data.map(item => item.inventoryId))));
      if (items.length !== data.length) throw new Error('Bahan resep tidak ditemukan pada warung ini.');
    }
    await tx.delete(warungMenuRecipes).where(and(eq(warungMenuRecipes.menuId, id), eq(warungMenuRecipes.warungId, warungId)));
    if (data.length) await tx.insert(warungMenuRecipes).values(data.map(item => ({ warungId, menuId: id, ...item })));
  });
  revalidatePath('/warung/menu');
  return { success: true };
}

export async function createMenuItem(input: CreateMenuItemInput) {
  const { warungId } = await requireWarungPermission('stock');
  const validated = createMenuItemSchema.parse(input);
  assertMenuImageUrl(validated.imageUrl, warungId);

  const ingredients = validated.recipeIngredients ?? [];
  if (new Set(ingredients.map(item => item.inventoryId)).size !== ingredients.length) throw new Error('Bahan resep tidak boleh ganda.');
  const menu = await db.transaction(async tx => {
    if (ingredients.length) {
      const ownedIngredients = await tx.select({ id: warungInventory.id }).from(warungInventory)
        .where(and(eq(warungInventory.warungId, warungId), inArray(warungInventory.id, ingredients.map(item => item.inventoryId))));
      if (ownedIngredients.length !== ingredients.length) throw new Error('Bahan resep tidak ditemukan pada warung ini.');
    }
    const [created] = await tx
    .insert(warungMenus)
    .values({
      warungId,
      name: validated.name,
      price: Math.round(validated.price),
      imageUrl: validated.imageUrl || null,
      isAvailable: validated.isAvailable ?? true,
      isFeatured: validated.isFeatured ?? false,
      sortOrder: validated.sortOrder ?? 0,
    })
    .returning();
    if (ingredients.length) await tx.insert(warungMenuRecipes).values(ingredients.map(ingredient => ({ warungId, menuId: created.id, ...ingredient })));
    return created;
  });

  revalidatePath('/warung/menu');
  return { success: true, menu };
}

export async function updateMenuItem(
  id: string,
  input: Partial<CreateMenuItemInput>
) {
  const { warungId } = await requireWarungPermission('stock');
  const menuId = z.string().uuid().parse(id);
  const validated = updateMenuItemSchema.omit({ id: true, description: true }).parse(input);
  assertMenuImageUrl(validated.imageUrl, warungId);

  const [updated] = await db
    .update(warungMenus)
    .set({
      ...validated,
      updatedAt: new Date(),
    })
    .where(and(eq(warungMenus.id, menuId), eq(warungMenus.warungId, warungId)))
    .returning({ id: warungMenus.id });

  if (!updated) throw new Error('Menu tidak ditemukan pada warung ini.');

  revalidatePath('/warung/menu');
  return { success: true };
}

export async function updateMenuSortOrder(items: { id: string; sortOrder: number }[]) {
  const { warungId } = await requireWarungPermission('stock');
  const data = z.array(z.object({
    id: z.string().uuid(),
    sortOrder: z.number().int().min(0).max(1_000_000),
  })).min(1).max(500).parse(items);
  if (new Set(data.map(item => item.id)).size !== data.length) {
    throw new Error('Urutan menu tidak valid');
  }

  const itemIds = data.map(item => item.id);
  const cases = sql.join(data.map(item => sql`WHEN ${item.id}::uuid THEN ${item.sortOrder}`), sql` `);
  await db.transaction(async (tx) => {
    const owned = await tx.select({ id: warungMenus.id }).from(warungMenus)
      .where(and(eq(warungMenus.warungId, warungId), inArray(warungMenus.id, itemIds)))
      .orderBy(warungMenus.id)
      .for('update');
    if (owned.length !== data.length) {
      throw new Error('Sebagian menu tidak ditemukan pada warung ini.');
    }
    await tx.update(warungMenus)
      .set({ sortOrder: sql`CASE ${warungMenus.id} ${cases} ELSE ${warungMenus.sortOrder} END`, updatedAt: new Date() })
      .where(and(eq(warungMenus.warungId, warungId), inArray(warungMenus.id, itemIds)));
  });

  revalidatePath('/warung/menu');
  return { success: true };
}

export async function toggleWarungOpen() {
  const { warungId } = await requireWarungPermission('owner');

  const [current] = await db
    .select({ isOpenToday: warungs.isOpenToday })
    .from(warungs)
    .where(eq(warungs.id, warungId))
    .limit(1);

  if (current) {
    await db
      .update(warungs)
      .set({ isOpenToday: !current.isOpenToday })
      .where(eq(warungs.id, warungId));
    revalidatePath('/warung');
  }

  return { success: true };
}

