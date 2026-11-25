import type { Metadata } from 'next';
import { getInternalUser, getUserRoles, requireAuth } from '@/server/guards/auth-guard';
import type { UserRoleType } from '@/types';
import { ContactSettingsClient } from './contact-settings-client';

export const metadata: Metadata = {
  title: 'Profil & Kontak',
};

export default async function ProfileContactPage() {
  const auth = await requireAuth();
  const [user, roles] = await Promise.all([
    getInternalUser(auth.id),
    getUserRoles(auth.id),
  ]);

  return (
    <ContactSettingsClient
      fullName={user.fullName}
      email={user.email}
      avatarUrl={user.avatarUrl}
      initialPhone={user.phoneNumber ?? ''}
      createdAt={user.createdAt.toISOString()}
      roles={roles.map((item) => ({
        id: item.id,
        role: item.role as UserRoleType,
        warungName: item.warungName,
      }))}
    />
  );
}
