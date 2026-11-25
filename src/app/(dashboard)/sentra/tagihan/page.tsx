import { desc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, invoicePayments, lapaks, warungs } from '@/db/schema';
import { getSentraDashboard, getRecentPaymentProofs, getLapakRenewalRequests } from '@/server/actions/lapak.actions';
import { TagihanClient } from './tagihan-client';
import { requireAdmin } from '@/server/guards/auth-guard';
import { getBusinessDateString } from '@/lib/business-date';

export default async function SentraTagihanPage() {
  await requireAdmin();
  // These reads do not depend on each other; run them concurrently so the
  // page waits for the slowest query instead of the sum of all query times.
  const [dashboard, proofs, invoiceList, renewalRequests, billableLapaks, payments] = await Promise.all([
    getSentraDashboard(),
    getRecentPaymentProofs(),
    db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        lapakCode: lapaks.code,
        warungName: warungs.name,
        tenantPhone: sql<string | null>`(
          SELECT u.phone_number FROM public.user_roles ur
          JOIN public.users u ON u.id = ur.user_id
          WHERE ur.warung_id = ${invoices.warungId}
            AND ur.role = 'TENANT_MEMBER' AND u.is_active = true
            AND u.phone_number IS NOT NULL AND u.phone_number <> ''
          ORDER BY ur.created_at ASC LIMIT 1
        )`,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        remainingAmount: invoices.remainingAmount,
        status: invoices.status,
        periodStart: invoices.periodStart,
        periodEnd: invoices.periodEnd,
        dueDate: invoices.dueDate,
      })
      .from(invoices)
      .innerJoin(lapaks, eq(invoices.lapakId, lapaks.id))
      .innerJoin(warungs, eq(invoices.warungId, warungs.id))
      .orderBy(desc(invoices.createdAt)),
    getLapakRenewalRequests(),
    db.select({ id: lapaks.id, code: lapaks.code, warungName: warungs.name, status: lapaks.status })
      .from(lapaks).innerJoin(warungs, eq(lapaks.warungId, warungs.id))
      .where(sql`${lapaks.status} IN ('TERISI', 'LIBUR')`).orderBy(lapaks.code),
    db.select({
      invoiceId: invoicePayments.invoiceId,
      amount: invoicePayments.amount,
      paymentMethod: invoicePayments.paymentMethod,
      paidAt: invoicePayments.paidAt,
      notes: invoicePayments.notes,
    })
      .from(invoicePayments)
      .orderBy(desc(invoicePayments.paidAt))
      .limit(500),
  ]);
  const paymentsByInvoice = new Map<string, typeof payments>();
  for (const payment of payments) {
    const existing = paymentsByInvoice.get(payment.invoiceId);
    if (existing) existing.push(payment);
    else paymentsByInvoice.set(payment.invoiceId, [payment]);
  }
  const invoicesWithPayments = invoiceList.map(invoice => ({ ...invoice, payments: paymentsByInvoice.get(invoice.id) ?? [] }));

  return (
    <TagihanClient
      invoices={invoicesWithPayments}
      terkumpul={dashboard.sewaTerkumpul}
      tunggakan={dashboard.tunggakan}
      proofs={proofs}
      renewalRequests={renewalRequests}
      billableLapaks={billableLapaks}
      today={getBusinessDateString()}
    />
  );
}
