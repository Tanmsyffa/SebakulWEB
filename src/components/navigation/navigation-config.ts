import type { UserRoleType } from '@/types';

export type NavIconKey =
  | 'home'
  | 'wallet'
  | 'package'
  | 'menu'
  | 'report'
  | 'file'
  | 'guyub'
  | 'support'
  | 'map'
  | 'audit'
  | 'payment';

export interface NavItem {
  href: string;
  icon: NavIconKey;
  label: string;
}

const TENANT_NAV: NavItem[] = [
  { href: '/warung', icon: 'home', label: 'Beranda' },
  { href: '/warung/kas', icon: 'wallet', label: 'Kas' },
  { href: '/warung/stok', icon: 'package', label: 'Stok' },
  { href: '/warung/menu', icon: 'menu', label: 'Menu' },
];

const TENANT_MORE_NAV: NavItem[] = [
  { href: '/warung/laporan', icon: 'report', label: 'Laporan' },
  { href: '/warung/sewa', icon: 'file', label: 'Sewa & tagihan' },
  { href: '/guyub', icon: 'guyub', label: 'Guyub' },
  { href: '/dukungan', icon: 'support', label: 'Tiket & bantuan' },
];

const ADMIN_NAV: NavItem[] = [
  { href: '/sentra', icon: 'map', label: 'Peta' },
  { href: '/sentra/tagihan', icon: 'file', label: 'Tagihan' },
  { href: '/sentra/kas-sentra', icon: 'wallet', label: 'Kas' },
];

const ADMIN_MORE_NAV: NavItem[] = [
  { href: '/sentra/pembayaran', icon: 'payment', label: 'Rekening sewa' },
  { href: '/guyub', icon: 'guyub', label: 'Guyub' },
  { href: '/dukungan', icon: 'support', label: 'Tiket & bantuan' },
];

const SUPER_ADMIN_NAV: NavItem[] = [
  { href: '/admin', icon: 'map', label: 'Kelola' },
  { href: '/sentra/tagihan', icon: 'file', label: 'Tagihan' },
  { href: '/admin/audit-log', icon: 'audit', label: 'Audit' },
];

const SUPER_ADMIN_MORE_NAV: NavItem[] = [
  { href: '/sentra/kas-sentra', icon: 'wallet', label: 'Kas sentra' },
  { href: '/sentra/pembayaran', icon: 'payment', label: 'Rekening sewa' },
  { href: '/guyub', icon: 'guyub', label: 'Guyub' },
  { href: '/dukungan', icon: 'support', label: 'Tiket & bantuan' },
];

export function getNavGroups(role: UserRoleType): {
  items: NavItem[];
  moreItems: NavItem[];
} {
  if (role === 'SUPER_ADMIN') {
    return { items: SUPER_ADMIN_NAV, moreItems: SUPER_ADMIN_MORE_NAV };
  }
  if (role === 'PENGELOLA_ADMIN') {
    return { items: ADMIN_NAV, moreItems: ADMIN_MORE_NAV };
  }
  return { items: TENANT_NAV, moreItems: TENANT_MORE_NAV };
}

export function isNavPathActive(pathname: string, href: string): boolean {
  const exactOnly =
    href === '/' || href === '/warung' || href === '/sentra' || href === '/admin';
  return pathname === href || (!exactOnly && pathname.startsWith(`${href}/`));
}
