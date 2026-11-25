import { getActiveEvents } from '@/server/actions/guyub.actions';
import { GuyubClient } from './guyub-client';
import { requireAuth, getUserRoles } from '@/server/guards/auth-guard';

export default async function GuyubPage() {
  const user = await requireAuth();
  const [roles, events] = await Promise.all([getUserRoles(user.id), getActiveEvents()]);

  return <GuyubClient events={events} canManage={roles.some(role => role.role === 'SUPER_ADMIN' || role.role === 'PENGELOLA_ADMIN')} />;
}
