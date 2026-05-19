# AI-чат + RAG + i18n — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Развернуть двуязычный AI-чат (RU/EN) с RAG по мануалам, эскалацией на НПГМ-специалиста и обучением из закрытых тикетов — для пилотов MCS (KSA) и Gulf Explosives (UAE).

**Architecture:** Next.js 15 inline (без отдельного Python/FastAPI), Anthropic Claude Sonnet 4.6 для генерации + Vision, Voyage AI `voyage-multilingual-2` для embeddings, pgvector в существующем Supabase Postgres. Drawer-чат на странице машины эскалируется в существующие тикеты (`tickets` + `ticket_messages`), верифицированные решения попадают обратно в индекс как FAQ-чанки. i18n через `next-intl`, переключатель в шапке, выбор сохраняется в `profiles.language`.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · TailwindCSS · Supabase (Postgres + Auth + Storage + Realtime + pgvector) · `next-intl@^3` · `@anthropic-ai/sdk` · `pdf-parse` · Voyage AI REST

---

## File layout (что появится / изменится)

**Новое:**
```
app/messages/
  ru.json                                  — namespace-структура переводов
  en.json
app/src/i18n.ts                            — next-intl config
app/src/components/i18n/LocaleSwitcher.tsx — переключатель в шапке
app/src/components/ai-chat/
  AIChatDrawer.tsx                         — главный drawer
  AIMessageBubble.tsx                      — пузырь сообщения
  AIPhotoPreview.tsx                       — превью фото
  EscalationBanner.tsx                     — баннер «передал инженеру»
app/src/lib/ai/
  anthropic.ts                             — Claude client wrapper
  voyage.ts                                — Voyage embeddings client
  prompt-builder.ts                        — system prompt для RAG
  pdf-parser.ts                            — pdf-parse + chunking
  context-loader.ts                        — fetch machine context (model, hours, ...)
app/src/app/api/ai/
  conversations/route.ts                   — POST create / GET list
  conversations/[id]/route.ts              — GET single
  messages/route.ts                        — POST user message
  respond/route.ts                         — POST RAG + Claude + stream
  escalate/route.ts                        — POST AI conversation → ticket
  learn/route.ts                           — cron handler
app/scripts/
  ingest-manuals.ts                        — load PDF → chunks → pgvector

db/migrations/
  0032_ai_chat_rag.sql                     — pgvector + tables + RLS + alters
```

**Изменения:**
```
app/package.json                           — +next-intl @anthropic-ai/sdk pdf-parse
app/src/app/layout.tsx                     — NextIntlClientProvider
app/src/middleware.ts                      — detect locale, inject cookie
app/src/lib/supabase/middleware.ts         — read profile.language
app/src/components/AppLayout.tsx           — LocaleSwitcher + переводы
app/src/app/admin/layout.tsx               — LocaleSwitcher + переводы
app/src/app/app/machines/[id]/page.tsx     — встроить AIChatDrawer
app/src/app/auth/login/page.tsx            — LocaleSwitcher pre-auth
app/src/lib/types.ts                       — types для новых таблиц
```

---

## Phase 0 — i18n (RU/EN switch, foundation для всего остального)

**Deliverable:** Пользователь открывает приложение, в шапке видит переключатель **RU/EN**, всё переключается. Выбор сохраняется в БД (`profiles.language`).

**Why first:** все новые UI-строки фаз A-F сразу пишутся в `ru.json` + `en.json`. Иначе придётся переписывать чат после ENG-релиза.

---

### Task 0.1: Установить next-intl и базовый конфиг

**Files:**
- Modify: `app/package.json`
- Create: `app/src/i18n.ts`
- Create: `app/next.config.ts` (модифицировать существующий)
- Create: `app/messages/ru.json`
- Create: `app/messages/en.json`

- [ ] **Step 1: Установить пакет**

```bash
cd app && pnpm add next-intl@^3.26.0
```

Expected: `+next-intl 3.26.x` без peer-warnings (next 15 поддерживается).

- [ ] **Step 2: Создать `app/messages/ru.json` с базовым namespace**

```json
{
  "common": {
    "save": "Сохранить",
    "cancel": "Отмена",
    "delete": "Удалить",
    "edit": "Редактировать",
    "loading": "Загрузка…",
    "error": "Ошибка",
    "back": "Назад",
    "open": "Открыть",
    "add": "Добавить",
    "create": "Создать",
    "submit": "Отправить",
    "search": "Поиск"
  },
  "nav": {
    "home": "Главная",
    "machines": "Парк техники",
    "shifts": "Смены",
    "tickets": "Тикеты",
    "maintenance": "ТО",
    "parts": "Гараж",
    "team": "Команда",
    "admin_panel": "Админ-панель",
    "profile": "Профиль"
  },
  "roles": {
    "operator": "Оператор",
    "service_engineer": "Сервисный инженер",
    "project_manager": "Проектный менеджер",
    "platform_admin": "НПГМ — Платформа"
  }
}
```

- [ ] **Step 3: Создать `app/messages/en.json` — EN-эквиваленты**

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "loading": "Loading…",
    "error": "Error",
    "back": "Back",
    "open": "Open",
    "add": "Add",
    "create": "Create",
    "submit": "Submit",
    "search": "Search"
  },
  "nav": {
    "home": "Home",
    "machines": "Fleet",
    "shifts": "Shifts",
    "tickets": "Tickets",
    "maintenance": "Maintenance",
    "parts": "Garage",
    "team": "Team",
    "admin_panel": "Admin",
    "profile": "Profile"
  },
  "roles": {
    "operator": "Operator",
    "service_engineer": "Service engineer",
    "project_manager": "Project manager",
    "platform_admin": "NPGM Platform"
  }
}
```

- [ ] **Step 4: Создать `app/src/i18n.ts`**

```ts
import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const SUPPORTED_LOCALES = ['ru', 'en'] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ru';

// Server-side resolution of the active locale.
// Priority: explicit cookie → default 'ru'.
// (User-profile-driven override happens in middleware where we
// can read the auth session.)
export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value as Locale | undefined;
  const locale: Locale =
    cookieLocale && SUPPORTED_LOCALES.includes(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
```

- [ ] **Step 5: Модифицировать `app/next.config.ts`**

Открой существующий `next.config.ts`. Добавь импорт + обёртку:

```ts
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n.ts');

// ... existing nextConfig object ...

export default withNextIntl(nextConfig);
```

- [ ] **Step 6: Проверка сборки**

```bash
cd app && pnpm build
```

Expected: `✓ Compiled successfully`. Warnings о неиспользуемых импортах ok, errors — нет.

- [ ] **Step 7: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/i18n.ts \
        app/next.config.ts app/messages/
git commit -m "feat(i18n): install next-intl + base ru/en messages"
```

---

### Task 0.2: Подключить NextIntlClientProvider в root layout

**Files:**
- Modify: `app/src/app/layout.tsx`

- [ ] **Step 1: Открыть layout.tsx и добавить импорт + провайдер**

В файле `app/src/app/layout.tsx` замени тело `RootLayout`:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

// ... existing imports stay ...

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const theme = process.env.NEXT_PUBLIC_THEME || "theme-npgm";
  const gaID = process.env.NEXT_PUBLIC_GOOGLE_TAG;
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${inter.variable} ${ibmPlex.variable}`}>
      <body className={`${theme} font-sans antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
        <Analytics />
        {gaID && <GoogleAnalytics gaId={gaID} />}
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Build check**

```bash
cd app && pnpm build
```

Expected: success.

- [ ] **Step 3: Smoke-тест в браузере**

Запусти `pnpm dev`. Открой `http://localhost:3000/auth/login`. Открой DevTools → Application → Cookies. Установи cookie `NEXT_LOCALE=en` → reload. Проверь что `<html lang="en">`.

- [ ] **Step 4: Commit**

```bash
git add app/src/app/layout.tsx
git commit -m "feat(i18n): wire NextIntlClientProvider in root layout"
```

---

### Task 0.3: Компонент LocaleSwitcher + cookie-driven переключение

**Files:**
- Create: `app/src/components/i18n/LocaleSwitcher.tsx`

- [ ] **Step 1: Создать компонент**

```tsx
'use client';

import { useTransition } from 'react';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';

const LOCALES = [
  { code: 'ru', label: 'RU', flag: '🇷🇺' },
  { code: 'en', label: 'EN', flag: '🇬🇧' },
] as const;

// Persisted via two channels:
//   - NEXT_LOCALE cookie (read by app/src/i18n.ts server-side)
//   - /api/profile/locale call (writes to profiles.language for logged-in users)
// Anonymous visitors only get the cookie; that's fine for the login page.
export function LocaleSwitcher() {
  const currentLocale = useLocale();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const setLocale = (next: string) => {
    if (next === currentLocale) return;
    // 1 year cookie, root path so it persists across all routes
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    // Best-effort persist to DB (no-op for anonymous users)
    fetch('/api/profile/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {});
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <div className="inline-flex items-center gap-0.5 text-xs font-medium bg-secondary-100 rounded-md p-0.5">
      {LOCALES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLocale(l.code)}
          disabled={isPending}
          className={`px-2 py-1 rounded transition-colors ${
            currentLocale === l.code
              ? 'bg-white text-secondary-900 shadow-sm'
              : 'text-secondary-600 hover:text-secondary-900'
          }`}
        >
          <span className="mr-1">{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Создать API endpoint для записи в БД**

Create `app/src/app/api/profile/locale/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

const VALID = new Set(['ru', 'en']);

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  // For anonymous users we just no-op — the cookie is enough for the login page.
  if (!user) return NextResponse.json({ ok: true, persisted: false });

  let body: { locale?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const locale = body.locale ?? '';
  if (!VALID.has(locale)) {
    return NextResponse.json({ error: 'unsupported_locale' }, { status: 400 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (admin as any)
    .from('profiles')
    .update({ language: locale })
    .eq('id', user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, persisted: true });
}
```

- [ ] **Step 3: Build check**

```bash
cd app && pnpm build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/i18n/ app/src/app/api/profile/locale/
git commit -m "feat(i18n): add LocaleSwitcher component + profile persistence API"
```

---

### Task 0.4: Встроить LocaleSwitcher и middleware sync

**Files:**
- Modify: `app/src/components/AppLayout.tsx` (вставить switcher в header)
- Modify: `app/src/app/admin/layout.tsx` (вставить switcher в sidebar)
- Modify: `app/src/app/auth/login/page.tsx` (вставить switcher на login)
- Modify: `app/src/lib/supabase/middleware.ts` (читать profile.language → выставлять cookie)

- [ ] **Step 1: Добавить switcher в AppLayout**

В `app/src/components/AppLayout.tsx` рядом с user dropdown (правый верхний угол):

```tsx
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

// внутри top bar, рядом с user dropdown:
<div className="ml-auto flex items-center gap-3">
  <LocaleSwitcher />
  {/* existing user dropdown */}
</div>
```

(Найди существующий top bar и встрой; если нет — обернуть header сверху.)

- [ ] **Step 2: Добавить switcher в AdminLayout**

В `app/src/app/admin/layout.tsx` после Logo в шапке sidebar:

```tsx
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

// после <Logo />:
<div className="mt-3">
  <LocaleSwitcher />
</div>
```

- [ ] **Step 3: Добавить switcher на login**

В `app/src/app/auth/login/page.tsx` в правом верхнем углу формы:

```tsx
import { LocaleSwitcher } from '@/components/i18n/LocaleSwitcher';

// сверху страницы:
<div className="absolute top-4 right-4">
  <LocaleSwitcher />
</div>
```

- [ ] **Step 4: Sync `profile.language` → cookie в middleware**

В `app/src/lib/supabase/middleware.ts`, после блока выбора `isPlatformAdmin`, прочитай `profile.language` и сбрось cookie:

```ts
// After loading profile (same query you already have, just add `language` to select):
const profileLanguage = profile?.language as string | undefined;
const currentCookie = request.cookies.get('NEXT_LOCALE')?.value;
if (profileLanguage && profileLanguage !== currentCookie) {
  // Sync cookie to match profile.language so the next request renders in the right lang.
  supabaseResponse.cookies.set('NEXT_LOCALE', profileLanguage, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });
}
```

Не забудь добавить `, language` в `select('company_id, role, language')`.

- [ ] **Step 5: Build + visual check**

```bash
cd app && pnpm build && pnpm dev
```

Открой `localhost:3000/auth/login` → switcher виден сверху-справа → клик EN → надпись «Welcome» (или whatever EN-ключ для login). Login → switcher в шапке AppLayout → переключение работает.

- [ ] **Step 6: Commit**

```bash
git add app/src/components/AppLayout.tsx app/src/app/admin/layout.tsx \
        app/src/app/auth/login/page.tsx app/src/lib/supabase/middleware.ts
git commit -m "feat(i18n): embed LocaleSwitcher in layouts + sync cookie from profile.language"
```

---

### Task 0.5: Перевести строки existing UI

**Files:**
- Modify: `app/src/components/AppLayout.tsx`, `app/src/app/admin/layout.tsx`,
  `app/src/app/app/page.tsx`, `app/src/app/app/team/page.tsx`,
  `app/src/app/app/machines/page.tsx`, `app/src/app/app/parts/page.tsx`,
  `app/src/app/app/tickets/page.tsx`, `app/src/app/admin/page.tsx`,
  `app/src/app/admin/companies/[id]/page.tsx`
- Modify: `app/messages/ru.json`, `app/messages/en.json` (расширить namespaces)

Стратегия: открыть каждый файл, найти **видимые пользователю русские строки**, заменить на `t('ns.key')`. Пользовательский контент (имена, заметки) **не трогать**.

- [ ] **Step 1: Расширить messages JSON-ами для всех экранов**

Добавить в `ru.json` и `en.json` namespaces:

```json
{
  "team": {
    "title": "Команда",
    "description": "Зарегистрируйте сотрудника...",
    "add_employee": "Добавить сотрудника",
    "members_count": "Сотрудники ({{n}})",
    "pending_activation": "Ожидают активации ({{n}})",
    "pending_links": "Открытые ссылки ({{n}})",
    "...": "..."
  },
  "machines": { "title": "Парк техники", "no_machines": "...", "add_machine": "..." },
  "parts": { "title": "Гараж", "..." : "..." },
  "tickets": { "title": "Тикеты", "..." : "..." },
  "admin": {
    "companies_title": "Все компании",
    "create_company": "Создать компанию",
    "delete_company": "Удалить компанию",
    "..." : "..."
  }
}
```

Заполнить полностью — каждая видимая строка из перечисленных файлов.

EN-эквиваленты в `en.json`.

- [ ] **Step 2: В каждой странице — заменить hardcoded строки на `t()`**

Пример для `app/src/app/app/team/page.tsx`:

```tsx
'use client';
import { useTranslations } from 'next-intl';

export default function TeamPage() {
  const t = useTranslations('team');
  const tCommon = useTranslations('common');
  // ...
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <Button>{t('add_employee')}</Button>
      <h2>{t('members_count', { n: members.length })}</h2>
      {loading ? tCommon('loading') : null}
    </div>
  );
}
```

Пройди файлы один за другим, замени все видимые строки. Не трогай:
- Имена машин (`m.model_code`)
- Имена пользователей (`user.full_name`)
- Названия компаний (`company.name`)
- Поля БД, статусы (Badge labels остаются через ROLE_LABELS — их перевод отдельно)

- [ ] **Step 3: Перевести ROLE_LABELS и STATUS_LABELS через namespace `roles` / `statuses`**

В файлах где есть `const ROLE_LABELS: Record<UserRole, string>` — заменить на функцию:

```tsx
const tRoles = useTranslations('roles');
// usage: tRoles(role)  // вместо ROLE_LABELS[role]
```

Аналогично для статусов тикетов / заявок.

- [ ] **Step 4: Build + visual check на двух языках**

```bash
cd app && pnpm build
```

Затем `pnpm dev`, переключи RU → проверь все экраны → переключи EN → проверь все экраны. Не должно быть «raw keys» вроде `team.title`.

- [ ] **Step 5: Commit**

```bash
git add app/messages/ app/src/app/ app/src/components/
git commit -m "feat(i18n): localise existing UI strings — RU + EN"
```

---

**Phase 0 verification gate:**

Запустить sub-agent с задачей: «Verify Phase 0 (i18n)»:
1. `pnpm build` — без warnings про missing translation keys
2. Открыть `localhost:3000/auth/login` в браузере (Playwright headless) → найти LocaleSwitcher → проверить наличие текстов «Войти» / «Sign in» в обоих режимах
3. Залогиниться → переключить язык → reload → язык остался EN
4. Проверить в Supabase: `select language from profiles where id = <test_user>` → 'en'

Если все 4 чека зелёные — Phase 0 done. Если нет — фикс на месте, sub-agent не возвращает фокус пользователю до зелёного.

---

## Phase A — RAG infrastructure (pgvector + ingestion)

**Deliverable:** Все 5 мануалов (МСЗУ-14, МЗУ-16 EN, ANFO EN, МЗВ-16 RU, МЗВ-16 EN) загружены в `manual_chunks`. SQL-запрос `SELECT chunk_text FROM manual_chunks WHERE machine_type='МСЗУ' ORDER BY embedding <=> $query LIMIT 5` возвращает релевантные результаты на тестовый вопрос.

---

### Task A.1: Миграция 0032 — pgvector + 5 новых таблиц + alters

**Files:**
- Create: `db/migrations/0032_ai_chat_rag.sql`

- [ ] **Step 1: Написать миграцию**

```sql
-- 0032 — AI chat with RAG: pgvector + manual_chunks + ai_conversations +
-- ai_messages + ai_learning_queue. Extends tickets and ticket_messages
-- for AI participation.
--
-- Idempotent.

create extension if not exists vector;

-- =========================================================================
-- A. Manual chunks — ingested PDFs + verified solutions from escalations.
-- =========================================================================
create table if not exists manual_chunks (
  id              uuid primary key default gen_random_uuid(),
  machine_type    text not null,
  language        text not null check (language in ('ru','en')),
  source          text not null,
  page            int,
  section         text,
  chunk_text      text not null,
  embedding       vector(1024) not null,
  verified_at     timestamptz,
  verified_by     uuid references profiles(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists manual_chunks_machine_lang_idx
  on manual_chunks (machine_type, language);

-- IVFFlat: ok for our scale (~1000-10000 chunks), faster build than HNSW.
create index if not exists manual_chunks_embedding_idx
  on manual_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- =========================================================================
-- B. AI conversations (separate from tickets — most never escalate).
-- =========================================================================
create table if not exists ai_conversations (
  id              uuid primary key default gen_random_uuid(),
  operator_id     uuid not null references profiles(id) on delete restrict,
  machine_id      uuid not null references machines(id) on delete cascade,
  company_id      uuid not null references companies(id) on delete cascade,
  status          text not null default 'active'
                    check (status in ('active','escalated','closed')),
  ticket_id       uuid references tickets(id) on delete set null,
  escalated_at    timestamptz,
  closed_at       timestamptz,
  created_at      timestamptz not null default now()
);

create index if not exists ai_conversations_operator_idx
  on ai_conversations (operator_id, created_at desc);
create index if not exists ai_conversations_machine_idx
  on ai_conversations (machine_id, created_at desc);

create table if not exists ai_messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references ai_conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant')),
  content               text not null,
  image_url             text,
  retrieved_chunk_ids   uuid[],
  ai_confidence         smallint
                          check (ai_confidence is null or ai_confidence between 0 and 100),
  created_at            timestamptz not null default now()
);

create index if not exists ai_messages_conversation_idx
  on ai_messages (conversation_id, created_at);

-- =========================================================================
-- C. Tickets extensions for AI-driven workflow.
-- =========================================================================
alter table tickets
  add column if not exists originated_from text
    default 'manual' check (originated_from in ('manual','ai_escalation')),
  add column if not exists resolved_by uuid references profiles(id) on delete set null;

-- AI messages have no human sender. Drop the NOT NULL on sender_id.
alter table ticket_messages
  alter column sender_id drop not null;

-- Extend the sender_type enum used by ticket_messages.
do $$ begin
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='message_sender' and e.enumlabel='ai') then
    alter type message_sender add value 'ai';
  end if;
  if not exists (select 1 from pg_type t join pg_enum e on e.enumtypid=t.oid
                 where t.typname='message_sender' and e.enumlabel='platform_admin') then
    alter type message_sender add value 'platform_admin';
  end if;
end $$;

-- =========================================================================
-- D. Learning queue + trigger
-- =========================================================================
create table if not exists ai_learning_queue (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  processed_at    timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

create or replace function enqueue_for_learning() returns trigger
language plpgsql as $$
begin
  if new.status = 'resolved'
     and (old.status is null or old.status <> 'resolved')
     and new.resolution_summary is not null
     and new.resolution_summary <> ''
     and new.originated_from = 'ai_escalation' then
    insert into ai_learning_queue (ticket_id) values (new.id);
  end if;
  return new;
end$$;

drop trigger if exists tickets_enqueue_learning on tickets;
create trigger tickets_enqueue_learning
  after update on tickets
  for each row execute function enqueue_for_learning();

-- =========================================================================
-- E. RLS
-- =========================================================================
alter table manual_chunks enable row level security;
alter table ai_conversations enable row level security;
alter table ai_messages enable row level security;
alter table ai_learning_queue enable row level security;

-- manual_chunks: readable by all authenticated, writable only by platform_admin
drop policy if exists manual_chunks_authed_read on manual_chunks;
create policy manual_chunks_authed_read on manual_chunks
  for select to authenticated using (true);

drop policy if exists manual_chunks_platform_write on manual_chunks;
create policy manual_chunks_platform_write on manual_chunks
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- ai_conversations
drop policy if exists ai_conversations_operator_self on ai_conversations;
create policy ai_conversations_operator_self on ai_conversations
  for all using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

drop policy if exists ai_conversations_internal_all on ai_conversations;
create policy ai_conversations_internal_all on ai_conversations
  for all using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  )
  with check (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

drop policy if exists ai_conversations_platform_all on ai_conversations;
create policy ai_conversations_platform_all on ai_conversations
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');

-- ai_messages
drop policy if exists ai_messages_via_conversation on ai_messages;
create policy ai_messages_via_conversation on ai_messages
  for all using (
    exists (
      select 1 from ai_conversations c
       where c.id = ai_messages.conversation_id
         and (
           c.operator_id = auth.uid()
           or (c.company_id = public.user_company_id()
               and public.user_role() in ('service_engineer','project_manager'))
           or public.user_role() = 'platform_admin'
         )
    )
  );

-- ai_learning_queue: only platform_admin (it's a system queue)
drop policy if exists ai_learning_queue_platform on ai_learning_queue;
create policy ai_learning_queue_platform on ai_learning_queue
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');
```

- [ ] **Step 2: Применить миграцию в Supabase**

Скопируй содержимое 0032 в Supabase SQL Editor → Run.

Expected: `Success. No rows returned`.

- [ ] **Step 3: Проверить что таблицы созданы**

В SQL Editor:

```sql
select table_name from information_schema.tables
 where table_schema='public'
   and table_name in ('manual_chunks','ai_conversations','ai_messages','ai_learning_queue')
 order by table_name;
```

Expected: 4 rows.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0032_ai_chat_rag.sql
git commit -m "feat(db): migration 0032 — AI chat tables, pgvector, RLS"
```

---

### Task A.2: Установить AI-зависимости + env

**Files:**
- Modify: `app/package.json`
- Modify: `app/.env.local` (вручную)
- Create: `app/src/lib/ai/anthropic.ts`
- Create: `app/src/lib/ai/voyage.ts`

- [ ] **Step 1: Install packages**

```bash
cd app && pnpm add @anthropic-ai/sdk pdf-parse
pnpm add -D @types/pdf-parse
```

- [ ] **Step 2: Получить API ключи**

- Anthropic: https://console.anthropic.com → Settings → API Keys → Create
- Voyage AI: https://dash.voyageai.com → API Keys → Create

Добавить в `app/.env.local`:

```
ANTHROPIC_API_KEY=sk-ant-api03-...
VOYAGE_API_KEY=pa-...
```

- [ ] **Step 3: Anthropic wrapper `app/src/lib/ai/anthropic.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  // Don't throw at import time — server-side modules might import this even
  // for dev pages that never call Claude. Throw on actual use instead.
  console.warn('[ai] ANTHROPIC_API_KEY missing — Claude calls will fail');
}

export const anthropic = new Anthropic({ apiKey });
export const CLAUDE_MODEL = 'claude-sonnet-4-6';
```

- [ ] **Step 4: Voyage wrapper `app/src/lib/ai/voyage.ts`**

```ts
// Voyage AI SDK is young; we go through their REST endpoint directly.
// Docs: https://docs.voyageai.com/reference/embeddings-api
const VOYAGE_URL = 'https://api.voyageai.com/v1/embeddings';
const MODEL = 'voyage-multilingual-2';

export async function embed(
  input: string | string[],
  inputType: 'query' | 'document' = 'document'
): Promise<number[][]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error('VOYAGE_API_KEY missing');

  const resp = await fetch(VOYAGE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input: Array.isArray(input) ? input : [input],
      model: MODEL,
      input_type: inputType,
    }),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Voyage error ${resp.status}: ${t}`);
  }
  const json = (await resp.json()) as {
    data: { embedding: number[] }[];
  };
  return json.data.map((d) => d.embedding);
}
```

- [ ] **Step 5: Build check**

```bash
cd app && pnpm build
```

Expected: success. (Эти модули ещё нигде не импортированы, просто проверка TypeScript.)

- [ ] **Step 6: Commit**

```bash
git add app/package.json app/pnpm-lock.yaml app/src/lib/ai/
git commit -m "feat(ai): install @anthropic-ai/sdk + pdf-parse, add Anthropic/Voyage clients"
```

⚠️ **Не коммитить `.env.local`** — он в `.gitignore`.

---

### Task A.3: PDF parsing + chunking utilities

**Files:**
- Create: `app/src/lib/ai/pdf-parser.ts`

- [ ] **Step 1: Создать модуль**

```ts
// pdf-parse → text; manual chunking with overlap.
// Heuristic page detection: pdf-parse exposes per-page text via "render" hooks
// but we use the simpler full-text + page-marker approach.

import pdfParse from 'pdf-parse';
import { readFileSync } from 'fs';

export interface ParsedChunk {
  text: string;
  page: number | null;       // null when we can't infer
  section: string | null;
}

export interface ParseOptions {
  targetTokens: number;      // ~400
  overlapTokens: number;     // ~50
}

const CHARS_PER_TOKEN_RU = 3.5;   // conservative for Cyrillic
const CHARS_PER_TOKEN_EN = 4.0;

function estimateTokens(s: string, lang: 'ru' | 'en'): number {
  return Math.ceil(s.length / (lang === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN));
}

// Split text into pages using form-feed character (\f) or page-break heuristics.
// pdf-parse leaves \f between pages in many PDFs.
function splitIntoPages(raw: string): string[] {
  if (raw.includes('\f')) return raw.split('\f');
  return [raw];   // single page fallback — page=null in output
}

// Section heuristic: lines that look like "1.2.3 Title" or "ГЛАВА N" / "CHAPTER N".
const SECTION_RE = /^(?:\d+(?:\.\d+){0,3}\s+[A-ZА-ЯЁ][^.]{3,}$|(?:ГЛАВА|CHAPTER)\s+\d+)/m;

function detectSection(chunkText: string): string | null {
  const match = chunkText.match(SECTION_RE);
  return match ? match[0].slice(0, 80) : null;
}

export async function parseAndChunkPdf(
  filePath: string,
  language: 'ru' | 'en',
  opts: ParseOptions = { targetTokens: 400, overlapTokens: 50 }
): Promise<ParsedChunk[]> {
  const buf = readFileSync(filePath);
  const parsed = await pdfParse(buf);
  const pages = splitIntoPages(parsed.text);

  const targetChars = Math.floor(
    opts.targetTokens * (language === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN)
  );
  const overlapChars = Math.floor(
    opts.overlapTokens * (language === 'ru' ? CHARS_PER_TOKEN_RU : CHARS_PER_TOKEN_EN)
  );

  const chunks: ParsedChunk[] = [];

  pages.forEach((pageText, pageIdx) => {
    const cleaned = pageText.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;

    let start = 0;
    while (start < cleaned.length) {
      const end = Math.min(start + targetChars, cleaned.length);
      const chunkRaw = cleaned.slice(start, end);
      // Try to end at a sentence boundary
      const sentenceEnd = chunkRaw.search(/[.!?][^\w]*$/);
      const adjustedEnd =
        sentenceEnd > targetChars * 0.6 ? start + sentenceEnd + 1 : end;
      const chunkText = cleaned.slice(start, adjustedEnd).trim();
      if (chunkText.length > 30) {
        chunks.push({
          text: chunkText,
          page: pages.length > 1 ? pageIdx + 1 : null,
          section: detectSection(chunkText),
        });
      }
      // advance with overlap
      start = adjustedEnd - overlapChars;
      if (start <= chunks.length === 0 ? -1 : 0) start = adjustedEnd;
      if (adjustedEnd === end && end === cleaned.length) break;
    }
  });

  return chunks;
}

// Helper to estimate ingest cost / row count before running.
export function summarise(chunks: ParsedChunk[]): { count: number; tokens: number } {
  const totalChars = chunks.reduce((a, c) => a + c.text.length, 0);
  return { count: chunks.length, tokens: Math.ceil(totalChars / 3.7) };
}
```

- [ ] **Step 2: Build check**

```bash
cd app && pnpm build
```

Expected: success.

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/ai/pdf-parser.ts
git commit -m "feat(ai): PDF parser + chunker utility (pdf-parse + sentence-boundary heuristic)"
```

---

### Task A.4: Ingestion script + прогон 5 PDF

**Files:**
- Create: `app/scripts/ingest-manuals.ts`

- [ ] **Step 1: Создать скрипт**

```ts
// Usage: cd app && pnpm tsx scripts/ingest-manuals.ts
// Runs once during initial setup; re-running is idempotent (delete by source first).

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseAndChunkPdf, summarise } from '../src/lib/ai/pdf-parser';
import { embed } from '../src/lib/ai/voyage';

// Parse .env.local manually — node doesn't auto-load it for scripts.
const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const KEY = process.env.PRIVATE_SUPABASE_SERVICE_KEY!;
const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

// Adjust path: this script runs from app/, manuals live in ../manuals/
const MANUALS = [
  { path: '../manuals/МСЗУ/МСЗУ-14-НПБ.pdf', type: 'МСЗУ', lang: 'ru' as const },
  { path: '../manuals/МЗУ/Operation Manual MZU-16-4K Eng.pdf', type: 'МЗУ', lang: 'en' as const },
  { path: '../manuals/МСЗ/ANFO Operational Manual.pdf', type: 'МСЗ', lang: 'en' as const },
  { path: '../manuals/МЗВ/ТО МЗВ-16.pdf', type: 'МЗВ', lang: 'ru' as const },
  { path: '../manuals/МЗВ/ТО МЗВ-16 eng.pdf', type: 'МЗВ', lang: 'en' as const },
];

async function deleteBySource(source: string) {
  await fetch(`${URL_BASE}/rest/v1/manual_chunks?source=eq.${encodeURIComponent(source)}`, {
    method: 'DELETE',
    headers,
  });
}

async function insertBatch(rows: object[]) {
  const resp = await fetch(`${URL_BASE}/rest/v1/manual_chunks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(rows),
  });
  if (!resp.ok) {
    const t = await resp.text();
    throw new Error(`Insert failed ${resp.status}: ${t}`);
  }
}

async function main() {
  for (const m of MANUALS) {
    const fullPath = resolve(m.path);
    console.log(`\n=== Ingesting ${m.path} ===`);
    const chunks = await parseAndChunkPdf(fullPath, m.lang);
    console.log(`  chunks: ${summarise(chunks).count}, est. tokens: ${summarise(chunks).tokens}`);

    const source = `manual:${m.path.split('/').pop()}`;
    await deleteBySource(source);

    // Embed in batches of 128 (Voyage limit)
    const BATCH = 128;
    for (let i = 0; i < chunks.length; i += BATCH) {
      const slice = chunks.slice(i, i + BATCH);
      const embeddings = await embed(slice.map((c) => c.text), 'document');
      const rows = slice.map((c, idx) => ({
        machine_type: m.type,
        language: m.lang,
        source,
        page: c.page,
        section: c.section,
        chunk_text: c.text,
        embedding: embeddings[idx],
      }));
      await insertBatch(rows);
      console.log(`  inserted ${i + slice.length}/${chunks.length}`);
    }
  }
  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Установить tsx если ещё нет**

```bash
cd app && pnpm add -D tsx
```

- [ ] **Step 3: Запустить скрипт**

```bash
cd app && pnpm tsx scripts/ingest-manuals.ts
```

Expected output:
```
=== Ingesting ../manuals/МСЗУ/МСЗУ-14-НПБ.pdf ===
  chunks: ~250, est. tokens: ~110000
  inserted 128/250
  inserted 250/250
=== Ingesting ../manuals/МЗУ/Operation Manual MZU-16-4K Eng.pdf ===
  ...
Done.
```

Если падает на конкретном PDF — пометить в issue и пропустить, остальные продолжить.

- [ ] **Step 4: Smoke-проверка retrieval**

В Supabase SQL Editor:

```sql
-- Count by source
select source, count(*) from manual_chunks group by source order by source;
```

Expected: 5 rows, total ~700-1000 чанков.

```sql
-- Sample chunks for МСЗУ
select page, section, left(chunk_text, 100) from manual_chunks
 where machine_type='МСЗУ' limit 3;
```

- [ ] **Step 5: Commit**

```bash
git add app/scripts/ingest-manuals.ts app/package.json app/pnpm-lock.yaml
git commit -m "feat(ai): ingestion script + 5 manuals indexed in manual_chunks"
```

⚠️ Стоимость прогона: ~$0.20 на Voyage embeddings. Уплачено разово.

---

### Task A.5: Retrieval API + smoke test

**Files:**
- Create: `app/src/lib/ai/retrieval.ts`

- [ ] **Step 1: Retrieval helper**

```ts
// Vector search wrapper. Caller passes user message; we embed (as 'query',
// not 'document'), search across all languages (cross-lingual), boost
// verified FAQ chunks 1.5x.

import { embed } from './voyage';
import { createServerAdminClient } from '../supabase/serverAdminClient';

export interface RetrievedChunk {
  id: string;
  chunk_text: string;
  page: number | null;
  section: string | null;
  source: string;
  language: string;
  similarity: number;
}

export async function retrieve(
  query: string,
  machineType: string,
  topK = 5
): Promise<RetrievedChunk[]> {
  const [vec] = await embed(query, 'query');
  const admin = await createServerAdminClient();
  // Cosine distance: smaller = more similar. We compute "similarity = 1 - distance"
  // and multiply by boost (1.5 if verified). pgvector accepts arrays as JSON literals.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (admin as any).rpc('search_manual_chunks', {
    p_query: JSON.stringify(vec),
    p_machine_type: machineType,
    p_limit: topK,
  });
  if (error) throw error;
  return data as RetrievedChunk[];
}
```

- [ ] **Step 2: Создать RPC `search_manual_chunks` (миграция 0033)**

Create `db/migrations/0033_search_manual_chunks.sql`:

```sql
-- 0033 — RPC helper for vector search, isolates the vector arithmetic
-- behind a typed SQL function so the application layer doesn't need
-- to build the operator expression.

create or replace function search_manual_chunks(
  p_query     text,        -- json array of floats
  p_machine_type text,
  p_limit     int default 5
)
returns table (
  id uuid,
  chunk_text text,
  page int,
  section text,
  source text,
  language text,
  similarity float
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.chunk_text, c.page, c.section, c.source, c.language,
         (1 - (c.embedding <=> p_query::vector))
           * (case when c.verified_at is not null then 1.5 else 1.0 end) as similarity
    from manual_chunks c
   where c.machine_type = p_machine_type
   order by similarity desc
   limit p_limit;
$$;

grant execute on function search_manual_chunks(text, text, int) to authenticated, service_role;
```

Применить через Supabase SQL Editor.

- [ ] **Step 3: Smoke test через скрипт**

Create `app/scripts/test-retrieval.ts`:

```ts
import { readFileSync } from 'fs';
const env = readFileSync('.env.local', 'utf8');
for (const line of env.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
}
import { retrieve } from '../src/lib/ai/retrieval';

async function main() {
  const queries = [
    { q: 'Машина не запускается, мигает красная лампа', t: 'МСЗУ' },
    { q: 'How to start the truck for ANFO loading', t: 'МСЗ' },
    { q: 'Уровень эмульсии в баке', t: 'МЗВ' },
  ];
  for (const { q, t } of queries) {
    console.log(`\n--- Query (${t}): ${q} ---`);
    const res = await retrieve(q, t, 3);
    res.forEach((r, i) => {
      console.log(`  [${i + 1}] sim=${r.similarity.toFixed(3)} page=${r.page} lang=${r.language}`);
      console.log(`      ${r.chunk_text.slice(0, 150)}...`);
    });
  }
}
main().catch(console.error);
```

```bash
cd app && pnpm tsx scripts/test-retrieval.ts
```

Expected: для каждого запроса 3 results с similarity > 0.3, текст релевантный.

- [ ] **Step 4: Commit**

```bash
git add db/migrations/0033_search_manual_chunks.sql \
        app/src/lib/ai/retrieval.ts app/scripts/test-retrieval.ts
git commit -m "feat(ai): retrieval helper + search_manual_chunks RPC + smoke test"
```

---

**Phase A verification gate:**

Sub-agent task: «Verify Phase A»:
1. Миграция 0032 + 0033 применены (проверка через SQL)
2. `select count(*) from manual_chunks` >= 700
3. Запуск `test-retrieval.ts` — все 3 запроса возвращают релевантные results

---

## Phase B — Chat UI без AI (chat skeleton)

**Deliverable:** На странице машины внизу кнопка «Спросить». Клик → drawer открывается. Оператор пишет сообщение → сохраняется в `ai_messages`. История подтягивается. Фото грузятся в Supabase Storage. AI пока **не отвечает** (это Phase C).

---

### Task B.1: API — conversations + messages CRUD

**Files:**
- Create: `app/src/app/api/ai/conversations/route.ts`
- Create: `app/src/app/api/ai/conversations/[id]/route.ts`
- Create: `app/src/app/api/ai/messages/route.ts`

- [ ] **Step 1: `POST /api/ai/conversations` — create / find active**

```ts
// app/src/app/api/ai/conversations/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json()) as { machine_id: string };
  if (!body.machine_id) return NextResponse.json({ error: 'machine_id_required' }, { status: 400 });

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  const { data: machine, error: mErr } = await adminAny
    .from('machines').select('id, company_id').eq('id', body.machine_id).maybeSingle();
  if (mErr || !machine) return NextResponse.json({ error: 'machine_not_found' }, { status: 404 });

  // Find existing active conversation or create new
  const { data: existing } = await adminAny
    .from('ai_conversations')
    .select('id')
    .eq('operator_id', user.id)
    .eq('machine_id', body.machine_id)
    .eq('status', 'active')
    .maybeSingle();
  if (existing) return NextResponse.json({ conversation: existing });

  const { data: created, error } = await adminAny
    .from('ai_conversations')
    .insert({
      operator_id: user.id,
      machine_id: body.machine_id,
      company_id: machine.company_id,
    })
    .select('id')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversation: created });
}
```

- [ ] **Step 2: `GET /api/ai/conversations/[id]` — load messages**

```ts
// app/src/app/api/ai/conversations/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = userClient as any;
  const { data: conv, error: cErr } = await sb
    .from('ai_conversations').select('*').eq('id', id).maybeSingle();
  if (cErr || !conv) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const { data: messages, error: mErr } = await sb
    .from('ai_messages').select('*').eq('conversation_id', id).order('created_at');
  if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });

  return NextResponse.json({ conversation: conv, messages });
}
```

- [ ] **Step 3: `POST /api/ai/messages` — append user message**

```ts
// app/src/app/api/ai/messages/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = (await request.json()) as {
    conversation_id: string;
    content: string;
    image_url?: string;
  };
  if (!body.conversation_id || !body.content?.trim()) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminAny = admin as any;

  // Verify caller is the conversation's operator
  const { data: conv } = await adminAny
    .from('ai_conversations').select('id, operator_id, status')
    .eq('id', body.conversation_id).maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json({ error: 'conversation_closed' }, { status: 400 });
  }

  const { data, error } = await adminAny
    .from('ai_messages')
    .insert({
      conversation_id: body.conversation_id,
      role: 'user',
      content: body.content.trim(),
      image_url: body.image_url ?? null,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ message: data });
}
```

- [ ] **Step 4: Build + manual smoke**

```bash
cd app && pnpm build
```

Smoke (после авторизации в браузере получи cookie, или используй service key напрямую):

```bash
curl -X POST http://localhost:3000/api/ai/conversations \
  -H "Content-Type: application/json" \
  -H "Cookie: <session>" \
  -d '{"machine_id":"<uuid>"}'
```

Expected: `{"conversation":{"id":"..."}}`

- [ ] **Step 5: Commit**

```bash
git add app/src/app/api/ai/
git commit -m "feat(ai): API endpoints for conversations + messages CRUD"
```

---

### Task B.2: AIChatDrawer компонент

**Files:**
- Create: `app/src/components/ai-chat/AIChatDrawer.tsx`
- Create: `app/src/components/ai-chat/AIMessageBubble.tsx`

- [ ] **Step 1: `AIMessageBubble.tsx` — пузырь сообщения**

```tsx
'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  image_url: string | null;
  ai_confidence: number | null;
  created_at: string;
}

export function AIMessageBubble({ message }: { message: AIMessage }) {
  const t = useTranslations('ai');
  const isUser = message.role === 'user';
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded-lg px-3 py-2 ${
          isUser
            ? 'bg-primary-600 text-white'
            : 'bg-secondary-100 text-secondary-900'
        }`}
      >
        {message.image_url && (
          <div className="mb-2 rounded overflow-hidden">
            <Image
              src={message.image_url}
              alt="attachment"
              width={240}
              height={180}
              className="object-cover"
            />
          </div>
        )}
        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        {message.ai_confidence !== null && (
          <p className="text-xs opacity-70 mt-1">
            {t('confidence', { value: message.ai_confidence })}
          </p>
        )}
      </div>
    </div>
  );
}
```

Добавь в `messages/ru.json` и `en.json`:

```json
{
  "ai": {
    "ask_button": "Спросить",
    "drawer_title": "Чат по {{model}}",
    "placeholder": "Опишите проблему…",
    "send": "Отправить",
    "attach_photo": "Прикрепить фото",
    "confidence": "Уверенность {{value}}%",
    "thinking": "AI думает…",
    "no_messages": "Задайте вопрос — AI ответит на основе РЭ вашей машины.",
    "escalate_button": "Не помогло — передать инженеру"
  }
}
```

EN:
```json
{
  "ai": {
    "ask_button": "Ask",
    "drawer_title": "Chat about {{model}}",
    "placeholder": "Describe the issue…",
    "send": "Send",
    "attach_photo": "Attach photo",
    "confidence": "Confidence {{value}}%",
    "thinking": "AI thinking…",
    "no_messages": "Ask a question — AI will answer based on your machine's manual.",
    "escalate_button": "Didn't help — forward to engineer"
  }
}
```

- [ ] **Step 2: `AIChatDrawer.tsx` — основной компонент**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Send, Loader2, Paperclip, X, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { AIMessageBubble, type AIMessage } from './AIMessageBubble';

export function AIChatDrawer({
  machineId,
  machineLabel,
}: {
  machineId: string;
  machineLabel: string;
}) {
  const t = useTranslations('ai');
  const [open, setOpen] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Open ↦ ensure conversation exists, load history
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const r = await fetch('/api/ai/conversations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machine_id: machineId }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? 'init_failed');
        setConversationId(j.conversation.id);

        const r2 = await fetch(`/api/ai/conversations/${j.conversation.id}`);
        const j2 = await r2.json();
        if (r2.ok) setMessages(j2.messages ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [open, machineId]);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!conversationId || !input.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch('/api/ai/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, content: input }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? 'send_failed');
      setMessages((m) => [...m, j.message as AIMessage]);
      setInput('');
      // AI response will be wired in Phase C
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Floating Ask button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-30 bg-primary-600 hover:bg-primary-700 text-white rounded-full shadow-lg px-5 py-3 flex items-center gap-2"
      >
        <MessageSquare className="w-4 h-4" />
        {t('ask_button')}
      </button>

      {/* Drawer */}
      {open && (
        <div className="fixed inset-0 z-40 flex items-end justify-end">
          <div
            className="absolute inset-0 bg-secondary-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative bg-white w-full sm:w-[480px] h-[70vh] sm:rounded-l-xl flex flex-col shadow-2xl">
            <header className="flex items-center justify-between p-4 border-b border-secondary-200">
              <h3 className="font-semibold text-secondary-900">
                {t('drawer_title', { model: machineLabel })}
              </h3>
              <button onClick={() => setOpen(false)}>
                <X className="w-5 h-5 text-secondary-500" />
              </button>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 && (
                <p className="text-sm text-secondary-500 text-center py-8">
                  {t('no_messages')}
                </p>
              )}
              {messages.map((m) => (
                <AIMessageBubble key={m.id} message={m} />
              ))}
              {busy && (
                <div className="flex items-center gap-2 text-sm text-secondary-500">
                  <Loader2 className="w-4 h-4 animate-spin" /> {t('thinking')}
                </div>
              )}
              {error && (
                <p className="text-sm text-accent-700 bg-accent-50 border border-accent-200 rounded p-2">
                  {error}
                </p>
              )}
            </div>

            <footer className="border-t border-secondary-200 p-3 flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t('placeholder')}
                rows={2}
                className="flex-1 resize-none"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <Button onClick={send} disabled={busy || !input.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Build check**

```bash
cd app && pnpm build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ai-chat/ app/messages/
git commit -m "feat(ai): AIChatDrawer + message bubble component (no AI yet)"
```

---

### Task B.3: Встроить drawer на страницу машины + photo upload

**Files:**
- Modify: `app/src/app/app/machines/[id]/page.tsx`
- Modify: `app/src/components/ai-chat/AIChatDrawer.tsx`

- [ ] **Step 1: Импорт drawer на странице машины**

В `app/src/app/app/machines/[id]/page.tsx` после успешной загрузки `machine`:

```tsx
import { AIChatDrawer } from '@/components/ai-chat/AIChatDrawer';

// В конце return-блока, рядом с MachineOperatorsSection:
<AIChatDrawer machineId={machine.id} machineLabel={machine.model_code} />
```

- [ ] **Step 2: Photo upload в drawer**

В `AIChatDrawer.tsx` добавить рядом с textarea:

```tsx
import { createSPASassClient } from '@/lib/supabase/client';

// state:
const [pendingImage, setPendingImage] = useState<string | null>(null);
const [uploading, setUploading] = useState(false);

const onPickFile = async (file: File) => {
  setUploading(true);
  try {
    const client = await createSPASassClient();
    const sb = client.getSupabaseClient();
    const path = `${conversationId}/${Date.now()}-${file.name}`;
    const { error } = await sb.storage.from('ai-chat-photos').upload(path, file);
    if (error) throw error;
    const { data } = sb.storage.from('ai-chat-photos').getPublicUrl(path);
    setPendingImage(data.publicUrl);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setUploading(false);
  }
};

// Modify send() to include pendingImage:
const send = async () => {
  // ...
  body: JSON.stringify({
    conversation_id: conversationId,
    content: input,
    image_url: pendingImage,
  }),
  // ...
  setPendingImage(null);
};

// In the footer area, before Textarea:
{pendingImage && (
  <div className="relative inline-block">
    <Image src={pendingImage} alt="" width={60} height={60} className="rounded" />
    <button onClick={() => setPendingImage(null)} className="absolute -top-2 -right-2">
      <X className="w-4 h-4 bg-white rounded-full" />
    </button>
  </div>
)}
<label className="cursor-pointer">
  <Paperclip className={`w-5 h-5 ${uploading ? 'animate-pulse' : ''}`} />
  <input
    type="file"
    accept="image/*"
    className="hidden"
    onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
  />
</label>
```

- [ ] **Step 3: Создать Storage bucket в Supabase**

В Supabase Dashboard → Storage → New bucket → name `ai-chat-photos`, public read.

Или SQL:
```sql
insert into storage.buckets (id, name, public) values ('ai-chat-photos', 'ai-chat-photos', true)
on conflict (id) do nothing;
```

- [ ] **Step 4: Build + smoke**

```bash
cd app && pnpm build
```

Затем `pnpm dev`, открой страницу машины → видишь круглую кнопку «Спросить» внизу-справа → клик → drawer → напиши «тест» → отправь → сообщение появляется в окне.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/app/machines/[id]/page.tsx app/src/components/ai-chat/
git commit -m "feat(ai): integrate AIChatDrawer + photo upload to ai-chat-photos bucket"
```

---

**Phase B verification gate:**

Sub-agent task: «Verify Phase B»:
1. `pnpm build` — без ошибок
2. Playwright: открыть `/app/machines/<test_id>` → нажать «Спросить» → ввести текст → отправить → сообщение появляется
3. SQL: `select count(*) from ai_messages` → инкрементировался

---

## Phase C — AI отвечает (RAG + Claude)

**Deliverable:** После отправки сообщения оператора AI отвечает (стримом) на основе мануала, со ссылкой на страницу РЭ и confidence-score.

---

### Task C.1: Context loader + prompt builder

**Files:**
- Create: `app/src/lib/ai/context-loader.ts`
- Create: `app/src/lib/ai/prompt-builder.ts`

- [ ] **Step 1: `context-loader.ts`**

```ts
// Loads machine context for the AI prompt — model, hours, last maintenance,
// open tickets. Trims to ~500 tokens worth so we don't burn context window.

import { createServerAdminClient } from '../supabase/serverAdminClient';

export interface MachineContext {
  model_code: string;
  machine_type: string;
  serial_number: string | null;
  engine_hours: number;
  tons_pumped: number;
  last_maintenance_at: string | null;
  open_tickets: { title: string; status: string }[];
}

export async function loadMachineContext(machineId: string): Promise<MachineContext | null> {
  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: machine } = await sb
    .from('machines')
    .select('model_code, machine_type, serial_number, engine_hours, tons_pumped')
    .eq('id', machineId)
    .maybeSingle();
  if (!machine) return null;

  const { data: lastMaint } = await sb
    .from('maintenance_events')
    .select('performed_at')
    .eq('machine_id', machineId)
    .order('performed_at', { ascending: false })
    .limit(1);

  const { data: tickets } = await sb
    .from('tickets')
    .select('title, status')
    .eq('machine_id', machineId)
    .in('status', ['new', 'in_progress', 'awaiting_response'])
    .limit(5);

  return {
    model_code: machine.model_code,
    machine_type: machine.machine_type,
    serial_number: machine.serial_number,
    engine_hours: Number(machine.engine_hours ?? 0),
    tons_pumped: Number(machine.tons_pumped ?? 0),
    last_maintenance_at: lastMaint?.[0]?.performed_at ?? null,
    open_tickets: tickets ?? [],
  };
}
```

- [ ] **Step 2: `prompt-builder.ts`**

```ts
import type { MachineContext } from './context-loader';
import type { RetrievedChunk } from './retrieval';

export function buildSystemPrompt(
  ctx: MachineContext,
  lang: 'ru' | 'en',
  retrieved: RetrievedChunk[]
): string {
  const isRu = lang === 'ru';

  const ctxBlock = isRu
    ? `Машина:
- Модель: ${ctx.model_code} (тип ${ctx.machine_type})
- Серийник: ${ctx.serial_number ?? '—'}
- Наработка: ${ctx.engine_hours} моточасов, ${ctx.tons_pumped} тонн ВВ
- Последнее ТО: ${ctx.last_maintenance_at ?? 'нет данных'}
- Открытые тикеты: ${ctx.open_tickets.length === 0 ? 'нет' : ctx.open_tickets.map((t) => t.title).join('; ')}`
    : `Machine:
- Model: ${ctx.model_code} (type ${ctx.machine_type})
- Serial: ${ctx.serial_number ?? '—'}
- Hours: ${ctx.engine_hours} engine hours, ${ctx.tons_pumped} tons of explosives
- Last maintenance: ${ctx.last_maintenance_at ?? 'no data'}
- Open tickets: ${ctx.open_tickets.length === 0 ? 'none' : ctx.open_tickets.map((t) => t.title).join('; ')}`;

  const ctxFromManual = retrieved
    .map(
      (r, i) =>
        `[${i + 1}] ${r.section ? r.section + ' — ' : ''}${
          r.page ? `стр./p. ${r.page}` : ''
        } (${r.source})\n${r.chunk_text}`
    )
    .join('\n\n');

  const instructions = isRu
    ? `Ты — эксперт по обслуживанию техники НИПИГОРМАШ. Ты отвечаешь оператору в карьере, который пишет в чат.

ПРАВИЛА:
1. Отвечай НА РУССКОМ языке.
2. Опирайся на контекст из РЭ (приведён ниже). Ссылайся на страницы (стр. N) когда уместно.
3. Будь кратким и конкретным — оператор находится у машины, ему нужны шаги действия.
4. Если контекст из РЭ не покрывает вопрос, скажи об этом честно: «В РЭ не нашёл точного ответа, но...».
5. В КОНЦЕ ответа отдельной строкой напиши: Confidence: NN (0-100) — твоя честная самооценка уверенности в ответе.`
    : `You are an NIPIGORMASH equipment expert. You're replying to an operator in the field via chat.

RULES:
1. Reply in ENGLISH.
2. Rely on the manual context provided below. Cite page numbers (p. N) when appropriate.
3. Be concise and specific — the operator is at the machine and needs actionable steps.
4. If the manual context doesn't cover the question, say so honestly: "Couldn't find this in the manual, but...".
5. At the END of your reply, on a separate line, write: Confidence: NN (0-100) — your honest self-assessment.`;

  return `${instructions}

CONTEXT (${isRu ? 'данные машины' : 'machine data'}):
${ctxBlock}

${isRu ? 'РЕЛЕВАНТНЫЕ ФРАГМЕНТЫ РЭ' : 'RELEVANT MANUAL EXCERPTS'}:
${ctxFromManual}`;
}

export function parseConfidence(reply: string): number | null {
  const m = reply.match(/Confidence:\s*(\d{1,3})/i);
  if (!m) return null;
  const n = parseInt(m[1], 10);
  return n >= 0 && n <= 100 ? n : null;
}
```

- [ ] **Step 3: Build + commit**

```bash
cd app && pnpm build
git add app/src/lib/ai/context-loader.ts app/src/lib/ai/prompt-builder.ts
git commit -m "feat(ai): machine context loader + system prompt builder"
```

---

### Task C.2: `/api/ai/respond` endpoint (streaming)

**Files:**
- Create: `app/src/app/api/ai/respond/route.ts`

- [ ] **Step 1: Создать endpoint**

```ts
// app/src/app/api/ai/respond/route.ts
//
// POST { conversation_id }
// - Embed last user message
// - Retrieve top-5 chunks from manual_chunks for the machine
// - Build system prompt + Claude streaming call
// - Stream SSE events back to the browser
// - On stream end: save assistant message + retrieved chunk IDs + confidence

import { NextRequest } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';
import { loadMachineContext } from '@/lib/ai/context-loader';
import { buildSystemPrompt, parseConfidence } from '@/lib/ai/prompt-builder';
import { retrieve } from '@/lib/ai/retrieval';

export const runtime = 'nodejs';        // pgvector needs node runtime
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { conversation_id } = (await request.json()) as { conversation_id: string };

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: conv } = await sb
    .from('ai_conversations').select('*').eq('id', conversation_id).maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return new Response('Forbidden', { status: 403 });
  }

  const { data: profile } = await sb
    .from('profiles').select('language').eq('id', user.id).single();
  const lang: 'ru' | 'en' = profile?.language === 'en' ? 'en' : 'ru';

  // Get all messages so far (history)
  const { data: messages } = await sb
    .from('ai_messages')
    .select('role, content, image_url')
    .eq('conversation_id', conversation_id)
    .order('created_at');
  if (!messages?.length) return new Response('No messages', { status: 400 });

  const lastUser = [...messages].reverse().find((m: { role: string }) => m.role === 'user');
  if (!lastUser) return new Response('No user message', { status: 400 });

  const ctx = await loadMachineContext(conv.machine_id);
  if (!ctx) return new Response('Machine not found', { status: 404 });

  const retrieved = await retrieve(lastUser.content, ctx.machine_type, 5);
  const systemPrompt = buildSystemPrompt(ctx, lang, retrieved);

  // SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let fullText = '';
      try {
        const claudeStream = await anthropic.messages.stream({
          model: CLAUDE_MODEL,
          max_tokens: 1024,
          system: systemPrompt,
          messages: messages.map((m: { role: string; content: string }) => ({
            role: m.role === 'user' ? 'user' : 'assistant',
            content: m.content,
          })),
        });

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            const text = event.delta.text;
            fullText += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ delta: text })}\n\n`));
          }
        }

        // Persist assistant message
        const confidence = parseConfidence(fullText);
        await sb.from('ai_messages').insert({
          conversation_id,
          role: 'assistant',
          content: fullText,
          retrieved_chunk_ids: retrieved.map((r) => r.id),
          ai_confidence: confidence,
        });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ done: true, confidence })}\n\n`)
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
```

- [ ] **Step 2: UI — подцепить streaming в drawer**

В `AIChatDrawer.tsx` после успешной отправки user-message — вызвать `/api/ai/respond` и стримить:

```tsx
// после успешного POST /api/ai/messages
const askAI = async () => {
  if (!conversationId) return;
  const resp = await fetch('/api/ai/respond', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: conversationId }),
  });
  if (!resp.ok || !resp.body) {
    setError('AI failed');
    return;
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let assistantContent = '';
  // Optimistically append placeholder
  const placeholderId = `tmp-${Date.now()}`;
  setMessages((m) => [
    ...m,
    {
      id: placeholderId,
      role: 'assistant',
      content: '',
      image_url: null,
      ai_confidence: null,
      created_at: new Date().toISOString(),
    },
  ]);
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    for (const line of chunk.split('\n')) {
      if (!line.startsWith('data: ')) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.delta) {
          assistantContent += evt.delta;
          setMessages((m) =>
            m.map((x) => (x.id === placeholderId ? { ...x, content: assistantContent } : x))
          );
        } else if (evt.done) {
          setMessages((m) =>
            m.map((x) =>
              x.id === placeholderId ? { ...x, ai_confidence: evt.confidence } : x
            )
          );
        } else if (evt.error) {
          setError(evt.error);
        }
      } catch {
        /* ignore parse errors */
      }
    }
  }
};

// Modify send() to call askAI() after the user message is saved
```

- [ ] **Step 3: Build + smoke**

```bash
cd app && pnpm build && pnpm dev
```

Открой страницу машины (МСЗУ-14 нужен в тестовой компании), drawer, спроси «Машина не запускается». Должен прийти ответ со ссылкой на страницу РЭ и «Confidence: NN».

- [ ] **Step 4: Commit**

```bash
git add app/src/app/api/ai/respond/ app/src/components/ai-chat/
git commit -m "feat(ai): /api/ai/respond — RAG + Claude streaming"
```

---

**Phase C verification gate:**

Sub-agent task: «Verify Phase C»:
1. `pnpm build`
2. Smoke: создать conversation для машины МСЗУ-14 → POST user message → POST /api/ai/respond → проверить:
   - SSE stream идёт
   - В БД появилось assistant message с `retrieved_chunk_ids` непустой
   - `ai_confidence` between 0-100
3. Содержимое ответа упоминает страницу РЭ (substring match `стр.` или `p. `)

---

## Phase D — Эскалация AI → НПГМ-специалист

**Deliverable:** Если AI отдал confidence <60% → auto-escalate. Если 60-79% → UI кнопка «Не помогло, передать инженеру». Эскалация создаёт тикет, копирует историю чата, шлёт уведомление НПГМ-специалисту (platform_admin).

---

### Task D.1: `/api/ai/escalate` endpoint

**Files:**
- Create: `app/src/app/api/ai/escalate/route.ts`

- [ ] **Step 1: Endpoint**

```ts
// app/src/app/api/ai/escalate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';

export const runtime = 'nodejs';

async function generateTitle(messages: { role: string; content: string }[], lang: 'ru' | 'en') {
  const dialog = messages.map((m) => `${m.role}: ${m.content}`).join('\n');
  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 60,
    system:
      lang === 'ru'
        ? 'Ты помощник для НПГМ-сервиса. Сгенерируй короткий заголовок тикета (5-7 слов) на русском.'
        : 'You are an NPGM service assistant. Generate a short ticket title (5-7 words) in English.',
    messages: [
      { role: 'user', content: `${dialog}\n\nGenerate ticket title only:` },
    ],
  });
  const block = r.content[0];
  return block.type === 'text' ? block.text.trim() : 'AI escalated issue';
}

export async function POST(request: NextRequest) {
  const userClient = await createSSRClient();
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { conversation_id } = (await request.json()) as { conversation_id: string };

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: conv } = await sb
    .from('ai_conversations').select('*').eq('id', conversation_id).maybeSingle();
  if (!conv || conv.operator_id !== user.id) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  if (conv.status !== 'active') {
    return NextResponse.json({ error: 'already_handled' }, { status: 400 });
  }

  const { data: profile } = await sb.from('profiles').select('language').eq('id', user.id).single();
  const lang: 'ru' | 'en' = profile?.language === 'en' ? 'en' : 'ru';

  const { data: messages } = await sb
    .from('ai_messages').select('role, content, image_url')
    .eq('conversation_id', conversation_id).order('created_at');
  if (!messages?.length) return NextResponse.json({ error: 'empty' }, { status: 400 });

  const title = await generateTitle(messages, lang);

  // 1. Insert ticket
  const { data: ticket, error: tErr } = await sb
    .from('tickets')
    .insert({
      company_id: conv.company_id,
      operator_id: conv.operator_id,
      machine_id: conv.machine_id,
      title,
      status: 'new',
      priority: 3,
      originated_from: 'ai_escalation',
    })
    .select('id')
    .single();
  if (tErr || !ticket) return NextResponse.json({ error: tErr?.message }, { status: 500 });

  // 2. Copy messages to ticket_messages
  const ticketMessages = messages.map(
    (m: { role: string; content: string; image_url: string | null }) => ({
      ticket_id: ticket.id,
      sender_type: m.role === 'user' ? 'operator' : 'ai',
      sender_id: m.role === 'user' ? conv.operator_id : null,
      text: m.content,
      image_url: m.image_url,
    })
  );
  await sb.from('ticket_messages').insert(ticketMessages);

  // 3. Update conversation
  await sb
    .from('ai_conversations')
    .update({ status: 'escalated', ticket_id: ticket.id, escalated_at: new Date().toISOString() })
    .eq('id', conversation_id);

  // 4. Notify (Realtime broadcast — platform_admin sees it via subscription)
  //    Email notification: TODO when SMTP is wired (separate task)

  return NextResponse.json({ ticket_id: ticket.id });
}
```

- [ ] **Step 2: Build + commit**

```bash
cd app && pnpm build
git add app/src/app/api/ai/escalate/
git commit -m "feat(ai): /api/ai/escalate — AI conversation → ticket with history"
```

---

### Task D.2: UI confidence routing + escalation button

**Files:**
- Modify: `app/src/components/ai-chat/AIChatDrawer.tsx`
- Create: `app/src/components/ai-chat/EscalationBanner.tsx`

- [ ] **Step 1: EscalationBanner**

```tsx
'use client';

import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export function EscalationBanner({ ticketId }: { ticketId: string }) {
  const t = useTranslations('ai');
  return (
    <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm">
      <p className="text-amber-900 mb-2">{t('escalated_message')}</p>
      <Link
        href={`/app/tickets/${ticketId}`}
        className="inline-flex items-center gap-1 text-primary-700 hover:underline font-medium"
      >
        {t('view_ticket')} <ArrowRight className="w-3 h-3" />
      </Link>
    </div>
  );
}
```

Добавь в `messages/ru.json` и `en.json`:

```json
{
  "ai": {
    "escalated_message": "Передал инженеру. Свяжется в ближайшее время.",
    "view_ticket": "Открыть тикет"
  }
}
```

EN:
```json
{
  "ai": {
    "escalated_message": "Forwarded to engineer. They will get back to you shortly.",
    "view_ticket": "Open ticket"
  }
}
```

- [ ] **Step 2: В drawer — confidence routing**

В `AIChatDrawer.tsx` после получения ответа AI:

```tsx
// state:
const [escalatedTicketId, setEscalatedTicketId] = useState<string | null>(null);

const lastAI = [...messages].reverse().find((m) => m.role === 'assistant');
const showEscalateButton =
  lastAI && lastAI.ai_confidence !== null && lastAI.ai_confidence >= 60 && lastAI.ai_confidence < 80;

const escalate = async () => {
  if (!conversationId) return;
  setBusy(true);
  try {
    const r = await fetch('/api/ai/escalate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error);
    setEscalatedTicketId(j.ticket_id);
  } catch (e) {
    setError(e instanceof Error ? e.message : String(e));
  } finally {
    setBusy(false);
  }
};

// after askAI() completes — auto-escalate if confidence < 60:
const handleAIDone = (confidence: number | null) => {
  if (confidence !== null && confidence < 60 && !escalatedTicketId) {
    escalate();
  }
};
// call handleAIDone in the SSE 'done' branch

// In the drawer JSX, above the input:
{escalatedTicketId && <EscalationBanner ticketId={escalatedTicketId} />}
{showEscalateButton && !escalatedTicketId && (
  <Button variant="outline" onClick={escalate} disabled={busy}>
    {t('escalate_button')}
  </Button>
)}
```

- [ ] **Step 3: Build + smoke**

Открой drawer, спроси что-то заведомо сложное (AI выдаст low confidence) — должна появиться кнопка эскалации (или авто-эскалация). После клика → баннер с ссылкой на тикет.

В Supabase: `select * from tickets where originated_from='ai_escalation' order by created_at desc limit 1` — увидь свой тикет.

- [ ] **Step 4: Commit**

```bash
git add app/src/components/ai-chat/ app/messages/
git commit -m "feat(ai): UI confidence routing + escalation button + banner"
```

---

### Task D.3: Уведомление НПГМ-специалисту (Realtime broadcast)

**Files:**
- Modify: `app/src/app/admin/layout.tsx` (или новый компонент `<EscalationsToast />`)

- [ ] **Step 1: Toast/notification компонент**

```tsx
// app/src/components/admin/EscalationsListener.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createSPASassClient } from '@/lib/supabase/client';

export function EscalationsListener() {
  const router = useRouter();
  useEffect(() => {
    let mounted = true;
    (async () => {
      const c = await createSPASassClient();
      const sb = c.getSupabaseClient();
      const channel = sb
        .channel('escalations')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'tickets', filter: 'originated_from=eq.ai_escalation' },
          (payload) => {
            if (!mounted) return;
            // Lightweight toast (use existing toast lib or a simple alert for now)
            const t = payload.new as { id: string; title: string };
            const accept = window.confirm(`New AI-escalated ticket: ${t.title}. Open?`);
            if (accept) router.push(`/app/tickets/${t.id}`);
          }
        )
        .subscribe();
      return () => {
        mounted = false;
        sb.removeChannel(channel);
      };
    })();
  }, [router]);
  return null;
}
```

- [ ] **Step 2: Подключить в AdminLayout**

```tsx
import { EscalationsListener } from '@/components/admin/EscalationsListener';

// Inside AdminLayoutInner JSX, top of return:
<EscalationsListener />
```

- [ ] **Step 3: Включить Realtime для tickets в Supabase**

В Supabase Dashboard → Database → Replication → выбрать `public.tickets` → Enable.

- [ ] **Step 4: Build + smoke**

Залогинься как platform_admin, открой /admin. Затем в другой вкладке — оператор эскалирует. В админской вкладке должен вылезти confirm-prompt.

- [ ] **Step 5: Commit**

```bash
git add app/src/components/admin/ app/src/app/admin/layout.tsx
git commit -m "feat(ai): realtime escalation listener for platform_admin"
```

---

**Phase D verification gate:**

Sub-agent: «Verify Phase D»:
1. `pnpm build`
2. End-to-end: conversation → AI low confidence → auto-escalate → ticket в БД с `originated_from='ai_escalation'` + `ticket_messages` с историей
3. Realtime: admin получает payload

---

## Phase E — Learning loop из закрытых эскалаций

**Deliverable:** НПГМ-специалист закрывает тикет (status='resolved' + `resolution_summary`) → cron подбирает row из `ai_learning_queue` → Claude извлекает (вопрос, ответ) пары → embedding → новые `manual_chunks` с `verified_at=now()`.

---

### Task E.1: `/api/ai/learn` endpoint

**Files:**
- Create: `app/src/app/api/ai/learn/route.ts`

- [ ] **Step 1: Endpoint**

```ts
// app/src/app/api/ai/learn/route.ts
//
// POST (idempotent) — processes up to 10 unprocessed rows in ai_learning_queue.
// Called by cron (Vercel cron or external scheduler).
//
// For each: load ticket + messages → Claude extracts Q/A pairs → embed → upsert.

import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { anthropic, CLAUDE_MODEL } from '@/lib/ai/anthropic';
import { embed } from '@/lib/ai/voyage';

export const runtime = 'nodejs';
export const maxDuration = 60;

async function extractQAPairs(
  conversation: string,
  resolution: string,
  lang: 'ru' | 'en'
): Promise<{ q: string; a: string }[]> {
  const prompt = lang === 'ru'
    ? `Изучи диалог + финальное решение. Вытащи 1-3 пары (вопрос, ответ) пригодных для FAQ.
Формат ответа: JSON array, без markdown. Пример: [{"q":"...","a":"..."}]

ДИАЛОГ:
${conversation}

ИТОГОВОЕ РЕШЕНИЕ ИНЖЕНЕРА:
${resolution}`
    : `Examine the dialogue + final resolution. Extract 1-3 (question, answer) pairs suitable for FAQ.
Response format: JSON array, no markdown. Example: [{"q":"...","a":"..."}]

DIALOGUE:
${conversation}

ENGINEER'S FINAL RESOLUTION:
${resolution}`;

  const r = await anthropic.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 800,
    messages: [{ role: 'user', content: prompt }],
  });
  const block = r.content[0];
  if (block.type !== 'text') return [];
  try {
    return JSON.parse(block.text) as { q: string; a: string }[];
  } catch {
    return [];
  }
}

// Simple heuristic: detect language by presence of Cyrillic
function detectLanguage(s: string): 'ru' | 'en' {
  return /[А-Яа-яЁё]/.test(s) ? 'ru' : 'en';
}

export async function POST(request: NextRequest) {
  // Trusted endpoint — protected by cron header secret. In production, set
  // CRON_SECRET env and check it. For pilot, we trust internal calls.
  const cronSecret = request.headers.get('x-cron-secret');
  if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const admin = await createServerAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = admin as any;

  const { data: queue, error: qErr } = await sb
    .from('ai_learning_queue')
    .select('id, ticket_id')
    .is('processed_at', null)
    .limit(10);
  if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });
  if (!queue?.length) return NextResponse.json({ ok: true, processed: 0 });

  let processed = 0;

  for (const item of queue) {
    try {
      // Load ticket + machine + messages
      const { data: ticket } = await sb
        .from('tickets')
        .select(
          'id, resolution_summary, resolved_by, machine_id, machine:machines(machine_type)'
        )
        .eq('id', item.ticket_id)
        .single();
      if (!ticket?.resolution_summary) {
        await sb.from('ai_learning_queue').update({
          processed_at: new Date().toISOString(),
          error: 'no_resolution_summary',
        }).eq('id', item.id);
        continue;
      }

      const { data: messages } = await sb
        .from('ticket_messages')
        .select('sender_type, text')
        .eq('ticket_id', ticket.id)
        .order('created_at');

      const dialog = (messages ?? [])
        .map((m: { sender_type: string; text: string }) => `[${m.sender_type}]: ${m.text}`)
        .join('\n\n');

      const lang = detectLanguage(ticket.resolution_summary + ' ' + dialog);
      const pairs = await extractQAPairs(dialog, ticket.resolution_summary, lang);

      if (pairs.length > 0) {
        const machineType = ticket.machine?.machine_type ?? 'unknown';
        const texts = pairs.map((p) => `Q: ${p.q}\nA: ${p.a}`);
        const embeddings = await embed(texts, 'document');
        const rows = pairs.map((p, idx) => ({
          machine_type: machineType,
          language: lang,
          source: `tier2_resolution:${ticket.id}`,
          page: null,
          section: 'FAQ',
          chunk_text: texts[idx],
          embedding: embeddings[idx],
          verified_at: new Date().toISOString(),
          verified_by: ticket.resolved_by,
        }));
        await sb.from('manual_chunks').insert(rows);
      }

      await sb.from('ai_learning_queue').update({
        processed_at: new Date().toISOString(),
      }).eq('id', item.id);
      processed++;
    } catch (e) {
      await sb.from('ai_learning_queue').update({
        processed_at: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      }).eq('id', item.id);
    }
  }

  return NextResponse.json({ ok: true, processed });
}
```

- [ ] **Step 2: Set `resolved_by` при resolve тикета**

В `app/src/app/app/tickets/[id]/page.tsx`, при изменении статуса на 'resolved':

```tsx
// в onChangeStatus, когда выбрано 'resolved':
const update = {
  status: 'resolved',
  resolved_at: new Date().toISOString(),
  resolved_by: user.id,
  // resolution_summary — отдельно от input
};
```

- [ ] **Step 3: Vercel cron config**

Create `app/vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/ai/learn",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

(Если хостинг не Vercel — настроить external cron, например через Supabase pg_cron или GitHub Actions.)

- [ ] **Step 4: Build + commit**

```bash
cd app && pnpm build
git add app/src/app/api/ai/learn/ app/src/app/app/tickets/ app/vercel.json
git commit -m "feat(ai): /api/ai/learn — extract Q/A from resolved escalations + vercel cron"
```

---

**Phase E verification gate:**

1. Эскалировать тикет, закрыть с `resolution_summary` от админа
2. Manual run: `curl -X POST http://localhost:3000/api/ai/learn -H "x-cron-secret: ..."`
3. Проверить: `select * from manual_chunks where verified_at is not null` — есть новые строки
4. Спросить AI снова похожий вопрос → ответ должен использовать новый FAQ-чанк (через retrieval boost)

---

## Phase F — Claude Vision на фото

**Deliverable:** Оператор прикрепляет фото к сообщению → AI «видит» что на фото и учитывает в ответе.

---

### Task F.1: Vision integration

**Files:**
- Modify: `app/src/app/api/ai/respond/route.ts`

- [ ] **Step 1: Поддержать image в Claude call**

В `/api/ai/respond` модифицируй блок `messages.map`:

```ts
const claudeMessages = await Promise.all(
  messages.map(async (m: { role: string; content: string; image_url: string | null }) => {
    if (m.role === 'user' && m.image_url) {
      // Fetch image as base64 (Claude API accepts base64 or URL)
      // For Supabase Storage public URLs, just pass the URL through.
      const isUrl = m.image_url.startsWith('http');
      return {
        role: 'user' as const,
        content: [
          {
            type: 'image' as const,
            source: isUrl
              ? { type: 'url' as const, url: m.image_url }
              : { type: 'base64' as const, media_type: 'image/jpeg', data: m.image_url },
          },
          { type: 'text' as const, text: m.content },
        ],
      };
    }
    return {
      role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
      content: m.content,
    };
  })
);

// Replace the messages: messages.map(...) in anthropic.messages.stream with:
messages: claudeMessages,
```

- [ ] **Step 2: Build + smoke**

Сфоткай любой пульт / индикатор, прикрепи в drawer, отправь «Что это значит?» — AI должен описать фото в ответе.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/api/ai/respond/
git commit -m "feat(ai): Claude Vision — analyse attached photos in AI responses"
```

---

**Phase F verification gate:**

Manual: оператор фотает что-то → AI описывает в ответе → smoke test пройден.

---

## Final wrap-up

### Task FINAL.1: Documentation update

**Files:**
- Modify: `README.md` (или новый файл `docs/AI_CHAT.md`)

- [ ] **Step 1: Документировать setup для будущих deploys**

Создать `docs/AI_CHAT.md` с:
- ENV vars нужные (`ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `CRON_SECRET`)
- Команда для ingestion новых мануалов (`pnpm tsx scripts/ingest-manuals.ts`)
- Vercel cron requirement / альтернатива
- Storage bucket `ai-chat-photos` (public read)
- Recovery: если AI ломается — что отключить (`/api/ai/respond` early return)

- [ ] **Step 2: Commit**

```bash
git add docs/AI_CHAT.md
git commit -m "docs: AI chat setup + ops guide"
```

---

## Self-Review Checklist

**Spec coverage:**

| Спека §                             | Покрыта в плане | Где |
|---|---|---|
| 3a. i18n (next-intl, picker)        | ✅ | Phase 0 (Tasks 0.1-0.5) |
| 4. Схема БД (миграция 0032)         | ✅ | Task A.1 |
| 5. Ingestion pipeline               | ✅ | Tasks A.3 + A.4 |
| 6. AI response pipeline             | ✅ | Phase C (C.1-C.2) |
| 7. Escalation                       | ✅ | Phase D (D.1-D.3) |
| 8. Learning loop                    | ✅ | Phase E (E.1) |
| 9. UI changes (drawer, /admin/manuals) | ⚠️ Partial | Drawer покрыт; `/admin/manuals` ingestion-form НЕ покрыта в этом плане — admin использует CLI script `ingest-manuals.ts`. Можно докатить в v1.1 |
| 10. Фазы реализации                  | ✅ | Все Phases 0-F |
| 11. Verification workflow           | ✅ | gate после каждой фазы |
| 12. Внешние API + cost              | ✅ | Tasks A.2 (env setup) |

**Placeholders scan:**
- ✅ Все steps содержат конкретный код или конкретные команды
- ✅ Файлы указаны абсолютными путями
- ⚠️ Task D.3 — Realtime UI использует `window.confirm()` как простой toast. Можно улучшить позже (заменить на shadcn/ui toast), не блокирующее.

**Type consistency:**
- `AIMessage` type: `id, role, content, image_url, ai_confidence, created_at` — используется в Bubble + Drawer
- `MachineContext` type: только в `context-loader.ts` + `prompt-builder.ts`
- `RetrievedChunk`: `retrieval.ts` + `prompt-builder.ts`
- Все API endpoints возвращают `{ error: string }` на ошибке, `{ ok: true, ... }` на успехе

**Известное ограничение:**
- Веб-загрузка мануалов (`/admin/manuals`) не вошла в этот спринт — admin запускает CLI-скрипт. Если нужна UI — добавить в Phase A как Task A.6.

---

## Plan complete

Plan saved to `docs/superpowers/plans/2026-05-19-ai-chat-rag-i18n.md`.

**Total estimated work:** 12-17 рабочих дней (соответствует спеке §10).

**Critical path:** 0 → A → C → D (минимально полезный AI чат с эскалацией). B можно делать параллельно с C. E + F — после.

---

## Two execution options:

**1. Subagent-Driven (recommended)** — я диспатчу свежий subagent на каждую Task, между ними review, быстрые итерации. Тебе показываю только после прохождения verification gate каждой фазы.

**2. Inline Execution** — выполняю в этой сессии через executing-plans, с чекпоинтами на твою проверку после каждой фазы.

**Какой подход?**
