import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { paymentProofs } from '@/db/schema';
import { AuthError, requireApiAdmin } from '@/server/guards/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafeStorageObjectPath, uuidParamSchema } from '@/lib/api/upload-guard';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ proofId: string }> }) {
  try {
    await requireApiAdmin();
    const { proofId } = await context.params;
    const parsedId = uuidParamSchema.safeParse(proofId);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'ID bukti tidak valid' }, { status: 400 });
    }
    const [proof] = await db.select({ storagePath: paymentProofs.storagePath }).from(paymentProofs)
      .where(eq(paymentProofs.id, parsedId.data)).limit(1);
    if (!proof || !isSafeStorageObjectPath(proof.storagePath)) {
      return NextResponse.json({ error: 'Bukti tidak ditemukan' }, { status: 404 });
    }
    const result = await createAdminClient().storage.from('payment-proofs').createSignedUrl(proof.storagePath, 60);
    if (result.error || !result.data) return NextResponse.json({ error: 'Bukti tidak tersedia' }, { status: 503 });
    return NextResponse.redirect(result.data.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Bukti tidak tersedia' }, { status: 500 });
  }
}
