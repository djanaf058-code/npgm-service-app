"use client";
import { useState, useEffect } from 'react';
import { createSPASassClient } from '@/lib/supabase/client';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function AuthAwareButtons({ variant = 'primary' }) {
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
