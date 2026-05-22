import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

export default async function Home() {
  const t = await getTranslations('landing');

  return (
    <main className="relative isolate flex min-h-[100svh] flex-col overflow-hidden text-white">
      {/* ---------- Background: real SZM photo at sunset ---------- */}
      <Image
        src="/hero-szm-sunset.jpg"
        alt="Смесительно-зарядная машина НИПИГОРМАШ на закате"
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover"
        style={{ objectPosition: '50% 45%' }}
      />

      {/* Scrim — keeps white text readable under direct sun: indigo veil
          darkening toward the centre (where the title sits) and the bottom. */}
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(125% 95% at 50% 46%, rgba(28,22,64,0.30) 0%, rgba(28,22,64,0.60) 52%, rgba(28,22,64,0.82) 100%), linear-gradient(180deg, rgba(28,22,64,0.55) 0%, rgba(28,22,64,0.12) 26%, rgba(28,22,64,0.22) 58%, rgba(28,22,64,0.85) 100%)',
        }}
      />

      {/* ---------- Top nav ---------- */}
      <nav className="relative flex items-center justify-between px-5 py-4 sm:px-7">
        <Image
          src="/logo-white.png"
          alt="NPGM — Advanced Mining Equipment"
          width={150}
          height={40}
          priority
          className="h-9 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.45)] sm:h-10"
        />
        <LocaleSwitcher theme="dark" />
      </nav>

      {/* ---------- Centred hero content ---------- */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-5 pb-14 text-center">
        <div className="flex max-w-[760px] flex-col items-center">
          <h1 className="font-heading text-[clamp(40px,9vw,76px)] font-bold leading-[1.02] tracking-tight drop-shadow-[0_2px_28px_rgba(0,0,0,0.5)]">
            NPGM Service
          </h1>

          <p className="mt-[18px] max-w-[30ch] text-[clamp(16px,2.4vw,21px)] leading-relaxed text-white/90 drop-shadow-[0_1px_14px_rgba(0,0,0,0.5)]">
            {t('hero_subtitle')}
          </p>

          <div className="mt-9 flex w-full justify-center">
            <AuthAwareButtons variant="hero" />
          </div>
        </div>
      </div>
    </main>
  );
}
