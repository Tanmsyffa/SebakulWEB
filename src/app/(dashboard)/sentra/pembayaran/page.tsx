import { db } from '@/db';
import { sentraPaymentSettings } from '@/db/schema';
import { requireAdmin } from '@/server/guards/auth-guard';
import { SentraPaymentSettingsClient } from './settings-client';
import { createAdminClient } from '@/lib/supabase/admin';
import { eq } from 'drizzle-orm';

export default async function SentraPaymentSettingsPage() {
  await requireAdmin();
  const [settings] = await db.select().from(sentraPaymentSettings).where(eq(sentraPaymentSettings.id, true)).limit(1);
  let qrisUrl: string | null = null;
  if (settings?.qrisPath) {
    const result = await createAdminClient().storage.from('sentra-payment-qris').createSignedUrl(settings.qrisPath, 600);
    qrisUrl = result.data?.signedUrl ?? null;
  }
  return <SentraPaymentSettingsClient initial={{ bankName: settings?.bankName ?? '', accountName: settings?.accountName ?? '', accountNumber: settings?.accountNumber ?? '', qrisUrl }} />;
}
