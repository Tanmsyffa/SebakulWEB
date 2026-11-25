'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { TabIndicator } from '@/components/motion/tab-indicator';
import { BrandLogo } from '@/components/ui/brand-logo';
import { getNavGroups, isNavPathActive } from './navigation-config';
import { navIcons } from './nav-icons';
import type { UserRoleType } from '@/types';

export interface SidebarNavProps {
  role: UserRoleType;
  workspaceName: string;
  workspaceSubtitle: string;
}

export function SidebarNav({
  role,
  workspaceName,
  workspaceSubtitle,
}: SidebarNavProps) {
  const pathname = usePathname();
  const { items, moreItems } = getNavGroups(role);

  const renderGroup = (label: string, groupItems: typeof items) => (
    <div className="space-y-1">
      <p className="px-3 pb-1 text-xs font-medium text-text-muted">
        {label}
      </p>
      <ul className="space-y-0.5">
        {groupItems.map((item) => {
          const active = isNavPathActive(pathname, item.href);
          const Icon = navIcons[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'relative flex min-h-10 items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary',
                  active
                    ? 'font-medium text-text-primary'
                    : 'font-normal text-text-secondary hover:bg-surface-muted/70 hover:text-text-primary'
                )}
              >
                {active && (
                  <TabIndicator
                    layoutId="desktop-sidebar-nav-active"
                    className="absolute inset-0 rounded-lg bg-surface-muted before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-brand-primary"
                  />
                )}
                <Icon
                  aria-hidden="true"
                  className={cn(
                    'relative z-10 h-4 w-4 shrink-0',
                    active ? 'text-brand-primary' : 'text-text-muted'
                  )}
                />
                <span className="relative z-10 truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );

  return (
    <aside
      aria-label="Navigasi samping"
      className="hidden lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-60 lg:shrink-0 lg:flex-col lg:border-r lg:border-border-subtle lg:bg-surface"
    >
      <div className="flex h-16 items-center gap-2.5 border-b border-border-subtle px-4">
        <BrandLogo size="sm" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight text-text-primary">
            {workspaceName}
          </p>
          <p className="truncate text-xs text-text-muted">
            {workspaceSubtitle}
          </p>
        </div>
      </div>

      <nav
        aria-label="Menu utama"
        className="flex-1 space-y-5 overflow-y-auto px-2.5 py-4"
      >
        {renderGroup('Navigasi', items)}
        {moreItems.length > 0 && renderGroup('Lainnya', moreItems)}
      </nav>

      <div className="border-t border-border-subtle px-4 py-3">
        <Link
          href="/?view=landing"
          className="text-xs text-text-muted transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded"
        >
          SEBAKUL Sentra Kuliner
        </Link>
      </div>
    </aside>
  );
}
