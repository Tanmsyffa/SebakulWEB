import type { BillingCycle, LapakStatus } from '@/types';

export interface LapakItem {
  id: string;
  code: string;
  status: LapakStatus;
  billingCycle: BillingCycle;
  baseRentAmount: number;
  contractStart: string | null;
  contractEnd: string | null;
  contractExpired: boolean;
  securityDepositAmount: number;
  contractNotes: string | null;
  warungId: string | null;
  warungName: string | null;
  warungSlug: string | null;
}

export interface WarungItem {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
}

export type AccountRole = 'SUPER_ADMIN' | 'PENGELOLA_ADMIN' | 'TENANT_MEMBER';
export type EditableAccountRole = 'PENGELOLA_ADMIN' | 'TENANT_MEMBER';

export interface ManagedAccount {
  id: string;
  roleId: string;
  email: string;
  fullName: string;
  phoneNumber: string | null;
  isActive: boolean;
  role: AccountRole;
  warungId: string | null;
}

export interface SuperAdminAnalyticsData {
  monthly: { month: string; rent: number; expense: number }[];
  occupiedLapaks: number;
  warungs: number;
  outstanding: number;
}

export interface TemporaryCredential {
  email: string;
  password: string;
}

export function formatBillingCycleLabel(cycle: BillingCycle): string {
  switch (cycle) {
    case 'HARIAN':
      return 'Harian';
    case 'MINGGUAN':
      return 'Mingguan';
    case 'BULANAN':
      return 'Bulanan';
  }
}

export function formatAccountRoleLabel(role: AccountRole): string {
  switch (role) {
    case 'SUPER_ADMIN':
      return 'Super Admin';
    case 'PENGELOLA_ADMIN':
      return 'Pengelola sentra';
    case 'TENANT_MEMBER':
      return 'Penyewa lapak';
  }
}

export function suggestSlug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

export function formatShortDateId(dateString: string | null): string {
  if (!dateString) return 'Belum diatur';
  const [year, month, day] = dateString.split('-').map(Number);
  if (!year || !month || !day) return dateString;
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}
