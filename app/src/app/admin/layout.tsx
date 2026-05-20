'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  ShoppingCart,
  MessageSquareText,
  User as UserIcon,
  Loader2,
} from 'lucide-react';
import { GlobalProvider, useGlobal, useRole } from '@/lib/context/GlobalContext';
import Logo from '@/components/Logo';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';
import { EscalationsListener } from '@/components/admin/EscalationsListener';
import { useTranslations } from 'next-intl';

// Admin route tree (/admin/*) is for platform_admin only — НПГМ side. The
// regular customer-facing app lives at /app/* with its own AppLayout.
const adminNav = [
  { nameKey: 'admin_companies', href: '/admin', icon: Building2 },
  { nameKey: 'admin_queue', href: '/admin/queue/parts', icon: ShoppingCart },
  { nameKey: 'tickets', href: '/app/tickets', icon: MessageSquareText, external: true },
  { nameKey: 'profile', href: '/app/user-settings', icon: UserIcon, external: true },
];

// Wraps the admin tree in its own GlobalProvider — same as /app does — so
// useRole/useGlobal work without the user passing through /app first.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <GlobalProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </GlobalProvider>
  );
}

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useGlobal();
  const { isPlatformAdmin } = useRole();
  const router = useRouter();
  const pathname = usePathname();
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');

  // Bounce non-admins back to the customer app. Has to live in an effect:
  // calling router.replace during render triggers a setState on the Router
  // while rendering this component, which React flags as an anti-pattern.
  useEffect(() => {
    if (!loading && !isPlatformAdmin) {
      router.replace('/app');
    }
  }, [loading, isPlatformAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-secondary-500">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        {tCommon('loading')}
      </div>
    );
  }

  if (!isPlatformAdmin) {
    // Render nothing while the effect above pushes the redirect through.
    return null;
  }

  return (
    <div className="min-h-screen bg-secondary-50 flex">
      <EscalationsListener />
      <aside className="w-64 bg-white border-r border-secondary-200 p-4 flex-shrink-0">
        <div className="mb-6 flex items-center gap-2">
          <Logo variant="full" width={140} height={28} />
          <span className="text-[10px] uppercase tracking-wider font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded">
            Admin
          </span>
        </div>
        <div className="mt-3 mb-4">
          <LocaleSwitcher />
        </div>
        <nav className="space-y-1">
          {adminNav.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== '/admin' && pathname.startsWith(item.href + '/')) ||
              (item.href === '/admin' && pathname === '/admin');
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  active
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-secondary-700 hover:bg-secondary-50'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {tNav(item.nameKey)}
                {item.external && (
                  <span className="ml-auto text-[10px] text-secondary-400">↗</span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-8 pt-4 border-t border-secondary-200">
          <p className="text-xs text-secondary-500 truncate">
            {user?.full_name || user?.email}
          </p>
          <Link
            href="/app"
            className="text-xs text-primary-600 hover:underline mt-1 inline-block"
          >
            {tNav('back_to_app')}
          </Link>
        </div>
      </aside>

      <main className="flex-1 overflow-x-auto">{children}</main>
    </div>
  );
}
