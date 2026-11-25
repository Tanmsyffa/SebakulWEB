import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db';
import { lapaks, paymentProofs, sentraPaymentSettings, userRoles, users } from '@/db/schema';
import { getWarungInvoices } from '@/server/actions/warung.actions';
import { getWarungLapakRenewalRequest } from '@/server/actions/lapak.actions';
import { requireTenantAccess } from '@/server/guards/auth-guard';
import { SewaClient } from './sewa-client';
import { getBusinessDateString } from '@/lib/business-date';
import { createAdminClient } from '@/lib/supabase/admin';

export default async function WarungSewaPage() {
  const { warungId } = await requireTenantAccess();

  // Find lapak code
  const [[lapak], invoicesList, renewalRequest, adminRows, [paymentSettings]] = await Promise.all([db
    .select({ code: lapaks.code, contractStart: lapaks.contractStart, contractEnd: lapaks.contractEnd, securityDepositAmount: lapaks.securityDepositAmount, contractNotes: lapaks.contractNotes, baseRentAmount: lapaks.baseRentAmount })
    .from(lapaks)
    .where(eq(lapaks.warungId, warungId))
    .limit(1), getWarungInvoices(), getWarungLapakRenewalRequest(), db
      .select({ name: users.fullName, phone: users.phoneNumber, email: users.email })
      .from(userRoles).innerJoin(users, eq(userRoles.userId, users.id))
      .where(and(eq(userRoles.role, 'PENGELOLA_ADMIN'), eq(users.isActive, true))).orderBy(userRoles.createdAt).limit(1),
    db.select().from(sentraPaymentSettings).where(eq(sentraPaymentSettings.id, true)).limit(1)]);
  let rentQrisUrl: string | null = null;
  if (paymentSettings?.qrisPath) {
    const signed = await createAdminClient().storage.from('sentra-payment-qris').createSignedUrl(paymentSettings.qrisPath, 600);
    rentQrisUrl = signed.data?.signedUrl ?? null;
  }
  const allProofs = invoicesList.length ? await db.selectDistinctOn([paymentProofs.invoiceId], {
    invoiceId: paymentProofs.invoiceId,
    status: paymentProofs.status,
    reviewNote: paymentProofs.reviewNote,
  }).from(paymentProofs).where(eq(paymentProofs.warungId, warungId))
    .orderBy(paymentProofs.invoiceId, desc(paymentProofs.uploadedAt)) : [];
  const latestProofByInvoice = new Map<string, typeof allProofs[number]>();
  for (const proof of allProofs) if (!latestProofByInvoice.has(proof.invoiceId)) latestProofByInvoice.set(proof.invoiceId, proof);
  const invoices = invoicesList.map(invoice => ({
    ...invoice,
    proofStatus: latestProofByInvoice.get(invoice.id)?.status ?? null,
    proofReviewNote: latestProofByInvoice.get(invoice.id)?.reviewNote ?? null,
  }));

  return (
    <SewaClient
      lapakCode={lapak?.code || 'Belum ditetapkan'}
      contract={lapak ? { start: lapak.contractStart, end: lapak.contractEnd, deposit: lapak.securityDepositAmount, notes: lapak.contractNotes, rent: lapak.baseRentAmount } : null}
      invoices={invoices}
      today={getBusinessDateString()}
      adminContact={adminRows[0] ?? null}
      paymentDestination={paymentSettings ? { bankName: paymentSettings.bankName, accountName: paymentSettings.accountName, accountNumber: paymentSettings.accountNumber, qrisUrl: rentQrisUrl } : null}
      renewalRequest={renewalRequest}
    />
  );
}
