import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ==========================================
// 1. ENUMS
// ==========================================

export const roleEnum = pgEnum('user_role_type', [
  'SUPER_ADMIN',
  'PENGELOLA_ADMIN',
  'TENANT_MEMBER',
]);

// Status FISIK lapak (kondisi & ketersediaan)
export const lapakStatusEnum = pgEnum('lapak_status', [
  'KOSONG',      // Tidak berpenghuni, tersedia untuk disewakan
  'TERISI',      // Aktif ditempati warung
  'LIBUR',       // Warung libur sementara; invoice dibuat dengan status WAIVED
  'PERBAIKAN',   // Dalam renovasi; tidak ditagih dan tidak bisa ditempati
]);

export const billingCycleEnum = pgEnum('billing_cycle', [
  'HARIAN',
  'MINGGUAN',
  'BULANAN',
]);

// Status PEMBAYARAN tagihan sewa
// UNPAID/PARTIAL are payment states; overdue is derived from due_date and remaining_amount.
export const invoiceStatusEnum = pgEnum('invoice_status', [
  'UNPAID',
  'PARTIAL',
  'PAID',
  'WAIVED',
]);

export const txTypeEnum = pgEnum('transaction_type', ['INCOME', 'EXPENSE']);

export const ticketStatusEnum = pgEnum('ticket_status', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
]);

export const pollStatusEnum = pgEnum('poll_status', [
  'OPEN',    // Voting sedang berlangsung
  'CLOSED',  // Voting ditutup, hasil final
]);

// ==========================================
// 2. USERS & ROLES
// ==========================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey(), // Sinkron dengan auth.users.id Supabase
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull(),
  phoneNumber: text('phone_number'),
  avatarUrl: text('avatar_url'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const supportRequests = pgTable('support_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
  requesterRole: roleEnum('requester_role').notNull(),
  subject: text('subject').notNull(),
  message: text('message').notNull(),
  attachmentPath: text('attachment_path'),
  status: text('status').default('OPEN').notNull(),
  response: text('response'),
  respondedBy: uuid('responded_by').references(() => users.id, { onDelete: 'set null' }),
  respondedAt: timestamp('responded_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  index('support_requests_created_by_date_idx').on(table.createdBy, table.createdAt.desc()),
  index('support_requests_status_date_idx').on(table.status, table.createdAt.desc()),
  index('support_requests_responded_by_idx').on(table.respondedBy),
]);

export const sentraPaymentSettings = pgTable('sentra_payment_settings', {
  id: boolean('id').default(true).primaryKey(),
  bankName: text('bank_name').notNull().default(''),
  accountName: text('account_name').notNull().default(''),
  accountNumber: text('account_number').notNull().default(''),
  qrisPath: text('qris_path'),
  updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  index('sentra_payment_settings_updated_by_idx').on(table.updatedBy),
]);

export const warungs = pgTable('warungs', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(), // Untuk URL QR Katalog Menu: /menu/[slug]
  category: text('category').notNull(),  // Makanan Berat, Minuman, Camilan
  description: text('description'),
  // Reset setiap tengah malam WIB via Supabase Scheduled Edge Function
  isOpenToday: boolean('is_open_today').default(true).notNull(),
  depositBalance: integer('deposit_balance').default(0).notNull(), // Saldo kelebihan bayar sewa
  paymentBankName: text('payment_bank_name'),
  paymentAccountName: text('payment_account_name'),
  paymentAccountNumber: text('payment_account_number'),
  paymentQrisPath: text('payment_qris_path'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Mendukung Multi-Role: 1 user bisa menjadi PENGELOLA_ADMIN sekaligus TENANT_MEMBER
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    // Wajib terisi jika role = TENANT_MEMBER; NULL untuk SUPER_ADMIN dan PENGELOLA_ADMIN
    warungId: uuid('warung_id').references(() => warungs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('user_role_warung_idx').on(table.userId, table.role, table.warungId),
    index('user_roles_user_id_idx').on(table.userId),
    index('user_roles_warung_id_idx').on(table.warungId),
  ]
);

// ==========================================
// 3. MANAJEMEN LAPAK & SEWA (SENTRA)
// ==========================================

export const lapaks = pgTable('lapaks', {
  id: uuid('id').defaultRandom().primaryKey(),
  code: text('code').notNull().unique(), // Contoh: "A-01", "B-03"
  warungId: uuid('warung_id').references(() => warungs.id, { onDelete: 'set null' }),
  status: lapakStatusEnum('status').default('KOSONG').notNull(),
  billingCycle: billingCycleEnum('billing_cycle').default('BULANAN').notNull(),
  baseRentAmount: integer('base_rent_amount').notNull(),    // Tarif sewa pokok (Rupiah)
  utilityFeeAmount: integer('utility_fee_amount').default(0).notNull(), // Kolom legacy; sewa baru sudah termasuk utilitas
  contractStart: date('contract_start'),
  contractEnd: date('contract_end'),
  securityDepositAmount: integer('security_deposit_amount').default(0).notNull(),
  contractNotes: text('contract_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
}, table => [
  index('lapaks_warung_id_idx').on(table.warungId),
  index('lapaks_status_contract_end_idx').on(table.status, table.contractEnd),
  uniqueIndex('lapaks_warung_id_unique_idx').on(table.warungId).where(sql`${table.warungId} IS NOT NULL`),
  check('lapaks_status_warung_check', sql`(${table.status} IN ('TERISI', 'LIBUR') AND ${table.warungId} IS NOT NULL) OR (${table.status} IN ('KOSONG', 'PERBAIKAN') AND ${table.warungId} IS NULL)`),
]);

export const invoices = pgTable(
  'invoices',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    invoiceNumber: text('invoice_number').notNull().unique(),
    lapakId: uuid('lapak_id').notNull().references(() => lapaks.id),
    warungId: uuid('warung_id').notNull().references(() => warungs.id),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    dueDate: date('due_date').notNull(),
    rentAmount: integer('rent_amount').notNull(),
    utilityAmount: integer('utility_amount').notNull(), // Nilai tagihan lama; tagihan baru selalu nol
    depositApplied: integer('deposit_applied').default(0).notNull(),
    totalAmount: integer('total_amount').notNull(),
    paidAmount: integer('paid_amount').default(0).notNull(),
    remainingAmount: integer('remaining_amount').notNull(),
    status: invoiceStatusEnum('status').default('UNPAID').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('invoice_warung_idx').on(table.warungId, table.status),
    index('invoices_status_due_date_idx').on(table.status, table.dueDate),
    index('invoice_lapak_created_idx').on(table.lapakId, table.createdAt.desc()),
    index('invoices_created_by_idx').on(table.createdBy),
    uniqueIndex('invoice_lapak_period_unique_idx').on(table.lapakId, table.periodStart, table.periodEnd),
  ]
);

export const invoicePayments = pgTable('invoice_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  invoiceId: uuid('invoice_id')
    .notNull()
    .references(() => invoices.id, { onDelete: 'cascade' }),
  amount: integer('amount').notNull(),
  paymentMethod: text('payment_method').notNull(), // TUNAI, TRANSFER_QRIS
  proofImageUrl: text('proof_image_url'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  notes: text('notes'),
  paidAt: timestamp('paid_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('invoice_payments_invoice_id_idx').on(table.invoiceId), index('invoice_payments_paid_at_idx').on(table.paidAt), index('invoice_payments_verified_by_idx').on(table.verifiedBy)]);

export const paymentProofs = pgTable('payment_proofs', {
  id: uuid('id').defaultRandom().primaryKey(),
  invoiceId: uuid('invoice_id').notNull().references(() => invoices.id),
  warungId: uuid('warung_id').notNull().references(() => warungs.id),
  storagePath: text('storage_path').notNull(),
  status: text('status').default('PENDING').notNull(),
  reviewNote: text('review_note'),
  uploadedAt: timestamp('uploaded_at', { withTimezone: true }).defaultNow().notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
}, table => [
  index('payment_proofs_invoice_idx').on(table.invoiceId, table.status),
  index('payment_proofs_reviewed_by_idx').on(table.reviewedBy),
  index('payment_proofs_warung_id_idx').on(table.warungId),
  uniqueIndex('payment_proofs_one_pending_per_invoice_idx').on(table.invoiceId).where(sql`status = 'PENDING'`),
]);

export const sentraLedger = pgTable('sentra_ledger', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  type: txTypeEnum('type').notNull(),
  category: text('category').notNull(), // SEWA_LAPAK, LISTRIK_PUSAT, SAMPAH, PERBAIKAN
  amount: integer('amount').notNull(),
  description: text('description').notNull(),
  referenceInvoiceId: uuid('reference_invoice_id').references(() => invoices.id),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  transactionDate: timestamp('transaction_date', { withTimezone: true })
    .defaultNow()
    .notNull(),
}, table => [index('sentra_ledger_recorded_by_idx').on(table.recordedBy), index('sentra_ledger_reference_invoice_id_idx').on(table.referenceInvoiceId), index('sentra_ledger_transaction_date_idx').on(table.transactionDate.desc()), index('sentra_ledger_expense_date_idx').on(table.transactionDate).where(sql`${table.type} = 'EXPENSE'`)]);

// ==========================================
// 4. OPERASIONAL WARUNG TERISOLASI (TENANT)
// ==========================================

export const warungTransactions = pgTable(
  'warung_transactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    warungId: uuid('warung_id')
      .notNull()
      .references(() => warungs.id, { onDelete: 'cascade' }),
    type: txTypeEnum('type').notNull(),
    category: text('category').notNull(), // OMZET_HARIAN, BELANJA_BAHAN, SEWA_LAPAK, LAINNYA
    amount: integer('amount').notNull(),
    notes: text('notes'),
    recordedBy: uuid('recorded_by').notNull().references(() => users.id),
    transactionDate: timestamp('transaction_date', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index('warung_tx_date_idx').on(table.warungId, table.transactionDate), index('warung_transactions_recorded_by_idx').on(table.recordedBy)]
);

export const warungInventory = pgTable(
  'warung_inventory',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    warungId: uuid('warung_id')
      .notNull()
      .references(() => warungs.id, { onDelete: 'cascade' }),
    itemName: text('item_name').notNull(), // Contoh: "Gas Elpiji 3kg", "Cup 16oz"
    unit: text('unit').notNull(),          // pcs, kg, tabung, liter
    currentStock: integer('current_stock').default(0).notNull(),
    averageUnitCost: integer('average_unit_cost').default(0).notNull(),
    minThreshold: integer('min_threshold').default(5).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
  },
  (table) => [index('warung_inv_idx').on(table.warungId)]
);

export const warungInventoryMovements = pgTable('warung_inventory_movements', {
  id: uuid('id').defaultRandom().primaryKey(),
  warungId: uuid('warung_id').notNull().references(() => warungs.id, { onDelete: 'cascade' }),
  inventoryId: uuid('inventory_id').notNull().references(() => warungInventory.id),
  movementType: text('movement_type').notNull(),
  quantityDelta: integer('quantity_delta').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  notes: text('notes'),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('warung_inventory_movements_tenant_date_idx').on(table.warungId, table.createdAt.desc()), index('warung_inventory_movements_inventory_date_idx').on(table.inventoryId, table.createdAt.desc()), index('warung_inventory_movements_recorded_by_idx').on(table.recordedBy)]);

export const warungSuppliers = pgTable('warung_suppliers', {
  id: uuid('id').defaultRandom().primaryKey(),
  warungId: uuid('warung_id').notNull().references(() => warungs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  contact: text('contact'),
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('warung_suppliers_tenant_idx').on(table.warungId, table.name)]);

export const warungPurchases = pgTable('warung_purchases', {
  id: uuid('id').defaultRandom().primaryKey(),
  warungId: uuid('warung_id').notNull().references(() => warungs.id, { onDelete: 'cascade' }),
  supplierId: uuid('supplier_id').references(() => warungSuppliers.id, { onDelete: 'set null' }),
  totalAmount: integer('total_amount').notNull(),
  notes: text('notes'),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('warung_purchases_tenant_date_idx').on(table.warungId, table.purchasedAt.desc()), index('warung_purchases_recorded_by_idx').on(table.recordedBy), index('warung_purchases_supplier_id_idx').on(table.supplierId)]);

export const warungPurchaseItems = pgTable('warung_purchase_items', {
  id: uuid('id').defaultRandom().primaryKey(),
  purchaseId: uuid('purchase_id').notNull().references(() => warungPurchases.id, { onDelete: 'cascade' }),
  inventoryId: uuid('inventory_id').notNull().references(() => warungInventory.id),
  quantity: integer('quantity').notNull(),
  unitCost: integer('unit_cost').notNull(),
  lineTotal: integer('line_total').notNull(),
}, table => [index('warung_purchase_items_purchase_idx').on(table.purchaseId), index('warung_purchase_items_inventory_id_idx').on(table.inventoryId)]);

export const warungMenus = pgTable('warung_menus', {
  id: uuid('id').defaultRandom().primaryKey(),
  warungId: uuid('warung_id')
    .notNull()
    .references(() => warungs.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  price: integer('price').notNull(),
  imageUrl: text('image_url'),
  isAvailable: boolean('is_available').default(true).notNull(),
  isFeatured: boolean('is_featured').default(false).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
}, table => [index('warung_menus_warung_id_idx').on(table.warungId)]);

export const warungMenuRecipes = pgTable('warung_menu_recipes', {
  id: uuid('id').defaultRandom().primaryKey(),
  warungId: uuid('warung_id').notNull().references(() => warungs.id, { onDelete: 'cascade' }),
  menuId: uuid('menu_id').notNull().references(() => warungMenus.id, { onDelete: 'cascade' }),
  inventoryId: uuid('inventory_id').notNull().references(() => warungInventory.id),
  quantity: integer('quantity').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [uniqueIndex('warung_menu_recipe_item_unique_idx').on(table.menuId, table.inventoryId), index('warung_menu_recipe_tenant_idx').on(table.warungId, table.menuId), index('warung_menu_recipes_inventory_id_idx').on(table.inventoryId)]);

// ==========================================
// 5. SEBAKUL GUYUB (ACARA, POLLING & PATUNGAN)
// ==========================================

export const guyubEvents = pgTable('guyub_events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  destination: text('destination').notNull(),
  eventDate: date('event_date'),
  targetBudget: integer('target_budget').notNull(),
  adultFee: integer('adult_fee').default(0).notNull(),
  childFee: integer('child_fee').default(0).notNull(),
  perWarungFee: integer('per_warung_fee'), // NULL keeps the legacy per-person fee model
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const guyubPolls = pgTable('guyub_polls', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => guyubEvents.id, { onDelete: 'cascade' }),
  question: text('question').notNull(),
  status: pollStatusEnum('status').default('OPEN').notNull(),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  createdBy: uuid('created_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('guyub_polls_event_created_idx').on(table.eventId, table.createdAt.desc()), index('guyub_polls_created_by_idx').on(table.createdBy)]);

export const guyubPollOptions = pgTable('guyub_poll_options', {
  id: uuid('id').defaultRandom().primaryKey(),
  pollId: uuid('poll_id')
    .notNull()
    .references(() => guyubPolls.id, { onDelete: 'cascade' }),
  optionText: text('option_text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('guyub_poll_options_poll_id_idx').on(table.pollId)]);

export const guyubPollVotes = pgTable(
  'guyub_poll_votes',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    pollId: uuid('poll_id')
      .notNull()
      .references(() => guyubPolls.id, { onDelete: 'cascade' }),
    optionId: uuid('option_id')
      .notNull()
      .references(() => guyubPollOptions.id, { onDelete: 'cascade' }),
    warungId: uuid('warung_id')
      .notNull()
      .references(() => warungs.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('guyub_poll_vote_unique_idx').on(table.pollId, table.warungId),
    index('guyub_poll_votes_option_id_idx').on(table.optionId),
    index('guyub_poll_votes_warung_id_idx').on(table.warungId),
  ]
);

export const guyubParticipants = pgTable(
  'guyub_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    eventId: uuid('event_id')
      .notNull()
      .references(() => guyubEvents.id, { onDelete: 'cascade' }),
    warungId: uuid('warung_id')
      .notNull()
      .references(() => warungs.id, { onDelete: 'cascade' }),
    adultCount: integer('adult_count').default(1).notNull(),
    childCount: integer('child_count').default(0).notNull(),
    totalFee: integer('total_fee').notNull(),
    paidAmount: integer('paid_amount').default(0).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('guyub_participant_event_warung_idx').on(table.eventId, table.warungId),
    index('guyub_participants_warung_id_idx').on(table.warungId),
  ]
);

export const guyubExpenses = pgTable('guyub_expenses', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  eventId: uuid('event_id')
    .notNull()
    .references(() => guyubEvents.id, { onDelete: 'cascade' }),
  paidByWarungId: uuid('paid_by_warung_id').notNull().references(() => warungs.id),
  description: text('description').notNull(),
  amount: integer('amount').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index('guyub_expenses_event_id_idx').on(table.eventId), index('guyub_expenses_paid_by_warung_id_idx').on(table.paidByWarungId)]);

export const guyubSavingsPayments = pgTable('guyub_savings_payments', {
  id: uuid('id').defaultRandom().primaryKey(),
  idempotencyKey: text('idempotency_key').notNull().unique(),
  participantId: uuid('participant_id').notNull().references(() => guyubParticipants.id),
  amount: integer('amount').notNull(),
  recordedBy: uuid('recorded_by').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('guyub_savings_payments_participant_id_idx').on(table.participantId), index('guyub_savings_payments_recorded_by_idx').on(table.recordedBy)]);

export const lapakRenewalRequests = pgTable('lapak_renewal_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  lapakId: uuid('lapak_id').notNull().references(() => lapaks.id),
  warungId: uuid('warung_id').notNull().references(() => warungs.id),
  requestedBy: uuid('requested_by').notNull().references(() => users.id),
  requestedContractEnd: date('requested_contract_end').notNull(),
  message: text('message'),
  status: text('status').default('PENDING').notNull(),
  reviewedBy: uuid('reviewed_by').references(() => users.id),
  reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  reviewerNote: text('reviewer_note'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  check('lapak_renewal_requests_status_check', sql`${table.status} IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')`),
  uniqueIndex('lapak_renewal_requests_one_pending_per_lapak_idx').on(table.lapakId).where(sql`${table.status} = 'PENDING'`),
  index('lapak_renewal_requests_status_date_idx').on(table.status, table.createdAt.desc()),
  index('lapak_renewal_requests_warung_date_idx').on(table.warungId, table.createdAt.desc()),
  index('lapak_renewal_requests_requested_by_idx').on(table.requestedBy),
  index('lapak_renewal_requests_reviewed_by_idx').on(table.reviewedBy),
]);

// ==========================================
// 6. TIKET KENDALA LAPAK
// ==========================================

export const facilityTickets = pgTable('facility_tickets', {
  id: uuid('id').defaultRandom().primaryKey(),
  lapakId: uuid('lapak_id').notNull().references(() => lapaks.id),
  warungId: uuid('warung_id').notNull().references(() => warungs.id),
  category: text('category').notNull(), // LISTRIK, AIR, KEBERSIHAN, BANGUNAN
  description: text('description').notNull(),
  photoUrl: text('photo_url'),
  feedback: text('feedback'),
  status: ticketStatusEnum('status').default('OPEN').notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at', { withTimezone: true }),
}, table => [index('facility_tickets_lapak_id_idx').on(table.lapakId), index('facility_tickets_resolved_by_idx').on(table.resolvedBy), index('facility_tickets_warung_id_idx').on(table.warungId), index('facility_tickets_open_by_warung_idx').on(table.warungId, table.status).where(sql`${table.status} IN ('OPEN', 'IN_PROGRESS')`)]);

// ==========================================
// 7. AUDIT LOG (SUPER_ADMIN: APPEND ONLY)
// ==========================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    actorId: uuid('actor_id').notNull().references(() => users.id),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    oldValue: text('old_value'),
    newValue: text('new_value'),
    ipAddress: text('ip_address'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('audit_log_actor_idx').on(table.actorId, table.createdAt),
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
  ]
);

export const userNotifications = pgTable('user_notifications', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  scopeRole: text('scope_role').notNull(),
  dedupeKey: text('dedupe_key').notNull(),
  title: text('title').notNull(),
  body: text('body').notNull(),
  href: text('href').notNull(),
  severity: text('severity').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  readAt: timestamp('read_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [
  uniqueIndex('user_notifications_user_scope_dedupe_unique').on(table.userId, table.scopeRole, table.dedupeKey),
  index('user_notifications_user_scope_created_idx').on(table.userId, table.scopeRole, table.createdAt.desc()),
  index('user_notifications_user_scope_unread_idx').on(table.userId, table.scopeRole, table.readAt),
]);
