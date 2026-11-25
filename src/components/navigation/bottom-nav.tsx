'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TabIndicator } from '@/components/motion/tab-indicator';
import { getNavGroups, isNavPathActive } from './navigation-config';
import { navIcons } from './nav-icons';
import type { UserRoleType } from '@/types';

interface BottomNavProps {
  role?: UserRoleType;
}

export function BottomNav({ role = 'TENANT_MEMBER' }: BottomNavProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = React.useState(false);
  const { items, moreItems } = getNavGroups(role);
  const moreActive = moreItems.some((item) => isNavPathActive(pathname, item.href));

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border-subtle bg-surface/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-xs lg:hidden"
      >
        <div className="mx-auto flex min-h-16 max-w-2xl items-center gap-1 px-2 py-1">
          {items.map((item) => {
            const active = isNavPathActive(pathname, item.href);
            const Icon = navIcons[item.icon];
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
                  active
                    ? 'text-brand-primary'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                )}
              >
                {active && (
                  <TabIndicator
                    layoutId="mobile-bottom-nav-active"
                    className="absolute inset-x-3 top-0.5 h-0.5 rounded-full bg-brand-primary"
                  />
                )}
                <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span
                  className={cn(
                    'max-w-full truncate text-xs leading-none',
                    active ? 'font-semibold' : 'font-medium'
                  )}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}

          {moreItems.length > 0 && (
            <button
              type="button"
              aria-expanded={moreOpen}
              aria-haspopup="dialog"
              aria-label={moreOpen ? 'Tutup menu lainnya' : 'Buka menu lainnya'}
              onClick={() => setMoreOpen(true)}
              className={cn(
                'relative flex min-h-12 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1.5 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary',
                moreActive || moreOpen
                  ? 'text-brand-primary'
                  : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
              )}
            >
              {(moreActive || moreOpen) && (
                <TabIndicator
                  layoutId="mobile-bottom-nav-active"
                  className="absolute inset-x-3 top-0.5 h-0.5 rounded-full bg-brand-primary"
                />
              )}
              <MoreHorizontal aria-hidden="true" className="h-5 w-5 shrink-0" />
              <span
                className={cn(
                  'max-w-full truncate text-xs leading-none',
                  moreActive || moreOpen ? 'font-semibold' : 'font-medium'
                )}
              >
                Lainnya
              </span>
            </button>
          )}
        </div>
      </nav>

      {moreItems.length > 0 && (
        <Dialog open={moreOpen} onOpenChange={setMoreOpen}>
          <DialogContent size="sm" aria-label="Menu navigasi lainnya">
            <DialogHeader>
              <DialogTitle>Menu lainnya</DialogTitle>
            </DialogHeader>
            <nav aria-label="Navigasi tambahan" className="space-y-1.5">
              {moreItems.map((item) => {
                const Icon = navIcons[item.icon];
                const active = isNavPathActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                      active
                        ? 'border-brand-border bg-brand-soft text-brand-primary'
                        : 'border-transparent text-text-primary hover:bg-surface-muted'
                    )}
                  >
                    <span className="flex items-center gap-3">
                      <Icon aria-hidden="true" className="h-5 w-5 shrink-0" />
                      <span>{item.label}</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-text-muted" />
                  </Link>
                );
              })}
            </nav>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
