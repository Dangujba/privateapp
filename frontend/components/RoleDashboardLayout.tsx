'use client';

import type { ComponentType, ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut, Menu, Moon, Sun, X } from 'lucide-react';
import { useAuth, useTheme } from '@/app/providers';

type NavItem = {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
};

type PortalRole = 'business' | 'individual';

interface RoleDashboardLayoutProps {
  children: ReactNode;
  role: PortalRole;
  navItems: NavItem[];
}

export default function RoleDashboardLayout({ children, role, navItems }: RoleDashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, logout, isLoading: authLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const dashboardHome = role === 'business' ? '/dashboard/business' : '/dashboard/taxpayer';
  const portalName = role === 'business' ? 'Business Portal' : 'Taxpayer Portal';
  const userType = role === 'business' ? 'Business / Organisation' : 'Individual Taxpayer';

  const activeItem = useMemo(() => {
    const candidates = [...navItems].sort((a, b) => b.href.length - a.href.length);
    return candidates.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
  }, [navItems, pathname]);

  useEffect(() => {
    if (authLoading) return;
    if (!token || !user) {
      router.replace('/login');
      return;
    }
    if (user.role !== role) {
      if (user.role === 'business') router.replace('/dashboard/business');
      else if (user.role === 'individual') router.replace('/dashboard/taxpayer');
      else router.replace('/dashboard/admin');
    }
  }, [authLoading, token, user, role, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-green-500 border-t-transparent" />
      </div>
    );
  }

  if (!token || !user || user.role !== role) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 lg:flex">
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 transform bg-gray-900 transition-transform duration-300 lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-800 p-4">
            <Link href={dashboardHome} onClick={() => setSidebarOpen(false)} className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-600 text-xl font-bold text-white">₦</div>
              <div>
                <p className="font-bold text-white">YIRS Revenue</p>
                <p className="text-xs text-gray-400">{portalName}</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white lg:hidden"
              aria-label="Close navigation"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto p-4">
            {navItems.map((item) => {
              const isRoot = item.href === dashboardHome;
              const active = isRoot ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-colors ${
                    active
                      ? 'bg-green-600/20 font-medium text-green-400'
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                  }`}
                >
                  <item.icon className="h-5 w-5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-gray-800 p-4">
            <div className="mb-4 flex items-center gap-3 rounded-xl bg-gray-800/60 p-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-600/20 font-semibold text-green-400">
                {user.firstName?.[0]}{user.lastName?.[0]}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{user.firstName} {user.lastName}</p>
                <p className="truncate text-xs text-gray-400">{userType}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-400 transition-colors hover:bg-red-900/20"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="min-h-screen flex-1 lg:ml-72">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 shadow-sm backdrop-blur dark:border-gray-700 dark:bg-gray-800/95">
          <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="rounded-lg p-2 text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="h-6 w-6" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-gray-900 dark:text-white">{activeItem?.label ?? portalName}</h1>
                <p className="hidden truncate text-sm text-gray-500 dark:text-gray-400 sm:block">Yobe State Internal Revenue Service</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden max-w-52 truncate text-sm text-gray-500 dark:text-gray-400 md:block">{user.email}</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700"
                title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              >
                {theme === 'light' ? <Moon className="h-5 w-5 text-gray-600" /> : <Sun className="h-5 w-5 text-gray-300" />}
              </button>
            </div>
          </div>
        </header>

        <main>{children}</main>
      </div>

      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
