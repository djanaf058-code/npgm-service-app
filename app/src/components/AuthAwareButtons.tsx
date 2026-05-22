"use client";
import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { createSPASassClient } from '@/lib/supabase/client';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AuthAwareButtons({ variant = 'primary' }) {
  const t = useTranslations('landing');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = await createSPASassClient();
        const {
          data: { user },
        } = await supabase.getSupabaseClient().auth.getUser();
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  if (loading) {
    return null;
  }

  // hero variant — brand-styled CTAs for the landing page (red primary + glass secondary)
  if (variant === 'hero') {
    const primaryCls =
      'inline-flex items-center justify-center gap-2 min-h-[52px] px-7 rounded-xl font-semibold text-white bg-[#e01848] hover:bg-[#c11340] shadow-lg shadow-[#e01848]/30 transition-[background-color,transform] active:translate-y-px';
    const ghostCls =
      'inline-flex items-center justify-center min-h-[52px] px-7 rounded-xl font-semibold text-white bg-white/10 hover:bg-white/[0.18] border-[1.5px] border-white/60 backdrop-blur-sm transition-[background-color,transform] active:translate-y-px';

    if (isAuthenticated) {
      return (
        <div className="flex w-full max-w-[460px] mx-auto justify-center">
          <Link href="/app" className={`${primaryCls} px-8`}>
            {t('cta_dashboard')}
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      );
    }
    return (
      <div className="flex flex-col sm:flex-row gap-3.5 w-full max-w-[460px] mx-auto">
        <Link href="/auth/register" className={`${primaryCls} flex-1`}>
          {t('cta_register')}
        </Link>
        <Link href="/auth/login" className={`${ghostCls} flex-1`}>
          {t('cta_login')}
        </Link>
      </div>
    );
  }

  if (variant === 'nav') {
    return isAuthenticated ? (
      <Link
        href="/app"
        className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
      >
        В приложение
      </Link>
    ) : (
      <>
        <Link href="/auth/login" className="text-secondary-600 hover:text-secondary-900 text-sm font-medium px-3 py-2">
          Войти
        </Link>
        <Link
          href="/auth/register"
          className="bg-primary-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Начать
        </Link>
      </>
    );
  }

  // primary (hero) variant
  return isAuthenticated ? (
    <Link
      href="/app"
      className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
    >
      В приложение
      <ArrowRight className="ml-2 h-5 w-5" />
    </Link>
  ) : (
    <Link
      href="/auth/register"
      className="inline-flex items-center px-6 py-3 rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 transition-colors"
    >
      Зарегистрировать компанию
      <ArrowRight className="ml-2 h-5 w-5" />
    </Link>
  );
}
