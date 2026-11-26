import type { InferSelectModel } from 'drizzle-orm';
import type {
  warungs,
  lapaks,
  invoices,
  sentraLedger,
  warungTransactions,
  warungInventory,
  warungMenus,
} from '@/db/schema';

export type Warung = InferSelectModel<typeof warungs>;
export type Lapak = InferSelectModel<typeof lapaks>;
export type Invoice = InferSelectModel<typeof invoices>;
export type SentraLedger = InferSelectModel<typeof sentraLedger>;
export type WarungTransaction = InferSelectModel<typeof warungTransactions>;
export type WarungInventory = InferSelectModel<typeof warungInventory>;
export type WarungMenu = InferSelectModel<typeof warungMenus>;

export type UserRoleType = 'SUPER_ADMIN' | 'PENGELOLA_ADMIN' | 'TENANT_MEMBER';
export type LapakStatus = 'KOSONG' | 'TERISI' | 'LIBUR' | 'PERBAIKAN';
export type BillingCycle = 'HARIAN' | 'MINGGUAN' | 'BULANAN';
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
