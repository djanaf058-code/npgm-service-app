# Spec: полная локализация приложения (RU + EN) — UI, каталог, ошибки API

**Date:** 2026-06-01
**Status:** approved by user (brainstorming), ready for implementation plan
**Owner:** ВФ + Claude

## Context — почему

После предыдущей i18n-волны (тикеты, maintenance/[id], parts list, parts/import)
заказчик пилота на KSA сторона видит RU-текст в больших блоках UI на EN-локали.
Аудит дал ~17 файлов с хардкоженными русскими строками и несколько слоёв проблемы:

1. **UI:** компоненты с хардкоженными RU (placeholder'ы, кнопки, error-message'ы,
   подписи). Самые жирные: AddStockDialog (52), RequestDialogs (32),
   MachineOperatorsSection (20), ConsolidationPicker (15), auth-страницы (50+ общим).
2. **Данные:** в `parts_catalog.display_name_en` (и `maintenance_schedules.work_items.*.name_en`,
   `checklist_templates.items.*.name_en`) много NULL — UI-fallback показывает RU,
   и даже идеально локализованный интерфейс выдаёт русские названия деталей.
3. **API-ошибки:** роуты возвращают локализованные RU-строки (`{ error: 'Не удалось...' }`).
   EN-пользователь видит русские ошибки.

Цель — закрыть все три слоя одним проходом, чтобы приложение было реально билингвальным.

## Outcome

Когда задача выполнена:
- Любая user-facing страница / компонент / диалог под EN-локалью **полностью** на
  английском (включая placeholder'ы, alt-тексты, aria-label'ы, надписи на кнопках,
  сообщения об ошибках).
- Каталог запчастей, регламенты ТО и чек-листы показывают английские названия
  везде, где есть аналог в RU.
- API-роуты возвращают **стабильные коды ошибок** вместо локализованных строк;
  клиент рендерит сообщение из i18n по локали.
- Все даты на EN-локали в формате `en-US` (не `ru-RU`).

## Архитектура — три фазы в одной спеке

Фазы независимы и могут запускаться/деплоиться по отдельности. Реализация по
порядку (1 → 2 → 3); деплой можно делать после каждой фазы.

### Фаза 1. UI i18n (~15 файлов)

**Паттерн** (уже отработан на тикет-компонентах):
- Помечаем компонент `'use client'` если не помечен.
- `useTranslations('<namespace>')` + `useLocale()` где нужны даты.
- Замена литералов:
  - тексты UI → `t('key')`;
  - даты → `toLocaleDateString(locale === 'en' ? 'en-US' : 'ru-RU', ...)`;
  - для пар колонок `name_ru`/`name_en` — fallback util:
    `locale === 'en' && x.name_en ? x.name_en : x.name_ru`.

**Файлы под рефактор и их новые namespace:**

| Файл | Namespace | Прим. строк |
|---|---|---|
| `parts/AddStockDialog.tsx` | `parts_add_stock` | ~52 |
| `parts/RequestDialogs.tsx` (Quote/Order/Cancel/MarkReceived) | `parts_dialogs` | ~32 |
| `parts/ConsolidationPicker.tsx` | `parts_consolidation` | ~15 |
| `parts/RequestStatusBadge.tsx` | `parts_status` | ~12 |
| `parts/RequestTimeline.tsx` | `parts_timeline` | ~10 |
| `parts/RequestActionPanel.tsx` | `parts_actions` | ~7 |
| `parts/PartCategoryBadge.tsx` | `parts_category` | ~6 |
| `parts/StockBadge.tsx` | `stock_status` | ~4 |
| `app/parts/request/[id]/page.tsx` | `parts_request_detail` | ~ |
| `machines/MachineOperatorsSection.tsx` | `machines_operators` | ~20 |
| `machines/MachineStatusBadge.tsx` | `machine_status` | ~3 |
| `machines/MachineTypeBadge.tsx` | `machine_type_badge` | ~4 |
| `app/machines/new/page.tsx` | `machine_new_extra` | ~8 |
| `app/machines/[id]/page.tsx` | `machine_detail_extra` | ~3 |
| `shifts/ShiftStatusBadge.tsx` | `shift_status` | ~5 |
| `app/shifts/[id]/page.tsx` | `shift_detail_extra` | ~7 |
| `tickets/PhotoUpload.tsx`, `shared/PhotoUploader.tsx` | `photo_upload` | ~5+5 |
| `tickets/MessageBubble.tsx` | (доделать 2 строки) | 2 |
| `AuthAwareButtons.tsx` | (использует `landing`) | 5 |
| `auth/invite/[token]/page.tsx` | `auth_invite_extra` | ~28 |
| `auth/reset-password/page.tsx` | `auth_reset` | ~12 |
| `auth/forgot-password/page.tsx` | `auth_forgot` | ~10 |
| `auth/verify-email/page.tsx` | `auth_verify` | ~9 |
| `admin/layout.tsx` | (доделать 4 строки) | 4 |
| `parts/import/page.tsx` | (доделать 6 строк) | 6 |

**Скип** (внутренние, не отображаются пользователю):
- `lib/ai/prompt-builder.ts` — промпт сам двуязычный (детектит локаль оператора).
- `lib/calculations/recipes.ts`, `lib/calculations/maintenance.ts` — внутренние label'ы,
  если экспортируются для UI — точечно проверить.
- `lib/supabase/middleware.ts`, `lib/context/GlobalContext.tsx`, `lib/ai/pdf-parser.ts` —
  RU только в комментариях.
- API-роуты сервиса (ai/learn, sos и т.п.) — комментарии, не возврат.

### Фаза 2. Каталог: автозаполнение `*_en`-колонок через Claude

Цели:
- `parts_catalog.display_name_en` (и опционально `application_en`).
- `maintenance_schedules.work_items[].name_en` (массив JSONB).
- `checklist_templates.items[].name_en` (массив JSONB).

**Скрипт:** `app/scripts/translate-catalog.ts`

Запуск: `pnpm tsx scripts/translate-catalog.ts [--dry-run] [--apply-review <csv>]` из `app/`.

Логика:
1. Грузит env (тот же мини-парсер `.env.local`, что в `ingest-manuals.ts`).
2. Идёт по 3 источникам последовательно:
   - **parts_catalog**: `select id, display_name_ru, application_ru from parts_catalog
     where display_name_en is null limit 200`. Батчами по 50 кидаем в Claude один
     системный промпт: «Переведи технические названия запчастей с русского на
     английский (терминология эмульсионных машин, NETZSCH, БВР), арт.номера сохрани
     дословно. Верни JSON-массив строк той же длины». Парсим ответ, апдейтим rows
     одной транзакцией.
   - **maintenance_schedules.work_items**: для каждой строки `work_items` (JSONB-массив)
     находим элементы где `name_en` пустое или отсутствует, кидаем в Claude батчем,
     обновляем массив целиком (через `update maintenance_schedules set work_items = ... where id = ...`).
   - **checklist_templates.items**: то же самое.
3. Лог: сколько строк/элементов перевели в каждой таблице. `--dry-run` выводит
   первые 5 переводов без записи.

**Модель:** Claude **Sonnet 4.6** (`claude-sonnet-4-6`) — техническая
терминология эмульсионных машин специфическая, экономия на Haiku не стоит риска
плохих переводов.

**Промпт для Claude** (RU→EN technical mining/parts):
> You are a senior translator specialising in mining-explosives equipment
> (emulsion-charging MMU machines, NETZSCH pumps, blasting workflows). Translate
> the following Russian part / work names to professional English used by
> international suppliers. Preserve all numbers, units and OEM article codes
> verbatim. For each input string, output an object
> `{translation, confidence, alt?, note?}` where:
>   - `translation` — your best translation;
>   - `confidence` — `"high"` if the technical term is unambiguous, `"low"` if
>     you had to guess or the source is ambiguous (jargon, slang, abbreviations
>     you can't expand confidently);
>   - `alt` — alternative wording if `low`, else omit;
>   - `note` — one short sentence on why uncertain, only if `low`.
> Output **only** a JSON array of these objects, same length and order as input.
> No explanations outside the JSON.

**Двухпроходный режим автозаписи + сверка:**

Скрипт делит результат на два потока:
- `confidence === 'high'` → **сразу пишется в БД**.
- `confidence === 'low'` → **НЕ пишется в БД**, вместо этого попадает в CSV-файл
  `app/scripts/output/translate-catalog-review.csv` (создаётся в gitignore).

Колонки CSV: `table | id | ru | predicted_en | alt | note`. Пример:
```
parts_catalog,abc-uuid,Уплотнение НК-25,Seal NK-25,NK-25 gasket,"unclear if seal or gasket"
```

После прогона скрипт печатает:
```
Wrote 412 high-confidence translations to DB.
Flagged 24 low-confidence — review app/scripts/output/translate-catalog-review.csv.
Apply edits with: pnpm tsx scripts/translate-catalog.ts --apply-review <path>
```

Пользователь открывает CSV, правит колонку `predicted_en` или копирует из `alt`,
сохраняет. Повторный запуск с `--apply-review <path>` берёт CSV и пишет
финальные значения в БД (валидируя что `id` и `table` существуют).

Идемпотентность: уже заполненные `_en` пропускаются и в первом, и во втором проходе.

**Стоимость:** ~$1-2 за весь прогон Sonnet на ~500-1000 строк каталога + work_items
+ checklist items. Допустимая цена за качество.

### Фаза 3. API-ошибки → коды + клиентская i18n

Меняем формат ответа ошибок:

```ts
// было
return NextResponse.json({ error: 'Не удалось создать пользователя' }, { status: 500 });
// стало
return NextResponse.json({ error: 'user_create_failed' }, { status: 500 });
```

**Файлы под рефактор:**
- `api/invites/create/route.ts`
- `api/invites/preregister/route.ts`
- `api/invites/set-password/route.ts`
- `api/invites/cancel/route.ts`
- `api/invites/lookup/route.ts`
- `api/onboarding/create-company/route.ts`
- `api/admin/companies/create/route.ts`
- `api/admin/companies/delete/route.ts`
- `api/admin/members/remove/route.ts`
- `api/tickets/sos/route.ts`

**Клиент** — каждый caller, обрабатывающий ошибку из этих endpoint'ов, переходит
на:
```ts
const json = await resp.json();
if (!resp.ok) throw new Error(tErrors(json.error) || json.error);
```
Где `tErrors = useTranslations('api_errors')`, fallback к самому коду (на случай
если код не описан — для отладки).

**Новый namespace** `api_errors` в обоих локалях с ~30 кодами (по одному на
уникальную ошибку из всех роутов).

**Не ломающее**: внутренний контракт меняется, но UI остаётся читаемым; код
ошибки в логе/Sentry/devtools — даже информативнее литерала.

## Вне рамок
- Перевод текста самого AI-ассистента (Claude уже билингвальный — он отвечает на
  языке оператора, RU/EN автодетект).
- Перевод документов в `manuals/` (РЭ остаются в исходных языках; ИИ-ассистент
  достанет нужный фрагмент через RAG).
- Тексты email/Telegram-уведомлений (доставка вне рамок этого пилота).
- Локализация RU-комментариев в коде — они для разработчика.
- Арабский язык (RTL) — отдельный проект, если KSA-клиент захочет.

## Verification

После каждой фазы — отдельный smoke-чек:

**Фаза 1.** Переключи язык на EN, пройди по списку файлов:
- открой AddStock диалог в `/app/parts` — все поля и кнопки на английском;
- открой `/app/parts/request/<id>` — Quote/Order/Cancel диалоги на EN;
- открой `/app/machines/<id>` → раздел «Operators» — на EN;
- открой `/app/machines/new` — формочка на EN;
- открой `/app/shifts/<id>` — деталь смены на EN;
- открой `/auth/invite/<token>` и `/auth/reset-password` — на EN;
- проверь даты — формат `en-US` (например `Jun 1, 14:47`), не `1 июня`.

**Фаза 2.** После первого прогона:
```
Wrote X high-confidence translations to DB.
Flagged Y low-confidence — review app/scripts/output/translate-catalog-review.csv.
```
Открыть CSV → проверить/поправить → запустить с `--apply-review`. Затем в
Supabase SQL:
```sql
select count(*) filter (where display_name_en is null) as missing_en,
       count(*) as total
from parts_catalog;
```
`missing_en` близко к 0. В UI: каталог в EN показывает английские названия.

**Фаза 3.** Намеренно вызови ошибку (например, регистрация с уже занятым email)
на EN-локали — должна показаться английская строка из `api_errors.email_exists`,
не русская.

## Файлы (high-level)

**Новые:**
- `app/scripts/translate-catalog.ts`
- `docs/superpowers/specs/2026-06-01-full-localization-design.md` (этот файл)

**Изменяемые (по фазам):**
- Фаза 1: ~25 `.tsx`-файлов + большое расширение `app/messages/{en,ru}.json` (новые
  namespace'ы).
- Фаза 2: миграция не нужна (колонки уже есть в схеме); скрипт только пишет данные.
- Фаза 3: ~10 API-роутов + рефактор `throw new Error(...)` в client-callers + добавление
  `api_errors` namespace в `app/messages/{en,ru}.json`.

## Объём

~3-4 часа реализации:
- Фаза 1: ~2 часа (механика, но много строк).
- Фаза 2: ~30 мин (скрипт компактный) + ~15 мин на сам прогон.
- Фаза 3: ~1 час.

Деплой возможен после каждой фазы — каждая самодостаточна и не ломает другие.
