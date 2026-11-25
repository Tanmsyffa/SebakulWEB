'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function SignOutButton({ className = '' }: { className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');

  async function signOut() {
    setBusy(true);
    setError('');
    try {
      const { error: signOutError } = await createBrowserClient().auth.signOut({
        scope: 'local',
      });
      if (signOutError) {
        setError('Gagal keluar. Periksa koneksi lalu coba lagi.');
        return;
      }
      router.replace('/login');
      router.refresh();
    } catch {
      setError('Gagal keluar. Periksa koneksi lalu coba lagi.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        role="menuitem"
        onClick={signOut}
        disabled={busy}
        className={cn(className, 'disabled:opacity-50')}
      >
        {busy ? 'Keluar...' : 'Keluar'}
      </button>
      {error && (
        <span
          role="alert"
          className="mt-1.5 block w-full rounded-lg border border-status-danger-border bg-status-danger-bg px-2.5 py-2 text-xs font-medium text-status-danger"
        >
          {error}
        </span>
      )}
    </>
  );
}
