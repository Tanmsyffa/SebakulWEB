import { z } from "zod";

/**
 * Schema for recording a payment against an invoice.
 * Uses UUID v4 idempotency key to prevent double payment.
 */
export const recordPaymentSchema = z.object({
  idempotencyKey: z
    .string()
    .uuid("Idempotency key harus berupa UUID v4"),
  invoiceId: z
    .string()
    .uuid("ID invoice tidak valid"),
  amount: z
    .number({ required_error: "Jumlah pembayaran wajib diisi" })
    .int("Jumlah pembayaran harus bilangan bulat")
    .positive("Jumlah pembayaran harus lebih dari 0")
    .max(999_999_999, "Jumlah terlalu besar"),
  paymentMethod: z
    .string()
    .min(1, "Metode pembayaran wajib dipilih")
    .max(50, "Metode pembayaran maksimal 50 karakter"),
  proofImageUrl: z
    .string()
    .url("URL bukti pembayaran tidak valid")
    .optional()
    .nullable(),
  notes: z
    .string()
    .max(500, "Catatan maksimal 500 karakter")
    .optional(),
});

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
