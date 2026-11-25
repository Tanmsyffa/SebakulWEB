import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { ChangePasswordClient } from './change-password-client';

export const metadata: Metadata = {
  title: 'Ubah Kata Sandi',
};

export default async function ChangePasswordPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <ChangePasswordClient
      email={user.email ?? ''}
      isForced={user.app_metadata?.must_change_password === true}
    />
  );
}
