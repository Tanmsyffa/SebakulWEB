'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, Compass, Home, LifeBuoy, RefreshCw, ShieldAlert } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type ErrorStatusCode = 403 | 404 | 500;

interface ErrorStatePageProps {
  statusCode: ErrorStatusCode;
  title?: string;
  description?: string;
  onRetry?: () => void;
  embedded?: boolean;
}

const ERROR_PRESETS: Record<
  ErrorStatusCode,
  {
    codeBadge: string;
    defaultTitle: string;
    defaultDescription: string;
    toneClass: string;
    Icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>;
  }
> = {
  404: {
    codeBadge: '404 Not Found',
    defaultTitle: 'Halaman tidak ditemukan',
    defaultDescription:
      'Halaman atau tautan yang Anda tuju sudah dipindahkan, kedaluwarsa, atau alamat URL kurang tepat.',
    toneClass: 'bg-surface-muted text-text-secondary',
    Icon: Compass,
  },
  403: {
    codeBadge: '403 Forbidden',
    defaultTitle: 'Akses halaman ditolak',
    defaultDescription:
      'Akun Anda saat ini tidak memiliki izin peran untuk membuka halaman ini. Gunakan menu sesuai peran aktif atau hubungi Super Admin.',
    toneClass: 'bg-status-warning-bg text-status-warning',
    Icon: ShieldAlert,
  },
  500: {
    codeBadge: '500 Internal Server Error',
    defaultTitle: 'Gangguan pemrosesan layanan',
    defaultDescription:
      'Permintaan belum dapat diselesaikan karena kendala sementara pada server. Detail teknis telah dicatat otomatis di sistem kami.',
    toneClass: 'bg-status-danger-bg text-status-danger',
    Icon: AlertTriangle,
  },
};

export function ErrorStatePage({
  statusCode,
  title,
  description,
  onRetry,
  embedded = false,
}: ErrorStatePageProps) {
  const preset = ERROR_PRESETS[statusCode];
  const Icon = preset.Icon;
  const resolvedTitle = title ?? preset.defaultTitle;
  const resolvedDescription = description ?? preset.defaultDescription;

  const card = (
    <div className="w-full max-w-lg rounded-xl border border-border-subtle bg-surface p-6 text-center shadow-2xs sm:p-8">
      <div
        className={cn(
          'mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-lg',
          preset.toneClass
        )}
      >
        <Icon aria-hidden="true" className="h-5 w-5" />
      </div>

      <p className="font-mono text-xs font-medium text-text-muted">{preset.codeBadge}</p>

      <h1 className="mt-1.5 text-xl font-semibold tracking-tight text-text-primary sm:text-2xl">
        {resolvedTitle}
      </h1>

      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-secondary">
        {resolvedDescription}
      </p>

      <div className="mt-6 flex flex-col items-stretch justify-center gap-2.5 sm:flex-row sm:items-center">
        {onRetry ? (
          <>
            <Button type="button" onClick={onRetry} className="w-full sm:w-auto">
              <RefreshCw aria-hidden="true" className="h-4 w-4" />
              <span>Coba lagi</span>
            </Button>
            <Link
              href="/"
              className={cn(
                buttonVariants({ variant: 'secondary' }),
                'w-full sm:w-auto'
              )}
            >
              <Home aria-hidden="true" className="h-4 w-4" />
              <span>Kembali ke beranda</span>
            </Link>
          </>
        ) : (
          <Link
            href="/"
            className={cn(
              buttonVariants({ variant: 'default' }),
              'w-full sm:w-auto'
            )}
          >
            <Home aria-hidden="true" className="h-4 w-4" />
            <span>Kembali ke beranda</span>
          </Link>
        )}

        <Link
          href="/dukungan"
          className={cn(
            buttonVariants({ variant: 'ghost' }),
            'w-full text-text-secondary sm:w-auto'
          )}
        >
          <LifeBuoy aria-hidden="true" className="h-4 w-4" />
          <span>Pusat bantuan</span>
        </Link>
      </div>
    </div>
  );

  if (embedded) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center py-8">
        {card}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-text-primary">
      <header className="border-b border-border-subtle bg-surface/95">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2.5 rounded-lg px-1.5 py-1 transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            <BrandLogo size="sm" />
            <span className="text-sm font-semibold tracking-tight text-text-primary">
              SEBAKUL
            </span>
          </Link>
          <Link
            href="/dukungan"
            className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
          >
            Bantuan & kontak
          </Link>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="flex flex-1 flex-col items-center justify-center px-4 py-12 focus:outline-none sm:px-6"
      >
        {card}
      </main>

      <footer className="border-t border-border-subtle bg-surface pb-[env(safe-area-inset-bottom)] py-4">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 text-xs text-text-muted sm:flex-row sm:px-6 lg:px-8">
          <span>SEBAKUL · SEntra Beverages And KULiner</span>
          <span className="italic">Gué Katé Jugé Apé... Di Sini Ajé...</span>
        </div>
      </footer>
    </div>
  );
}
