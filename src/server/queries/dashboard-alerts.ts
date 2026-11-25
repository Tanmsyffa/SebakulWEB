import { and, desc, eq, inArray, not, sql } from 'drizzle-orm';
import { db } from '@/db';
import { userNotifications } from '@/db/schema';
import { addDaysToDateString, getBusinessDateString } from '@/lib/business-date';
import type { UserRoleType } from '@/types';

export interface DashboardAlert {
  id: string;
  title: string;
  description: string;
  href: string;
  severity: 'warning' | 'urgent' | 'positive';
}

export interface DashboardNotification {
  id: string;
  title: string;
  body: string;
  href: string;
  severity: 'warning' | 'urgent' | 'positive';
  isActive: boolean;
  readAt: Date | null;
  createdAt: Date;
}

type AlertRow = {
  expired_contracts: number | string;
  expiring_contracts: number | string;
  expiring_labels: string | null;
  overdue_invoices: number | string;
  upcoming_invoices: number | string;
  available_lapaks: number | string;
  pending_proofs: number | string;
  pending_renewal_requests: number | string;
  open_tickets: number | string;
  inventory_items: number | string;
  low_stock: number | string;
  out_of_stock: number | string;
  income_today: number | string;
  expense_today: number | string;
};

const rupiah = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);

export async function getDashboardNotifications(userId: string, role: UserRoleType, warungId: string | null): Promise<DashboardNotification[]> {
  const today = getBusinessDateString();
  const warningWindow = addDaysToDateString(today, 30);
  const invoiceWindow = addDaysToDateString(today, 7);
  const isTenant = role === 'TENANT_MEMBER';
  const dayStart = `${today}T00:00:00+07:00`;
  const dayEnd = `${addDaysToDateString(today, 1)}T00:00:00+07:00`;
  const [row] = await db.execute(sql<AlertRow>`
    SELECT
      (SELECT COUNT(*)::int FROM public.lapaks l
       WHERE (${isTenant} = FALSE OR l.warung_id = ${warungId})
         AND l.status IN ('TERISI', 'LIBUR') AND l.contract_end < ${today}::date) AS expired_contracts,
      (SELECT COUNT(*)::int FROM public.lapaks l
       WHERE (${isTenant} = FALSE OR l.warung_id = ${warungId})
         AND l.status IN ('TERISI', 'LIBUR') AND l.contract_end >= ${today}::date
         AND l.contract_end <= ${warningWindow}::date) AS expiring_contracts,
      (SELECT string_agg(x.label, ' · ') FROM (
         SELECT COALESCE(w.name, 'Lapak ' || l.code) || ' (' || l.contract_end::text || ')' AS label
         FROM public.lapaks l LEFT JOIN public.warungs w ON w.id = l.warung_id
         WHERE (${isTenant} = FALSE OR l.warung_id = ${warungId})
           AND l.status IN ('TERISI', 'LIBUR') AND l.contract_end >= ${today}::date
           AND l.contract_end <= ${warningWindow}::date
         ORDER BY l.contract_end LIMIT 3
       ) x) AS expiring_labels,
      (SELECT COUNT(*)::int FROM public.invoices i
       WHERE (${isTenant} = FALSE OR i.warung_id = ${warungId})
         AND i.status IN ('UNPAID', 'PARTIAL') AND i.due_date < ${today}::date) AS overdue_invoices,
      (SELECT COUNT(*)::int FROM public.invoices i
       WHERE (${isTenant} = FALSE OR i.warung_id = ${warungId})
         AND i.status IN ('UNPAID', 'PARTIAL') AND i.due_date >= ${today}::date
         AND i.due_date <= ${invoiceWindow}::date) AS upcoming_invoices,
      CASE WHEN ${isTenant} THEN 0 ELSE
        (SELECT COUNT(*)::int FROM public.lapaks l WHERE l.status = 'KOSONG'
          OR (l.status IN ('TERISI','LIBUR') AND l.contract_end < ${today}::date)) END AS available_lapaks,
      CASE WHEN ${isTenant} THEN 0 ELSE
        (SELECT COUNT(*)::int FROM public.payment_proofs p WHERE p.status = 'PENDING') END AS pending_proofs,
      CASE WHEN ${isTenant} THEN 0 ELSE
        (SELECT COUNT(*)::int FROM public.lapak_renewal_requests r WHERE r.status = 'PENDING') END AS pending_renewal_requests,
      (SELECT COUNT(*)::int FROM public.facility_tickets t
       WHERE (${isTenant} = FALSE OR t.warung_id = ${warungId})
         AND t.status IN ('OPEN', 'IN_PROGRESS')) AS open_tickets,
      CASE WHEN ${isTenant} THEN
        (SELECT COUNT(*)::int FROM public.warung_inventory i WHERE i.warung_id = ${warungId})
        ELSE 0 END AS inventory_items,
      CASE WHEN ${isTenant} THEN
        (SELECT COUNT(*)::int FROM public.warung_inventory i
         WHERE i.warung_id = ${warungId} AND i.current_stock <= i.min_threshold)
        ELSE 0 END AS low_stock,
      CASE WHEN ${isTenant} THEN
        (SELECT COUNT(*)::int FROM public.warung_inventory i
         WHERE i.warung_id = ${warungId} AND i.current_stock <= 0)
        ELSE 0 END AS out_of_stock,
      CASE WHEN ${isTenant} THEN COALESCE((SELECT SUM(t.amount) FROM public.warung_transactions t
        WHERE t.warung_id = ${warungId} AND t.type = 'INCOME' AND t.transaction_date >= ${dayStart}::timestamptz AND t.transaction_date < ${dayEnd}::timestamptz), 0)
        ELSE 0 END AS income_today,
      CASE WHEN ${isTenant} THEN COALESCE((SELECT SUM(t.amount) FROM public.warung_transactions t
        WHERE t.warung_id = ${warungId} AND t.type = 'EXPENSE' AND t.transaction_date >= ${dayStart}::timestamptz AND t.transaction_date < ${dayEnd}::timestamptz), 0)
        ELSE 0 END AS expense_today
  `) as unknown as AlertRow[];

  if (!row) return [];
  const expiredContracts = Number(row.expired_contracts);
  const expiringContracts = Number(row.expiring_contracts);
  const overdueInvoices = Number(row.overdue_invoices);
  const upcomingInvoices = Number(row.upcoming_invoices);
  const availableLapaks = Number(row.available_lapaks);
  const pendingProofs = Number(row.pending_proofs);
  const pendingRenewalRequests = Number(row.pending_renewal_requests);
  const openTickets = Number(row.open_tickets);
  const inventoryItems = Number(row.inventory_items);
  const lowStock = Number(row.low_stock);
  const outOfStock = Number(row.out_of_stock);
  const income = Number(row.income_today);
  const expense = Number(row.expense_today);
  const tenant = isTenant;
  const dashboardHref = role === 'SUPER_ADMIN' ? '/admin' : role === 'PENGELOLA_ADMIN' ? '/sentra' : '/warung/sewa';
  const alerts: DashboardAlert[] = [];

  if (expiredContracts) alerts.push({
    id: 'contracts-expired', title: `${expiredContracts} kontrak telah berakhir`,
    description: tenant ? 'Segera hubungi admin untuk memperpanjang kontrak dan memastikan kelanjutan penempatan lapak.' : 'Lapak dapat dialihkan setelah masa kontrak selesai. Tinjau status dan penempatan warung.',
    href: dashboardHref, severity: 'urgent',
  });
  if (expiringContracts) alerts.push({
    id: 'contracts-expiring', title: `${expiringContracts} kontrak berakhir dalam 30 hari`,
    description: row.expiring_labels ?? 'Tinjau kontrak lapak yang mendekati tanggal akhir.',
    href: dashboardHref, severity: 'warning',
  });
  if (overdueInvoices) alerts.push({
    id: 'overdue-invoices', title: `${overdueInvoices} tagihan melewati jatuh tempo`,
    description: tenant ? 'Periksa tagihan sewa dan kirim bukti pembayaran.' : 'Tinjau tagihan yang belum lunas.',
    href: tenant ? '/warung/sewa' : '/sentra/tagihan', severity: 'urgent',
  });
  if (upcomingInvoices) alerts.push({
    id: 'upcoming-invoices', title: `${upcomingInvoices} tagihan jatuh tempo dalam 7 hari`,
    description: tenant ? 'Siapkan pembayaran sewa sebelum tanggal jatuh tempo.' : 'Pantau tagihan yang segera jatuh tempo.',
    href: tenant ? '/warung/sewa' : '/sentra/tagihan', severity: 'warning',
  });
  if (pendingProofs) alerts.push({
    id: 'pending-payment-proofs', title: `${pendingProofs} bukti bayar menunggu verifikasi`,
    description: 'Periksa bukti pembayaran yang dikirim penyewa.', href: '/sentra/tagihan', severity: 'warning',
  });
  if (pendingRenewalRequests) alerts.push({
    id: 'pending-lapak-renewals', title: `${pendingRenewalRequests} permintaan perpanjangan sewa menunggu keputusan`,
    description: 'Tinjau tanggal perpanjangan yang diminta penyewa lapak.', href: '/sentra/tagihan', severity: 'warning',
  });
  if (openTickets) alerts.push({
    id: 'open-facility-tickets', title: `${openTickets} laporan kendala belum selesai`,
    description: 'Lihat laporan fasilitas lapak yang masih perlu ditangani.',
    href: '/dukungan', severity: 'warning',
  });
  if (availableLapaks) alerts.push({
    id: 'available-lapaks', title: `${availableLapaks} lapak kosong atau kontraknya telah berakhir`,
    description: 'Periksa daftar lapak yang tersedia untuk penempatan warung.',
    href: role === 'SUPER_ADMIN' ? '/admin' : '/sentra', severity: 'warning',
  });
  const nearStock = Math.max(0, lowStock - outOfStock);
  if (outOfStock) alerts.push({
    id: 'stock-out', title: `${outOfStock} bahan stok habis`,
    description: 'Catat pembelian atau opname bahan sebelum operasional terganggu.', href: '/warung/stok', severity: 'urgent',
  });
  if (nearStock) alerts.push({
    id: 'low-stock', title: `${nearStock} bahan stok menipis`,
    description: 'Periksa stok minimum dan rencanakan pembelian bahan.', href: '/warung/stok', severity: 'warning',
  });
  if (tenant && inventoryItems === 0) alerts.push({
    id: 'stock-not-recorded', title: 'Stok bahan belum dicatat',
    description: 'Tambahkan bahan dan jumlah persediaan agar peringatan stok menipis dan habis bekerja.',
    href: '/warung/stok', severity: 'warning',
  });
  if (tenant && income + expense > 0) alerts.push({
    id: `daily-cashflow-${today}`, title: expense > income ? 'Pengeluaran hari ini melebihi pemasukan' : 'Pemasukan hari ini melebihi pengeluaran',
    description: `Pemasukan ${rupiah(income)} · Pengeluaran ${rupiah(expense)} · Selisih ${rupiah(income - expense)}. Ini selisih kas tercatat, bukan laba akuntansi.`,
    href: '/warung', severity: expense > income ? 'warning' : 'positive',
  });
  await db.transaction(async tx => {
    const now = new Date();
    if (alerts.length) {
      await tx.insert(userNotifications).values(alerts.map(alert => ({
        userId,
        scopeRole: role,
        dedupeKey: alert.id,
        title: alert.title,
        body: alert.description,
        href: alert.href,
        severity: alert.severity,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }))).onConflictDoUpdate({
        target: [userNotifications.userId, userNotifications.scopeRole, userNotifications.dedupeKey],
        set: {
          title: sql`excluded.title`,
          body: sql`excluded.body`,
          href: sql`excluded.href`,
          severity: sql`excluded.severity`,
          isActive: true,
          readAt: sql`CASE WHEN ${userNotifications.isActive} = false THEN NULL ELSE ${userNotifications.readAt} END`,
          createdAt: sql`CASE WHEN ${userNotifications.isActive} = false THEN now() ELSE ${userNotifications.createdAt} END`,
          updatedAt: now,
        },
      });
    }

    const activeKeys = alerts.map(alert => alert.id);
    const conditions = [
      eq(userNotifications.userId, userId),
      eq(userNotifications.scopeRole, role),
      eq(userNotifications.isActive, true),
      sql`${userNotifications.dedupeKey} NOT LIKE 'facility-ticket:%'`,
      sql`${userNotifications.dedupeKey} NOT LIKE 'lapak-renewal:%'`,
    ];
    if (activeKeys.length) conditions.push(not(inArray(userNotifications.dedupeKey, activeKeys)));
    await tx.update(userNotifications).set({ isActive: false, updatedAt: now }).where(and(...conditions));
  });

  return db.select({
    id: userNotifications.id,
    title: userNotifications.title,
    body: userNotifications.body,
    href: userNotifications.href,
    severity: userNotifications.severity,
    isActive: userNotifications.isActive,
    readAt: userNotifications.readAt,
    createdAt: userNotifications.createdAt,
  }).from(userNotifications)
    .where(and(eq(userNotifications.userId, userId), eq(userNotifications.scopeRole, role)))
    .orderBy(desc(userNotifications.createdAt))
    .limit(50) as Promise<DashboardNotification[]>;
}
