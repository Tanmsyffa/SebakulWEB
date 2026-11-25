import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { sentraPaymentSettings } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getUserRoles, requireApiAdmin, requireApiAuth } from '@/server/guards/auth-guard';
import {
  isAllowedSameOrigin,
  isSafeStorageObjectPath,
  isValidUploadedImageBytes,
  resolveUploadedImageExtension,
} from '@/lib/api/upload-guard';

export const runtime = 'nodejs';
const bucketName = 'sentra-payment-qris';

export async function GET() {
  try {
    const { internalUser } = await requireApiAuth();
    if (!(await getUserRoles(internalUser.id)).length) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }
    const [settings] = await db.select({ qrisPath: sentraPaymentSettings.qrisPath }).from(sentraPaymentSettings).where(eq(sentraPaymentSettings.id, true)).limit(1);
    if (!settings?.qrisPath || !isSafeStorageObjectPath(settings.qrisPath)) {
      return NextResponse.json({ url: null });
    }
    const result = await createAdminClient().storage.from(bucketName).createSignedUrl(settings.qrisPath, 600);
    if (result.error || !result.data) return NextResponse.json({ error: 'QRIS tidak tersedia.' }, { status: 503 });
    return NextResponse.json({ url: result.data.signedUrl }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'QRIS tidak dapat dimuat.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { user } = await requireApiAdmin();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Pilih QRIS maksimal 2 MB.' }, { status: 400 });
    }
    const extension = resolveUploadedImageExtension(file.type);
    if (!extension) return NextResponse.json({ error: 'Gunakan PNG, JPEG, atau WebP.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidUploadedImageBytes(bytes, extension)) {
      return NextResponse.json({ error: 'Isi berkas bukan gambar valid.' }, { status: 400 });
    }
    const storage = createAdminClient().storage.from(bucketName);
    const path = `sentra/${crypto.randomUUID()}.${extension}`;
    const upload = await storage.upload(path, bytes, { contentType: file.type, upsert: false });
    if (upload.error) throw new Error('QRIS gagal disimpan.');
    let oldPath: string | null = null;
    try {
      oldPath = await db.transaction(async (tx) => {
        const [current] = await tx.select({ path: sentraPaymentSettings.qrisPath }).from(sentraPaymentSettings).where(eq(sentraPaymentSettings.id, true)).for('update').limit(1);
        await tx.insert(sentraPaymentSettings).values({ id: true, qrisPath: path, updatedBy: user.id, updatedAt: new Date() })
          .onConflictDoUpdate({ target: sentraPaymentSettings.id, set: { qrisPath: path, updatedBy: user.id, updatedAt: new Date() } });
        return current?.path ?? null;
      });
    } catch (error) {
      await storage.remove([path]);
      throw error;
    }
    if (oldPath && oldPath !== path) await storage.remove([oldPath]);
    const signed = await storage.createSignedUrl(path, 600);
    if (signed.error || !signed.data) return NextResponse.json({ error: 'QRIS tersimpan, tetapi pratinjau gagal dibuat.' }, { status: 503 });
    return NextResponse.json({ success: true, url: signed.data.signedUrl }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'QRIS gagal disimpan.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { user } = await requireApiAdmin();
    const oldPath = await db.transaction(async (tx) => {
      const [current] = await tx.select({ path: sentraPaymentSettings.qrisPath }).from(sentraPaymentSettings).where(eq(sentraPaymentSettings.id, true)).for('update').limit(1);
      await tx.update(sentraPaymentSettings).set({ qrisPath: null, updatedBy: user.id, updatedAt: new Date() }).where(eq(sentraPaymentSettings.id, true));
      return current?.path ?? null;
    });
    if (oldPath) await createAdminClient().storage.from(bucketName).remove([oldPath]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'QRIS gagal dihapus.' }, { status: 500 });
  }
}
