import Link from 'next/link';
import { ArrowRight, Truck, MessageSquareText, Shield, ClipboardCheck, Wrench, FileSearch } from 'lucide-react';
import AuthAwareButtons from '@/components/AuthAwareButtons';
import Logo from '@/components/Logo';

export default function Home() {
  return (
    <div className="min-h-screen bg-white">
      {/* ---------- Top nav ---------- */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/85 backdrop-blur-md border-b border-secondary-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Logo variant="full" />
          <div className="flex items-center gap-2">
            <AuthAwareButtons variant="nav" />
          </div>
        </div>
      </nav>

      {/* ---------- Hero ---------- */}
      <section className="pt-32 pb-24 px-4 relative overflow-hidden">
        {/* subtle grid backdrop */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #1d4ed8 1px, transparent 1px), linear-gradient(to bottom, #1d4ed8 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="max-w-4xl mx-auto text-center">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-primary-50 text-primary-700 border border-primary-100 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-600" />
            B2B · Mining contractors · Early access
          </span>
          <h1 className="font-heading text-4xl md:text-6xl font-bold text-secondary-900 mb-6 leading-[1.05] tracking-tight">
            Сервис, ТО и поддержка
            <br />
            <span className="bg-gradient-to-r from-primary-600 to-primary-800 bg-clip-text text-transparent">
              парка СЗМ и буровых станков
            </span>
          </h1>
          <p className="text-lg md:text-xl text-secondary-600 mb-10 max-w-2xl mx-auto leading-relaxed">
            Карточки машин с двойной наработкой (моточасы + тонны прокачки),
            плановое ТО, чек-листы операторов, поиск по техдокументации НИПИГОРМАШа,
            прямая связь с сервисными инженерами.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/auth/register"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium shadow-sm shadow-primary-600/20 transition-colors"
            >
              Зарегистрировать компанию
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center px-6 py-3 bg-white text-secondary-900 border border-secondary-300 rounded-lg font-medium hover:bg-secondary-50 transition-colors"
            >
              Войти
            </Link>
          </div>
          <p className="mt-5 text-xs text-secondary-500">
            Бесплатный пилот для подрядчиков с парком 3+ единиц техники
          </p>
        </div>
      </section>

      {/* ---------- Features grid ---------- */}
      <section className="py-20 px-4 bg-secondary-50 border-y border-secondary-200">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="font-heading text-3xl md:text-4xl font-bold text-secondary-900 mb-3">
              Один контур. Весь парк техники.
            </h2>
            <p className="text-secondary-600 max-w-xl mx-auto">
              От ежедневного чек-листа оператора до годового бюджета на запчасти.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            <Feature
              icon={Truck}
              title="Карточка машины"
              text="МЗВ · МСЗ · МСЗУ · МЗУ. Двойная наработка: моточасы для двигателя, тонны прокачки для насосов и форсунок. Реальный ресурс — реальное ТО."
            />
            <Feature
              icon={ClipboardCheck}
              title="План зарядки и чек-листы"
              text="Ежедневный чек-лист перед сменой блокирует выход машины при «красном» пункте. План зарядки в начале смены — расход компонентов и прогноз нагрузки автоматически."
              accent
            />
            <Feature
              icon={Wrench}
              title="Плановое ТО и запчасти"
              text="Регламент по типу машины. За 30 дней до ТО — автозаявка к НИПИГОРМАШу с уже посчитанным комплектом запчастей."
            />
            <Feature
              icon={MessageSquareText}
              title="Связь с инженером"
              text="Оператор пишет вопрос с фото прямо из карьера. Сервисный инженер отвечает в одном окне со ссылкой на страницу РЭ. Без WhatsApp-цепочек."
            />
            <Feature
              icon={FileSearch}
              title="Поиск по мануалам"
              text="РЭ всех машин в семантическом поиске. На русском и английском, cross-lingual: ввёл по-английски — нашло в русском мануале."
            />
            <Feature
              icon={Shield}
              title="Изоляция данных"
              text="Каждая компания — отдельный tenant. Postgres Row-Level Security гарантирует, что данные одного клиента физически не доступны другому."
              accent
            />
          </div>
        </div>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="py-10 px-4">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-secondary-500">
          <Logo variant="full" width={140} height={28} />
          <p>
            Early access · Разрабатывается в партнёрстве с{' '}
            <span className="font-medium text-secondary-700">НИПИГОРМАШем</span>
          </p>
        </div>
      </footer>
    </div>
  );
}

function Feature({
  icon: Icon,
  title,
  text,
  accent = false,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
  accent?: boolean;
}) {
  return (
    <div className="bg-white p-6 rounded-xl border border-secondary-200 hover:border-primary-300 hover:shadow-sm transition-all">
      <div
        className={`inline-flex items-center justify-center w-10 h-10 rounded-lg mb-4 ${
          accent
            ? 'bg-accent-50 text-accent-600'
            : 'bg-primary-50 text-primary-600'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h3 className="font-heading font-semibold text-secondary-900 mb-2">{title}</h3>
      <p className="text-sm text-secondary-600 leading-relaxed">{text}</p>
    </div>
  );
}
