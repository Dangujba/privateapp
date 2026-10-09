'use client';

import { CreditCard, FileText, History, Home, Settings } from 'lucide-react';
import RoleDashboardLayout from '@/components/RoleDashboardLayout';

const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard/taxpayer' },
  { icon: CreditCard, label: 'Make Payment', href: '/dashboard/taxpayer/pay' },
  { icon: History, label: 'Transactions', href: '/dashboard/taxpayer/transactions' },
  { icon: FileText, label: 'Receipts', href: '/dashboard/taxpayer/receipts' },
  { icon: Settings, label: 'Settings', href: '/dashboard/taxpayer/settings' },
];

export default function TaxpayerLayout({ children }: { children: React.ReactNode }) {
  return <RoleDashboardLayout role="individual" navItems={navItems}>{children}</RoleDashboardLayout>;
}
