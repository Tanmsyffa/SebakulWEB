import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, requireApiTenantAccess } from '@/server/guards/auth-guard';
import {
  isAllowedSameOrigin,
  isValidUploadedImageBytes,
  resolveUploadedImageExtension,
} from '@/lib/api/upload-guard';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedSameOrigin(request)) {
      return NextResponse.json({ error: 'Permintaan lintas situs ditolak.' }, { status: 403 });
    }
    const { warungId } = await requireApiTenantAccess();
    const file = (await request.formData()).get('file');
    if (!(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'Foto harus 1 B sampai 5 MB' }, { status: 400 });
    }
    const extension = resolveUploadedImageExtension(file.type);
    if (!extension) return NextResponse.json({ error: 'Gunakan WebP, JPEG, atau PNG' }, { status: 400 });
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (!isValidUploadedImageBytes(bytes, extension)) {
      return NextResponse.json({ error: 'Isi berkas bukan gambar yang valid' }, { status: 400 });
    }
    const path = `${warungId}/${crypto.randomUUID()}.${extension}`;
    const uploaded = await createAdminClient().storage.from('ticket-photos').upload(path, bytes, { contentType: file.type, upsert: false });
    if (uploaded.error) throw new Error('Gagal mengunggah foto');
    return NextResponse.json({ path }, { status: 201 });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Foto kendala gagal diunggah' }, { status: 500 });
  }
}
