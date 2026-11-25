import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { supportRequests } from '@/db/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { AuthError, getUserRoles, requireApiAuth } from '@/server/guards/auth-guard';
import { isSafeStorageObjectPath, uuidParamSchema } from '@/lib/api/upload-guard';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ requestId: string }> }) {
  try {
    const { internalUser } = await requireApiAuth();
    const { requestId } = await context.params;
    const parsedId = uuidParamSchema.safeParse(requestId);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'Tiket tidak valid.' }, { status: 400 });
    }
    const [row] = await db.select({ createdBy: supportRequests.createdBy, attachmentPath: supportRequests.attachmentPath }).from(supportRequests).where(eq(supportRequests.id, parsedId.data)).limit(1);
    if (!row?.attachmentPath || !isSafeStorageObjectPath(row.attachmentPath)) {
      return NextResponse.json({ error: 'Lampiran tidak ditemukan.' }, { status: 404 });
    }
    const isOwner = row.createdBy === internalUser.id;
    const roles = isOwner ? [] : await getUserRoles(internalUser.id);
    const isSuperAdmin = roles.some(role => role.role === 'SUPER_ADMIN');
    if (!isOwner && !isSuperAdmin) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    const result = await createAdminClient().storage.from('ticket-photos').createSignedUrl(row.attachmentPath, 300);
    if (result.error || !result.data) return NextResponse.json({ error: 'Lampiran tidak tersedia.' }, { status: 503 });
    return NextResponse.redirect(result.data.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Lampiran tidak tersedia.' }, { status: 500 });
  }
}
