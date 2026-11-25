import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { invoices, paymentProofs } from '@/db/schema';
import { AuthError, requireApiTenantAccess } from '@/server/guards/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  isAllowedSameOrigin,
  isValidUploadedImageBytes,
  resolveUploadedImageExtension,
  uuidParamSchema,
} from '@/lib/api/upload-guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { warungId } = await requireApiTenantAccess();
    const form = await request.formData();
    const invoiceId = form.get('invoiceId');
    const file = form.get('file');
    const parsedInvoiceId = uuidParamSchema.safeParse(invoiceId);
    if (!parsedInvoiceId.success || !(file instanceof File)) {
      return NextResponse.json({ error: 'Data unggahan tidak valid' }, { status: 400 });
    }
    if (file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran gambar harus 1 B sampai 5 MB' }, { status: 400 });
    }
    const extension = resolveUploadedImageExtension(file.type);
    if (!extension) return NextResponse.json({ error: 'Gunakan gambar WebP, JPEG, atau PNG' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidUploadedImageBytes(bytes, extension)) {
      return NextResponse.json({ error: 'Isi berkas bukan gambar yang valid' }, { status: 400 });
    }
    const validInvoiceId = parsedInvoiceId.data;
    const [invoice] = await db.select({ id: invoices.id, status: invoices.status }).from(invoices)
      .where(and(eq(invoices.id, validInvoiceId), eq(invoices.warungId, warungId))).limit(1);
    if (!invoice) return NextResponse.json({ error: 'Tagihan tidak ditemukan' }, { status: 404 });
    if (invoice.status === 'PAID' || invoice.status === 'WAIVED') {
      return NextResponse.json({ error: 'Tagihan sudah ditutup' }, { status: 409 });
    }
    const pending = await db.select({ id: paymentProofs.id }).from(paymentProofs)
      .where(and(eq(paymentProofs.invoiceId, validInvoiceId), eq(paymentProofs.status, 'PENDING'))).limit(1);
    if (pending.length) {
      return NextResponse.json({ error: 'Bukti sebelumnya masih menunggu verifikasi' }, { status: 409 });
    }
    const storage = createAdminClient();
    const storagePath = `${warungId}/${validInvoiceId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await storage.storage.from('payment-proofs').upload(storagePath, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error('Gagal menyimpan gambar bukti bayar');
    try {
      const [proof] = await db.insert(paymentProofs).values({ invoiceId: validInvoiceId, warungId, storagePath }).onConflictDoNothing().returning({ id: paymentProofs.id });
      if (!proof) {
        await storage.storage.from('payment-proofs').remove([storagePath]);
        return NextResponse.json({ error: 'Bukti sebelumnya masih menunggu verifikasi' }, { status: 409 });
      }
    } catch (error) {
      await storage.storage.from('payment-proofs').remove([storagePath]);
      throw error;
    }
    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Unggahan gagal. Coba lagi atau hubungi Pengelola.' }, { status: 500 });
  }
}
