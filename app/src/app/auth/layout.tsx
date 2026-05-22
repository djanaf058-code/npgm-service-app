import Link from 'next/link';
import { ArrowLeft, Truck, Wrench, ClipboardCheck, Shield } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Logo from '@/components/Logo';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = await getTranslations('auth');

  const features = [
    { icon: Truck, title: t('feature_fleet'), text: t('feature_fleet_desc') },
    { icon: ClipboardCheck, title: t('feature_checklists'), text: t('feature_checklists_desc') },
    { icon: Wrench, title: t('feature_maintenance'), text: t('feature_maintenance_desc') },
    { icon: Shield, title: t('feature_security'), text: t('feature_security_desc') },
  ];

  return (
    <div className="flex min-h-screen">
      {/* ---------- Left: form ---------- */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 bg-white relative">
        <Link
          href="/"
          className="absolute left-8 top-8 flex items-center gap-2 text-sm text-secondary-600 hover:text-secondary-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          {t('back_home')}
        </Link>

        <div className="absolute right-8 top-8">
          <LocaleSwitcher />
        </div>

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Logo variant="full" href={false} className="mx-auto mb-2" />
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">{children}</div>
      </div>

      {/* ---------- Right: brand panel with features (signature mesh) ---------- */}
      <div className="hidden lg:flex lg:w-1/2 mesh-hero relative overflow-hidden">
        {/* red accent stripe */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-600 z-10" />

        <div className="w-full flex items-center justify-center p-12 relative z-10">
          <div className="space-y-8 max-w-lg">
            <div>
              <h3 className="font-heading text-white text-3xl font-bold leading-tight mb-3">
                {t('layout_panel_title')}
              </h3>
              <p className="text-primary-100 text-base leading-relaxed">
                {t('layout_panel_desc')}
              </p>
            </div>

            <div className="space-y-4">
              {features.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="flex items-start gap-4 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10"
                >
                  <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-heading font-semibold text-white text-sm mb-1">{title}</p>
                    <p className="text-primary-100 text-sm leading-snug">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
