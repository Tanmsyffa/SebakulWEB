import { z } from "zod";

/**
 * Schema for creating a warung transaction (kas warung).
 * Requires UUID v4 idempotency key for dedup.
 */
export const createTransactionSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid("Idempotency key harus berupa UUID v4"),
  type: z.enum(["INCOME", "EXPENSE"], {
    error: "Tipe transaksi harus dipilih",
  }),
  category: z
    .string()
    .trim()
    .min(1, "Kategori wajib diisi")
    .max(100, "Kategori maksimal 100 karakter"),
  amount: z
    .number({ error: "Jumlah wajib diisi" })
    .int("Jumlah harus bilangan bulat")
    .positive("Jumlah harus lebih dari 0")
    .max(999_999_999, "Jumlah terlalu besar"),
  notes: z
    .string()
    .trim()
    .max(500, "Catatan maksimal 500 karakter")
    .optional(),
  transactionDate: z
    .string()
    .datetime("Format tanggal tidak valid")
    .optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

/**
 * Schema for updating inventory stock.
 */
export const updateInventorySchema = z.object({
  itemName: z
    .string()
    .trim()
    .min(1, "Nama barang wajib diisi")
    .max(255, "Nama barang maksimal 255 karakter"),
  unit: z
    .string()
    .trim()
    .min(1, "Satuan wajib diisi")
    .max(50, "Satuan maksimal 50 karakter"),
  currentStock: z
    .number({ error: "Stok saat ini wajib diisi" })
    .int("Stok harus bilangan bulat")
    .min(0, "Stok tidak boleh negatif")
    .max(1_000_000, "Stok maksimal 1.000.000"),
  minThreshold: z
    .number()
    .int("Batas minimum harus bilangan bulat")
    .min(0, "Batas minimum tidak boleh negatif")
    .max(1_000_000, "Batas minimum maksimal 1.000.000")
    .default(0),
});

export type UpdateInventoryInput = z.infer<typeof updateInventorySchema>;

/**
 * Schema for creating a menu item.
 */
export const createMenuItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama menu wajib diisi")
    .max(255, "Nama menu maksimal 255 karakter"),
  description: z
    .string()
    .trim()
    .max(500, "Deskripsi maksimal 500 karakter")
    .optional(),
  price: z
    .number({ error: "Harga wajib diisi" })
    .int("Harga harus bilangan bulat")
    .positive("Harga harus lebih dari 0")
    .max(999_999_999, "Harga terlalu besar"),
  imageUrl: z.string().url("URL gambar tidak valid").optional().nullable(),
  isAvailable: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(1_000_000).default(0),
  recipeIngredients: z.array(z.object({ inventoryId: z.string().uuid(), quantity: z.number().int().positive().max(100_000) })).max(100).optional(),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;

/**
 * Schema for updating a menu item.
 */
export const updateMenuItemSchema = createMenuItemSchema.omit({ recipeIngredients: true }).partial().extend({
  id: z.string().uuid("ID menu tidak valid"),
});

export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
