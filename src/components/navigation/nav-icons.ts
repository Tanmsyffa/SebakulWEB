'use client';

import {
  BarChart3,
  ClipboardList,
  CreditCard,
  FileText,
  Home,
  LayoutGrid,
  LifeBuoy,
  Package,
  Users2,
  UtensilsCrossed,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconKey } from './navigation-config';

export const navIcons = {
  home: Home,
  wallet: Wallet,
  package: Package,
  menu: UtensilsCrossed,
  report: BarChart3,
  file: FileText,
  guyub: Users2,
  support: LifeBuoy,
  map: LayoutGrid,
  audit: ClipboardList,
  payment: CreditCard,
} satisfies Record<NavIconKey, LucideIcon>;
