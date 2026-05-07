import Link from 'next/link';
import { ArrowLeft, Truck, Wrench, ClipboardCheck, Shield } from 'lucide-react';
import Logo from '@/components/Logo';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const features = [
    {
      icon: Truck,
      title: 'Парк техники',
      text: 'Карточки СЗМ и буровых с историей ТО, наработкой и расходом запчастей.',
    },
    {
      icon: ClipboardCheck,
      title: 'Чек-листы и план зарядки',
      text: 'Ежедневный осмотр перед сменой и план зарядки с автопрогнозом нагрузки.',
    },
    {
      icon: Wrench,
      title: 'Плановое ТО',
      text: 'Регламент по типу машины + автозаявка к НИПИГОРМАШу за 30 дней до ТО.',
    },
    {
      icon: Shield,
      title: 'Изоляция данных',
      text: 'Каждая компания — отдельный tenant с Postgres Row-Level Security.',
    },
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
          На главную
        </Link>

        <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
          <Logo variant="full" href={false} className="mx-auto mb-2" />
        </div>

        <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">{children}</div>
      </div>

      {/* ---------- Right: brand panel with features ---------- */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-primary-700 via-primary-800 to-secondary-900 relative overflow-hidden">
        {/* subtle grid */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        {/* red accent stripe */}
        <div className="absolute right-0 top-0 bottom-0 w-1 bg-accent-600" />

        <div className="w-full flex items-center justify-center p-12 relative z-10">
          <div className="space-y-8 max-w-lg">
            <div>
              <h3 className="font-heading text-white text-3xl font-bold leading-tight mb-3">
                Один контур
                <br />
                для всего парка техники
              </h3>
              <p className="text-primary-100 text-base leading-relaxed">
                От ежедневного чек-листа оператора до годового бюджета на запчасти.
                Разрабатывается в партнёрстве с НИПИГОРМАШем.
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
