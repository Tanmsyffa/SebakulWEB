import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthError, getInternalUser, getUserRoles } from '@/server/guards/auth-guard';
import { createServerClient } from '@/lib/supabase/server';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Masuk',
};

interface LoginPageProps {
  searchParams: Promise<{ error?: string; status?: string; redirect?: string }>;
}

function resolveSafeRedirect(raw?: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return '/';
  if (raw === '/login' || raw.startsWith('/login?') || raw.startsWith('/auth')) return '/';
  return raw;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const safeRedirect = resolveSafeRedirect(params.redirect);
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let notice: string | undefined;
  let successNotice: string | undefined;
  let showSignOut = false;

  if (params.error === 'registration_disabled') {
    notice = 'Pendaftaran mandiri ditutup. Hubungi Super Admin untuk dibuatkan akun.';
  } else if (params.error === 'no_roles') {
    notice = 'Akun ini belum memiliki peran aplikasi. Hubungi Super Admin untuk mendapatkan akses.';
  }

  if (params.status === 'password_changed') {
    successNotice = 'Kata sandi berhasil diperbarui. Silakan masuk dengan kata sandi baru Anda.';
  } else if (params.status === 'password_reset') {
    successNotice = 'Kata sandi berhasil diatur. Silakan masuk menggunakan email dan kata sandi Anda.';
  }

  if (user) {
    showSignOut = true;
    let accountIsActive = false;
    try {
      const internalUser = await getInternalUser(user.id);
      accountIsActive = internalUser.isActive;
    } catch (cause) {
      if (!(cause instanceof AuthError)) throw cause;
    }

    const roles = await getUserRoles(user.id);
    if (accountIsActive && roles.length > 0) redirect(safeRedirect);

    notice = accountIsActive
      ? 'Akun ini belum memiliki peran aplikasi. Hubungi Super Admin untuk mendapatkan akses.'
      : 'Akun ini tidak aktif atau belum terdaftar di SEBAKUL. Hubungi Super Admin.';
  }

  return (
    <LoginForm
      notice={notice}
      successNotice={successNotice}
      showSignOut={showSignOut}
      redirectTo={safeRedirect}
    />
  );
}
