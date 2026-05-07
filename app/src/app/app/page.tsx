'use client';

import { useGlobal } from '@/lib/context/GlobalContext';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Truck, ClipboardCheck, MessageSquareText, Wrench, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardContent() {
  const { loading, user } = useGlobal();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-600 border-t-transparent" />
      </div>
    );
  }

  const greeting = user?.email?.split('@')[0] ?? 'оператор';

  // Sprint 1.5–1.7: these all link to placeholder routes that 404 today.
  // They will become real pages over the next sprints.
  const quickLinks = [
    {
      href: '/app/machines',
      icon: Truck,
      title: 'Парк техники',
      description: 'Карточки СЗМ и буровых, наработка, история ТО',
      sprint: 'Sprint 1.8',
    },
    {
      href: '/app/shifts',
      icon: ClipboardCheck,
      title: 'Смены и план зарядки',
      description: 'Чек-листы, план зарядки, фактический отчёт',
      sprint: 'Sprint 3',
    },
    {
      href: '/app/tickets',
      icon: MessageSquareText,
      title: 'Тикеты',
      description: 'Вопросы операторов, эскалации к Tier 2',
      sprint: 'Sprint 2',
    },
    {
      href: '/app/maintenance',
      icon: Wrench,
      title: 'ТО и запчасти',
      description: 'Плановое ТО, склад, заявки производителю',
      sprint: 'Sprint 3',
    },
  ];

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-6xl mx-auto">
      {/* Hero */}
      <div className="rounded-xl bg-gradient-to-br from-primary-700 via-primary-800 to-secondary-900 text-white p-6 md:p-8 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-600" />
        <div className="relative">
          <p className="text-primary-200 text-xs font-semibold uppercase tracking-wider mb-2">
            NPGM Service App · Pilot
          </p>
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-2">
            Здравствуйте, {greeting}
          </h1>
          <p className="text-primary-100 max-w-2xl text-sm md:text-base">
            Платформа в активной разработке. Сейчас доступна базовая регистрация
            компании. Модули техники, чек-листов и тикетов появятся в ближайших
            спринтах — каждая карточка ниже ведёт на ещё-не-готовую страницу.
          </p>
        </div>
      </div>

      {/* Quick links */}
      <div>
        <h2 className="font-heading text-lg font-semibold text-secondary-900 mb-3">
          Быстрый доступ
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          {quickLinks.map(({ href, icon: Icon, title, description, sprint }) => (
            <Link
              key={href}
              href={href}
              className="group flex items-start gap-4 p-4 bg-white border border-secondary-200 rounded-xl hover:border-primary-300 hover:shadow-sm transition-all"
            >
              <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <h3 className="font-medium text-secondary-900">{title}</h3>
                  <span className="text-[10px] uppercase tracking-wider font-semibold text-secondary-400">
                    {sprint}
                  </span>
                </div>
                <p className="text-sm text-secondary-600 mt-0.5 leading-snug">{description}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-secondary-300 self-center" />
            </Link>
          ))}
        </div>
      </div>

      {/* What's already working */}
      <Card>
        <CardHeader>
          <CardTitle className="font-heading text-base">Что уже работает</CardTitle>
          <CardDescription>Технический фундамент платформы</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm text-secondary-700">
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>
                Multi-tenant регистрация (auth + email confirmation +
                onboarding с привязкой к компании)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>Справочник типов машин (МЗВ, МСЗ, МСЗУ, МЗУ) в БД</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary-600 mt-1">●</span>
              <span>Базовая схема: companies, profiles, machines, machine_assignments</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-accent-600 mt-1">●</span>
              <span>
                <strong>Скоро:</strong> RLS-политики (изоляция между tenant-ами на уровне БД),
                /app/machines (карточки техники), AI-поиск по мануалам
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
