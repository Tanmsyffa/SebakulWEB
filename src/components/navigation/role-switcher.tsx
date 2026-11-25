'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRoleType } from '@/types';

const roleConfig: Record<
  UserRoleType,
  { label: string; dotClass: string }
> = {
  SUPER_ADMIN: {
    label: 'Super Admin',
    dotClass: 'bg-brand-primary',
  },
  PENGELOLA_ADMIN: {
    label: 'Pengelola',
    dotClass: 'bg-status-info',
  },
  TENANT_MEMBER: {
    label: 'Warung',
    dotClass: 'bg-status-success',
  },
};

const roleLanding: Record<UserRoleType, string> = {
  SUPER_ADMIN: '/admin',
  PENGELOLA_ADMIN: '/sentra',
  TENANT_MEMBER: '/warung',
};

interface RoleSwitcherProps {
  roles: UserRoleType[];
  activeRole: UserRoleType;
  className?: string;
}

export function RoleSwitcher({ roles, activeRole, className }: RoleSwitcherProps) {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const panelId = React.useId();
  const config = roleConfig[activeRole];
  const hasMultipleRoles = roles.length > 1;

  React.useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !containerRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const switchRole = async (role: UserRoleType) => {
    document.cookie = `sebakul_active_role=${role};path=/;max-age=${60 * 60 * 24 * 365}`;
    setOpen(false);
    router.push(roleLanding[role]);
    router.refresh();
  };

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {hasMultipleRoles ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={`Peran aktif: ${config.label}. Ganti peran`}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary"
        >
          <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', config.dotClass)} />
          <span>{config.label}</span>
          <ChevronDown
            aria-hidden="true"
            className={cn('h-3.5 w-3.5 shrink-0 text-text-muted transition-transform duration-150', open && 'rotate-180')}
          />
        </button>
      ) : (
        <span className="hidden min-h-10 items-center gap-2 rounded-lg border border-border-subtle bg-surface-muted/50 px-3 py-1.5 text-xs font-medium text-text-secondary sm:inline-flex">
          <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', config.dotClass)} />
          <span>{config.label}</span>
        </span>
      )}

      {hasMultipleRoles && open && (
        <div
          id={panelId}
          role="menu"
          aria-label="Pilih peran aktif"
          className="absolute right-0 top-full z-50 mt-1.5 min-w-44 rounded-xl border border-border-subtle bg-surface p-1 shadow-md"
        >
          {roles.map((role) => {
            const rc = roleConfig[role];
            const isActive = role === activeRole;

            return (
              <button
                key={role}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => void switchRole(role)}
                className={cn(
                  'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
                  isActive
                    ? 'bg-surface-muted font-medium text-text-primary'
                    : 'text-text-secondary hover:bg-surface-muted/60 hover:text-text-primary'
                )}
              >
                <span aria-hidden="true" className={cn('h-2 w-2 shrink-0 rounded-full', rc.dotClass)} />
                <span className="flex-1">{rc.label}</span>
                {isActive && <Check aria-hidden="true" className="h-4 w-4 shrink-0 text-brand-primary" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
