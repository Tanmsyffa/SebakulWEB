import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { facilityTickets } from '@/db/schema';
import { AuthError, getUserRoles, requireApiAuth } from '@/server/guards/auth-guard';
import { createAdminClient } from '@/lib/supabase/admin';
import { isSafeStorageObjectPath, uuidParamSchema } from '@/lib/api/upload-guard';

export const runtime = 'nodejs';

export async function GET(_request: Request, context: { params: Promise<{ ticketId: string }> }) {
  try {
    const { internalUser } = await requireApiAuth();
    const { ticketId } = await context.params;
    const parsedId = uuidParamSchema.safeParse(ticketId);
    if (!parsedId.success) {
      return NextResponse.json({ error: 'ID tiket tidak valid' }, { status: 400 });
    }
    const [ticket] = await db.select({ photoUrl: facilityTickets.photoUrl, warungId: facilityTickets.warungId }).from(facilityTickets)
      .where(eq(facilityTickets.id, parsedId.data)).limit(1);
    if (!ticket?.photoUrl || !isSafeStorageObjectPath(ticket.photoUrl)) {
      return NextResponse.json({ error: 'Foto tidak ditemukan' }, { status: 404 });
    }
    const roles = await getUserRoles(internalUser.id);
    const isAdmin = roles.some(role => role.role === 'SUPER_ADMIN' || role.role === 'PENGELOLA_ADMIN');
    const isTenant = roles.some(role => role.role === 'TENANT_MEMBER' && role.warungId === ticket.warungId);
    if (!isAdmin && !isTenant) return NextResponse.json({ error: 'Akses ditolak.' }, { status: 403 });
    const result = await createAdminClient().storage.from('ticket-photos').createSignedUrl(ticket.photoUrl, 60);
    if (result.error || !result.data) return NextResponse.json({ error: 'Foto tidak tersedia' }, { status: 503 });
    return NextResponse.redirect(result.data.signedUrl, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof AuthError) return NextResponse.json({ error: error.message }, { status: error.statusCode });
    return NextResponse.json({ error: 'Foto tidak tersedia' }, { status: 500 });
  }
}
