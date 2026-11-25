import { count, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, lapaks, warungs } from '@/db/schema';
import { getBusinessDateString } from '@/lib/business-date';
import { requireAdmin, requireSuperAdmin } from '@/server/guards/auth-guard';

type MonthlyValue = { month: string; rent: number; expense: number };

function getSixMonthRange() {
  const today = getBusinessDateString();
  const [year, month] = today.split('-').map(Number);
  const firstMonth = new Date(Date.UTC(year, month - 1 - 5, 1));
  const startDate = `${firstMonth.getUTCFullYear()}-${String(firstMonth.getUTCMonth() + 1).padStart(2, '0')}-01`;
  const start = new Date(`${startDate}T00:00:00+07:00`);
  const months: MonthlyValue[] = [];
  for (let i = 5; i >= 0; i--) {
    const date = new Date(Date.UTC(year, month - 1 - i, 1));
    months.push({ month: `${String(date.getUTCMonth() + 1).padStart(2, '0')}/${String(date.getUTCFullYear()).slice(-2)}`, rent: 0, expense: 0 });
  }
  return { start, months };
}

async function getMonthlyLedger() {
  const { start, months } = getSixMonthRange();
  const rows = await db.execute(sql<{ month: string; rent: number | string; expense: number | string }>`
    WITH target_invoices AS (
      SELECT DISTINCT invoice_id FROM public.invoice_payments WHERE paid_at >= ${start.toISOString()}::timestamptz
    ), payment_sequence AS (
      SELECT p.id, p.invoice_id, p.paid_at, p.amount, i.total_amount,
        COALESCE(SUM(p.amount) OVER (
          PARTITION BY p.invoice_id ORDER BY p.paid_at, p.id
          ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ), 0) AS paid_before
      FROM public.invoice_payments p
      JOIN target_invoices t ON t.invoice_id = p.invoice_id
      JOIN public.invoices i ON i.id = p.invoice_id
    ), monthly_rent AS (
      SELECT to_char(paid_at AT TIME ZONE 'Asia/Jakarta', 'MM/YY') AS month,
        SUM(LEAST(amount, GREATEST(total_amount - paid_before, 0))) AS rent
      FROM payment_sequence
      WHERE paid_at >= ${start.toISOString()}::timestamptz
      GROUP BY 1
    ), monthly_expense AS (
      SELECT to_char(transaction_date AT TIME ZONE 'Asia/Jakarta', 'MM/YY') AS month,
        SUM(amount) AS expense
      FROM public.sentra_ledger
      WHERE type = 'EXPENSE' AND transaction_date >= ${start.toISOString()}::timestamptz
      GROUP BY 1
    )
    SELECT COALESCE(r.month, e.month) AS month, COALESCE(r.rent, 0) AS rent, COALESCE(e.expense, 0) AS expense
    FROM monthly_rent r FULL OUTER JOIN monthly_expense e USING (month)
  `) as unknown as { month: string; rent: number | string; expense: number | string }[];
  const values = new Map(rows.map(row => [row.month, { rent: Number(row.rent), expense: Number(row.expense) }]));
  return months.map(item => {
    const value = values.get(item.month);
    return { ...item, rent: value?.rent ?? 0, expense: value?.expense ?? 0 };
  });
}

export async function getSentraCashflowAnalytics() {
  await requireAdmin();
  const monthly = await getMonthlyLedger();
  return monthly.map(({ month, rent, expense }) => ({ month, rent, expense }));
}

export async function getSentraAdminAnalytics() {
  await requireAdmin();
  const [monthly, occupancy, outstandingRows] = await Promise.all([
    getMonthlyLedger(),
    db.select({ status: lapaks.status, total: count() }).from(lapaks).groupBy(lapaks.status),
    db.select({ total: sql<number>`COALESCE(SUM(${invoices.remainingAmount}), 0)` }).from(invoices),
  ]);
  return {
    monthly: monthly.map(({ month, rent }) => ({ month, rent })),
    occupancy: occupancy.map(row => ({ status: row.status, total: Number(row.total) })),
    outstanding: Number(outstandingRows[0]?.total ?? 0),
  };
}

export async function getSuperAdminAnalytics() {
  await requireSuperAdmin();
  const [monthly, occupancyRows, warungRows, outstandingRows] = await Promise.all([
    getMonthlyLedger(),
    db.select({ occupied: count() }).from(lapaks).where(eq(lapaks.status, 'TERISI')),
    db.select({ total: count() }).from(warungs),
    db.select({ total: sql<number>`COALESCE(SUM(${invoices.remainingAmount}), 0)` }).from(invoices),
  ]);
  return {
    monthly,
    occupiedLapaks: Number(occupancyRows[0]?.occupied ?? 0),
    warungs: Number(warungRows[0]?.total ?? 0),
    outstanding: Number(outstandingRows[0]?.total ?? 0),
  };
}
