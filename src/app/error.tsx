'use client';

import * as React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  React.useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-screen flex-col items-center justify-center bg-canvas px-4 py-12 text-center focus:outline-none"
    >
      <div className="w-full max-w-md rounded-xl border border-border-subtle bg-surface p-6 shadow-2xs sm:p-8">
        <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-status-danger-bg text-status-danger">
          <AlertTriangle aria-hidden="true" className="h-5 w-5" />
        </div>
        <h1 className="text-xl font-semibold tracking-tight text-text-primary">
          Terjadi kendala sistem
        </h1>
        <p role="alert" className="mt-2 text-sm leading-relaxed text-text-secondary">
          {error.message || 'Maaf, terjadi kesalahan saat memproses data. Silakan muat ulang halaman.'}
        </p>
        <div className="mt-6 flex justify-center">
          <Button type="button" onClick={() => reset()} className="w-full sm:w-auto">
            <RefreshCw aria-hidden="true" className="h-4 w-4" />
            <span>Coba lagi</span>
          </Button>
        </div>
      </div>
    </main>
  );
}
