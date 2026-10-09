'use client';

import { CreditCard, FileText, History, Home, Settings } from 'lucide-react';
import RoleDashboardLayout from '@/components/RoleDashboardLayout';

const navItems = [
  { icon: Home, label: 'Dashboard', href: '/dashboard/business' },
  { icon: CreditCard, label: 'Make Payment', href: '/dashboard/business/pay' },
  { icon: History, label: 'Transactions', href: '/dashboard/business/transactions' },
  { icon: FileText, label: 'Receipts', href: '/dashboard/business/receipts' },
  { icon: Settings, label: 'Settings', href: '/dashboard/business/settings' },
];

export default function BusinessLayout({ children }: { children: React.ReactNode }) {
  return <RoleDashboardLayout role="business" navItems={navItems}>{children}</RoleDashboardLayout>;
}
