import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import Logo from '@/components/Logo';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

export default async function Home() {
  const t = await getTranslations('landing');

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* ---------- Top nav ---------- */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-secondary-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" />
          <div className="flex items-center gap-3">
            <LocaleSwitcher />
            <AuthAwareButtons variant="nav" />
          </div>
        </div>
      </nav>

      {/* ---------- Hero with mesh gradient ---------- */}
      <section className="flex-1 flex items-center justify-center px-4 pt-16 relative overflow-hidden">
        {/* Mesh gradient — layered radial blobs over a deep base.
            Designed in the Stripe / Vercel "2026 aesthetic" style:
            saturated blue + indigo + violet blobs on a near-black base. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-20"
          style={{
            backgroundColor: '#0b1437',
            backgroundImage: [
              'radial-gradient(at 78% 8%, #6366f1 0px, transparent 55%)',
              'radial-gradient(at 12% 22%, #1d4ed8 0px, transparent 50%)',
              'radial-gradient(at 88% 80%, #a855f7 0px, transparent 50%)',
              'radial-gradient(at 18% 88%, #312e81 0px, transparent 55%)',
              'radial-gradient(at 50% 50%, #1e3a8a 0px, transparent 60%)',
            ].join(','),
          }}
        />
        {/* subtle grid on top of the gradient — gives an industrial texture */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <div className="max-w-2xl w-full text-center relative">
          <h1 className="font-heading text-5xl md:text-7xl font-bold text-white mb-5 leading-[1.05] tracking-tight">
            NPGM Service
          </h1>

          <p className="text-base md:text-lg text-white/75 mb-12 max-w-md mx-auto">
            {t('hero_tagline')}
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-white hover:bg-secondary-50 text-secondary-900 rounded-lg font-medium shadow-lg shadow-primary-900/30 transition-colors"
            >
              {t('cta_register')}
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-7 py-3 bg-white/10 hover:bg-white/15 text-white border border-white/30 rounded-lg font-medium backdrop-blur-sm transition-colors"
            >
              {t('cta_login')}
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="py-6 px-4 border-t border-secondary-100 bg-white">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-secondary-500">
          <Logo variant="full" width={120} height={24} />
          <p>{t('footer')}</p>
        </div>
      </footer>
    </div>
  );
}
