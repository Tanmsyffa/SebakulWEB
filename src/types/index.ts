import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';
import type {
  users,
  warungs,
  userRoles,
  lapaks,
  invoices,
  invoicePayments,
  sentraLedger,
  warungTransactions,
  warungInventory,
  warungMenus,
  guyubEvents,
  guyubPolls,
  guyubPollOptions,
  guyubPollVotes,
  guyubParticipants,
  guyubExpenses,
  facilityTickets,
  auditLogs,
} from '@/db/schema';

// ─── Table Models ───────────────────────────────────────────
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Warung = InferSelectModel<typeof warungs>;
export type NewWarung = InferInsertModel<typeof warungs>;

export type UserRole = InferSelectModel<typeof userRoles>;
export type NewUserRole = InferInsertModel<typeof userRoles>;

export type Lapak = InferSelectModel<typeof lapaks>;
export type NewLapak = InferInsertModel<typeof lapaks>;

export type Invoice = InferSelectModel<typeof invoices>;
export type NewInvoice = InferInsertModel<typeof invoices>;

export type InvoicePayment = InferSelectModel<typeof invoicePayments>;
export type NewInvoicePayment = InferInsertModel<typeof invoicePayments>;

export type SentraLedger = InferSelectModel<typeof sentraLedger>;
export type NewSentraLedger = InferInsertModel<typeof sentraLedger>;

export type WarungTransaction = InferSelectModel<typeof warungTransactions>;
export type NewWarungTransaction = InferInsertModel<typeof warungTransactions>;

export type WarungInventory = InferSelectModel<typeof warungInventory>;
export type NewWarungInventory = InferInsertModel<typeof warungInventory>;

export type WarungMenu = InferSelectModel<typeof warungMenus>;
export type NewWarungMenu = InferInsertModel<typeof warungMenus>;

export type GuyubEvent = InferSelectModel<typeof guyubEvents>;
export type NewGuyubEvent = InferInsertModel<typeof guyubEvents>;

export type GuyubPoll = InferSelectModel<typeof guyubPolls>;
export type NewGuyubPoll = InferInsertModel<typeof guyubPolls>;

export type GuyubPollOption = InferSelectModel<typeof guyubPollOptions>;
export type NewGuyubPollOption = InferInsertModel<typeof guyubPollOptions>;

export type GuyubPollVote = InferSelectModel<typeof guyubPollVotes>;
export type NewGuyubPollVote = InferInsertModel<typeof guyubPollVotes>;

export type GuyubParticipant = InferSelectModel<typeof guyubParticipants>;
export type NewGuyubParticipant = InferInsertModel<typeof guyubParticipants>;

export type GuyubExpense = InferSelectModel<typeof guyubExpenses>;
export type NewGuyubExpense = InferInsertModel<typeof guyubExpenses>;

export type FacilityTicket = InferSelectModel<typeof facilityTickets>;
export type NewFacilityTicket = InferInsertModel<typeof facilityTickets>;

export type AuditLog = InferSelectModel<typeof auditLogs>;
export type NewAuditLog = InferInsertModel<typeof auditLogs>;

// ─── Enum Types ─────────────────────────────────────────────
export type UserRoleType = 'SUPER_ADMIN' | 'PENGELOLA_ADMIN' | 'TENANT_MEMBER';
export type LapakStatus = 'KOSONG' | 'TERISI' | 'LIBUR' | 'PERBAIKAN';
export type BillingCycle = 'HARIAN' | 'MINGGUAN' | 'BULANAN';
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'WAIVED';
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TicketStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type PollStatus = 'OPEN' | 'CLOSED';

// ─── UI Helper Types ────────────────────────────────────────
export interface ActiveUserSession {
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string | null;
  roles: {
    role: UserRoleType;
    warungId: string | null;
    warungName?: string | null;
  }[];
  activeRole: UserRoleType;
  activeWarungId?: string | null;
}
