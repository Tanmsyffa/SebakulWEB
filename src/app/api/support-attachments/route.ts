import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getUserRoles, requireApiAuth } from '@/server/guards/auth-guard';
import {
  isAllowedSameOrigin,
  isValidUploadedImageBytes,
  resolveUploadedImageExtension,
} from '@/lib/api/upload-guard';

export const runtime = 'nodejs';
const bucket = 'ticket-photos';

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { internalUser } = await requireApiAuth();
    if (!(await getUserRoles(internalUser.id)).length) {
      return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    }
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Pilih foto maksimal 5 MB.' }, { status: 400 });
    }
    const extension = resolveUploadedImageExtension(file.type);
    if (!extension) return NextResponse.json({ error: 'Gunakan PNG, JPEG, atau WebP.' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidUploadedImageBytes(bytes, extension)) {
      return NextResponse.json({ error: 'Isi berkas bukan gambar valid.' }, { status: 400 });
    }
    const path = `${internalUser.id}/${crypto.randomUUID()}.${extension}`;
    const result = await createAdminClient().storage.from(bucket).upload(path, bytes, { contentType: file.type, upsert: false });
    if (result.error) throw new Error('Foto gagal diunggah.');
    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Foto gagal diunggah.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { internalUser } = await requireApiAuth();
    const form = await request.formData();
    const path = form.get('path');
    const pattern = new RegExp(`^${internalUser.id}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(webp|jpg|png)$`, 'i');
    if (typeof path !== 'string' || !pattern.test(path)) {
      return NextResponse.json({ error: 'Path lampiran tidak valid.' }, { status: 400 });
    }
    await createAdminClient().storage.from(bucket).remove([path]);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Foto gagal dihapus.' }, { status: 500 });
  }
}
