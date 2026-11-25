'use client';

import * as React from 'react';
import Link from 'next/link';
import { ContactRound, Globe, KeyRound } from 'lucide-react';
import { SignOutButton } from '@/components/navigation/sign-out-button';
import { UserAvatar } from '@/components/ui/avatar';

export interface AccountActionsProps {
  fullName?: string;
  email?: string;
  avatarUrl?: string | null;
}

export function AccountActions({ fullName, email, avatarUrl }: AccountActionsProps) {
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const firstName = fullName?.trim().split(/\s+/)[0];

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={fullName ? `Menu akun ${fullName}` : 'Menu akun'}
        onClick={() => setOpen((value) => !value)}
        className="inline-flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg p-1 text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 sm:px-2"
      >
        <UserAvatar name={fullName} src={avatarUrl} size="sm" />
        <span className="hidden max-w-28 truncate text-sm font-medium sm:inline">
          {firstName || 'Akun'}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Menu akun"
          className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-xl border border-border-subtle bg-surface p-1.5 shadow-lg"
        >
          {(fullName || email) && (
            <>
              <div className="flex items-center gap-2.5 px-2.5 py-2">
                <UserAvatar name={fullName} src={avatarUrl} size="sm" />
                <div className="min-w-0">
                  {fullName && (
                    <p className="truncate text-sm font-semibold text-text-primary">{fullName}</p>
                  )}
                  {email && (
                    <p className="truncate text-xs text-text-secondary">{email}</p>
                  )}
                </div>
              </div>
              <div className="my-1 border-t border-border-subtle" />
            </>
          )}
          <Link
            role="menuitem"
            href="/profil"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
          >
            <ContactRound aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
            <span>Profil & kontak</span>
          </Link>
          <Link
            role="menuitem"
            href="/auth/change"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
          >
            <KeyRound aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
            <span>Ubah sandi</span>
          </Link>
          <Link
            role="menuitem"
            href="/?view=landing"
            onClick={() => setOpen(false)}
            className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary"
          >
            <Globe aria-hidden="true" className="h-4 w-4 shrink-0 text-text-secondary" />
            <span>Halaman depan</span>
          </Link>
          <div className="my-1 border-t border-border-subtle" />
          <SignOutButton className="flex min-h-10 w-full items-center rounded-lg px-2.5 text-left text-sm font-medium text-status-danger transition-colors hover:bg-status-danger-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary" />
        </div>
      )}
    </div>
  );
}
