import Link from 'next/link';
import { ArrowRight, Truck, MessageSquare, Shield } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';

export default function Home() {
  const productName = process.env.NEXT_PUBLIC_PRODUCTNAME;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-sm z-50 border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <span className="text-xl font-bold text-slate-900">
              {productName}
            </span>
            <AuthAwareButtons variant="nav" />
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-sm font-medium text-primary-600 uppercase tracking-wider mb-4">
            Платформа для подрядчиков по взрывным работам
          </p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-6 leading-tight">
            Сервис, ТО и техподдержка
            <br />
            для парка СЗМ и буровых станков
          </h1>
          <p className="text-lg text-slate-600 mb-10 max-w-2xl mx-auto">
            Карточки машин с двойной наработкой (моточасы + тонны прокачки),
            плановое ТО, чек-листы операторов, поиск по техдокументации НИПИГОРМАШа,
            прямая связь с сервисными инженерами.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Зарегистрировать компанию
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-slate-900 border border-slate-300 rounded-lg font-medium hover:bg-slate-50 transition-colors"
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      <section className="py-16 px-4 bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            <Feature
              icon={Truck}
              title="Парк техники"
              text="МЗВ, МСЗ, МСЗУ, МЗУ — карточка каждой машины с историей ТО, расходом запчастей и наработкой по тоннам ВВ."
            />
            <Feature
              icon={MessageSquare}
              title="Связь с инженером"
              text="Оператор пишет в чат, прикладывает фото, получает ответ от сервисного инженера со ссылкой на страницу РЭ."
            />
            <Feature
              icon={Shield}
              title="Изоляция данных"
              text="Каждая компания — отдельный tenant. Postgres RLS гарантирует, что данные одного клиента не попадут к другому."
            />
          </div>
        </div>
      </section>

      <footer className="py-10 px-4 text-center text-sm text-slate-500">
        <p>
          {productName} — early access, разрабатывается в партнёрстве с НИПИГОРМАШем.
        </p>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <div>
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50 text-primary-600 mb-4">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold text-slate-900 mb-2">{title}</h3>
      <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
    </div>
  );
}
