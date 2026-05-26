# Spec: roles + consolidated parts requests redesign

**Date:** 2026-05-10
**Status:** approved by user, ready for implementation plan
**Owner:** ВФ + Claude

> **Amendment 2026-05-25 (роли, два сервисных инженера).** После пилотного
> уточнения карта ролей скорректирована — этот блок имеет приоритет над
> расходящимися местами ниже:
>
> 1. **Сервисный инженер заказчика (`service_engineer`)** — полная
>    операционная параллель с `project_manager` внутри своего tenant'а: парк,
>    смены, команда (приглашения), тикеты, ТО, создание и сборка заявок на
>    запчасти. **Единственное** отличие от PM — финансовый шаг: видимость цен
>    (quote_*) и согласование КП остаются у PM (cost-gating сохраняется, см.
>    раздел "Cost visibility"). То есть в таблицах ниже, где
>    `service_engineer` «не видит цен» — это в силе; всё прочее у него = PM.
> 2. **Сервисный инженер НПГМ (`tier2_engineer`)** — теперь видит **и тикеты,
>    и очередь заявок на запчасти** всех компаний (кросс-tenant, read-only),
>    но **без цен/КП** (масочно в UI). Раньше спека ограничивала tier2 «только
>    тикетами» — это отменено. Регистрируется platform_admin'ом отдельной
>    ссылкой (company-less invite, см. migration 0041). Ценообразование и
>    размещение заказов по-прежнему только у platform_admin.
> 3. Реализация поправки: миграция `0041_npgm_engineer.sql` (tier2 cross-tenant
>    SELECT на companies/machines/profiles/parts_requests + nullable
>    `invites.company_id`); `useRole` (canManageCompany += service_engineer,
>    добавлен `isTier2Engineer`); `AppLayout` (nav SE = PM); `/admin` layout
>    (пускает tier2 с урезанной навигацией Тикеты+Запчасти); invite-роуты
>    (platform_admin может регистрировать tier2).

## Context — почему

Текущая модель ролей и workflow заявок упрощена под первый прогон пилота: внутри клиентской компании есть только `operator` и `company_admin`, заявка идёт в один шаг от оператора напрямую в НПГМ через двухступенчатый API.

Реальный процесс на стороне MCS / Gulf Explosives устроен иначе и при этом одинаковый у обоих:

1. Операторы несут проблемы по своим машинам сервисному инженеру.
2. Сервисный инженер собирает заявки со всех машин за период, **объединяет в одну сводную**, дополняет от себя и отправляет проектному менеджеру.
3. Проектный менеджер согласовывает scope (без цен), потом отдельно — финансовый КП после того как поставщик его выставил.
4. Поставщик (НПГМ) принимает консолидированную заявку, готовит КП, размещает заказ.

Параллельно владелец НПГМ работает с **десятками компаний-клиентов** одновременно, формирует КП с собственной наценкой над прайсом НИПИГОРМАШа и нуждается в кросс-tenant обзоре. Рядовой инженер НПГМ — это техподдержка по тикетам, к ценообразованию и закупке отношения не имеет.

Эта спека закрывает разрыв между текущей упрощённой моделью и реальным процессом, плюс добавляет admin-обзор для владельца платформы.

## Outcome

Когда задача выполнена:

- Внутри клиентской компании работают три роли с разными экранами: **operator → service_engineer → project_manager**.
- Заявки имеют два уровня: **operator-заявка** (по одной машине) и **consolidated-заявка** (создаёт сервисник, объединяет несколько operator-заявок).
- Дублирующиеся каталожные позиции в сводной автоматически суммируются по количеству.
- Project manager **не видит цен** до момента когда поставщик выставил КП — это блокирует «торговлю» на этапе согласования scope.
- Tier 2 НПГМ занимается только тикетами; ценообразование и заказы — у platform_admin.
- Platform_admin (владелец) имеет отдельный `/admin` layout: список всех компаний-клиентов, обзор каждой, очередь заявок на КП от всех компаний.
- Старая роль `company_admin` исчезает (данные мигрируются в `project_manager`).

## Roles — финальная карта

### Внутри клиентской компании (tenant-scoped)

| Роль | Назначение | Может |
|---|---|---|
| `operator` | Оператор машины | Видеть свою машину, создавать operator-заявку, создавать тикет, создавать смену с чек-листом и закрывать её, помечать запчасть полученной |
| `service_engineer` | Сервисный инженер | Всё что operator + назначать операторов на машины, добавлять/удалять машины, отвечать в тикетах, **собирать operator-заявки в сводную** (с автодедупликацией), отправлять сводную PM, отменять чужие заявки |
| `project_manager` | Проектный менеджер | Всё что service_engineer + аналитический дашборд, согласование сводных (scope без цен → quote с ценами), редактирование сводных, управление командой (приглашения, роли) |

### Внутри НПГМ (cross-tenant)

| Роль | Назначение | Может |
|---|---|---|
| `tier2_engineer` | Рядовой инженер техподдержки | **Только тикеты** от всех компаний (отвечать, эскалировать). Не видит /app/parts, не вызывает RPC по заявкам. |
| `platform_admin` | Владелец платформы (вы) | Всё что tier2 + `/admin` layout: список компаний, обзор каждой, очередь сводных заявок от всех компаний, выставление КП с наценкой, размещение заказов с ETA, override любого статуса, управление любым юзером |

### Удаляется

- `company_admin` — функции переходят к `project_manager`. Существующие записи с этой ролью мигрируются. Значение остаётся в enum как deprecated (Postgres не позволяет легко удалить enum value, плюс сохраняем для аудита истории).

## Workflow заявок на запчасти

### Двухуровневая модель

**Operator-заявка** (один экземпляр = одна машина, одна потребность):
```
draft (если поддержим) → submitted → consolidated  (поглощена в сводную)
                                  → cancelled
```
В пилоте `draft` пропускаем — операторская заявка создаётся сразу как `submitted`.

**Consolidated-заявка** (создаёт service_engineer):
```
drafting → pending_pm  (отправлена PM)
        → cancelled

pending_pm → forwarded  (PM согласовал scope, без цен; теперь видна platform_admin)
          → cancelled

forwarded → quoted  (platform_admin выставил КП с наценкой)
         → cancelled

quoted → approved  (PM принял КП, теперь видит цены)
      → cancelled

approved → ordered  (platform_admin разместил заказ с ETA)
        → cancelled

ordered → received  (operator/service подтвердил получение + фото)
       → cancelled (если не дошёл)
```

### Кто что делает

| Действие | Кто |
|---|---|
| Создать operator-заявку | operator (по своей машине) |
| Создать consolidated-заявку (drafting) | service_engineer |
| Добавить operator-заявки в сводную (consolidate) | service_engineer |
| Добавить позиции в сводную напрямую | service_engineer (до pending_pm); project_manager (до forwarded) |
| Отправить сводную PM | service_engineer |
| Согласовать scope | project_manager |
| Выставить КП | platform_admin |
| Принять КП | project_manager |
| Разместить заказ | platform_admin |
| Подтвердить получение | operator / service_engineer / project_manager |
| Отменить заявку | автор шага на своём шаге; platform_admin в любой момент |

### Дедупликация при консолидации

Когда service_engineer добавляет N operator-заявок в сводную:

- Для **каталожных позиций** (`parts_requested[i].part_id` существует): группируются по `part_id`, количества суммируются. В UI показывается одна строка с суммарным `quantity` и тултипом «откуда» (5 шт × МСЗУ-14, 3 шт × МЗВ-16).
- Для **freeform позиций** (`parts_freeform[i]`): не дедуплицируются (текстовые описания различны и могут касаться разных деталей). Просто конкатенируются в общий список.

Дедупликация — это **операция на момент `consolidate_operator_requests` RPC**: пересчитывает массив `parts_requested` сводной на основе текущего набора дочерних. Если позже добавляется ещё одна operator-заявка в ту же сводную (до отправки PM) — пересчитывается заново.

После того как сводная ушла к PM (`pending_pm`), новые operator-заявки в неё уже не добавить — нужно создавать новую сводную.

### Cost visibility

Видимость цен (`quote_total_amount`, `quote_currency`, `quote_notes`, и любых per-line цен если будут):

| Роль | Видит цены? |
|---|---|
| operator | никогда |
| service_engineer | никогда (на их экранах поля просто не отображаются) |
| project_manager | **только когда статус сводной ≥ `quoted`** |
| tier2_engineer | не видит сводных вообще |
| platform_admin | всегда |

Реализация — на UI (компоненты не рендерят соответствующие поля при недостатке прав). Жёсткое маскирование на уровне БД (column-level security / VIEW) — overkill для пилота.

## Schema changes

### Migration 0025_roles.sql

```sql
-- Migrate existing company_admin profiles to project_manager.
update profiles set role = 'project_manager' where role = 'company_admin';

-- The 'company_admin' enum value remains for audit (Postgres doesn't allow
-- easy enum value drop). It must not be granted to any new user.

-- Update RLS policies that reference 'company_admin' to also accept
-- 'project_manager' (or replace altogether).
-- Specifically: profiles_admin_manage, companies_admin_update,
-- invites_company_insert, invites_company_update.
```

### Migration 0026_consolidations.sql (без новых enum values, можно одной транзакцией)

```sql
alter table parts_requests
  add column kind text not null default 'operator'
    check (kind in ('operator', 'consolidated')),
  add column parent_id uuid references parts_requests(id) on delete set null,
  add column consolidated_at timestamptz,
  add column submitted_to_pm_at timestamptz,
  add column submitted_to_pm_by uuid references profiles(id);

create index parts_requests_parent_idx on parts_requests (parent_id) where parent_id is not null;
create index parts_requests_kind_status_idx on parts_requests (kind, status);

-- Backfill existing rows: rows that were created before this migration
-- are operator-level by default (no consolidation existed yet).
-- Their kind already defaulted to 'operator'; nothing else to backfill.
```

### Migration 0027_consolidation_statuses.sql (новые enum values — отдельная транзакция)

```sql
do $$
begin
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='consolidated') then
    alter type parts_request_status add value 'consolidated';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='drafting') then
    alter type parts_request_status add value 'drafting';
  end if;
  if not exists (select 1 from pg_enum e join pg_type t on e.enumtypid=t.oid
                 where t.typname='parts_request_status' and e.enumlabel='pending_pm') then
    alter type parts_request_status add value 'pending_pm';
  end if;
end$$;
```

### Migration 0028_workflow_rpcs.sql (использует новые enum values, поэтому в отдельной транзакции после 0027)

Новые / переписанные RPC (все SECURITY DEFINER, set search_path=public):

- `create_consolidated_request()` — service_engineer создаёт пустую сводную в статусе `drafting`. Возвращает её id.
- `consolidate_operator_requests(p_consolidated_id, p_operator_ids[])` — service_engineer добавляет/обновляет дочерние операторские в сводную. Дедуплицирует каталог по `part_id` (суммирует quantity), конкатенирует freeform. Переводит operator-заявки в `consolidated`. Идемпотентна (можно вызывать повторно с расширенным списком).
- `pm_edit_consolidated_items(p_id, p_parts_requested, p_parts_freeform, p_notes)` — service_engineer (до pending_pm) или project_manager (до forwarded) редактируют состав напрямую (без операторских заявок).
- `submit_consolidated_to_pm(p_id)` — service_engineer: drafting → pending_pm.
- `pm_approve_scope(p_id)` — project_manager: pending_pm → forwarded.
- `quote_parts_request(p_id, ...)` — переписать: разрешено **только** platform_admin (ранее tier2). forwarded → quoted.
- `pm_accept_quote(p_id)` — project_manager: quoted → approved.
- `mark_parts_request_ordered(p_id, p_eta)` — переписать: разрешено **только** platform_admin. approved → ordered.
- `mark_parts_request_received` — без изменений в логике, обновить allow-list ролей.
- `cancel_parts_request` — обновить allow-list ролей под новый workflow.

### Migration 0029_rls_updates.sql (RLS изменения)

```sql
-- Tier 2 теряет видимость parts_requests. Раньше видел forwarded+, теперь — нет.
drop policy if exists parts_requests_tier2_visible on parts_requests;

-- Platform admin видит forwarded+ заявки от всех компаний.
create policy parts_requests_platform_visible on parts_requests
  for select to authenticated
  using (
    public.user_role() = 'platform_admin'
    and (kind = 'consolidated' and status in
         ('forwarded','quoted','approved','ordered','received','cancelled'))
  );

-- Operator видит свои operator-заявки + сводные, в которые попали его заявки
-- (через parent_id ИЛИ через подзапрос). В пилоте делаем простой вариант:
-- operator видит все parts_requests своей компании (чтобы видел статус сводной),
-- но в UI фильтруем под свою машину/себя.
-- Текущая company_all policy уже это покрывает.

-- profiles RLS — заменить упоминания company_admin на project_manager.
-- (детали в имплементационном плане)
```

## UI changes

### Sidebar (AppLayout.tsx)

| Пункт | operator | service_eng | project_mgr | tier2 | platform_admin |
|---|---|---|---|---|---|
| Главная | ✓ | ✓ | ✓ | ✓ | `/admin` |
| Парк техники | ✓ (свои) | ✓ (все) | ✓ (все) | ✓ ro | — |
| Смены | ✓ (свои) | ✓ (все) | ✓ ro | — | — |
| Тикеты | ✓ (свои) | ✓ (все) | ✓ ro | ✓ кросс-tenant | ✓ кросс-tenant |
| Гараж (заявки) | ✓ (свои + видимые сводные) | ✓ (входящие + сводные) | ✓ (на согласование + работа) | — | `/admin/queue/parts` |
| ТО | — | ✓ | ✓ | — | — |
| Команда | — | — | ✓ | — | — |
| Все компании | — | — | — | — | ✓ (`/admin`) |
| Профиль | ✓ | ✓ | ✓ | ✓ | ✓ |

### Новые экраны

- `/app/parts/consolidated/new` — service_engineer выбирает несколько operator-заявок и создаёт сводную (либо инлайн в `/app/parts`).
- `/app/parts/consolidated/[id]` — детальный вид сводной: дочерние operator-заявки, дедуплицированный список позиций, цены (если ≥quoted и роль позволяет), timeline, кнопки переходов по роли.
- `/admin` — list of companies (только platform_admin).
- `/admin/companies/[id]` — read-only обзор компании.
- `/admin/queue/parts` — все consolidated forwarded/quoted/approved/ordered со всех компаний.

### Cost gating компонент

Новый helper-компонент `<PriceField>`:

```tsx
<PriceField
  amount={request.quote_total_amount}
  currency={request.quote_currency}
  visibleAfterStatus="quoted"  // показывается только при status >= quoted
  fallback="—"
/>
```

Использование в RequestTimeline, плитках и шапке detail page. Если роль = operator/service — render fallback (или ничего).

## Out of scope

- Импесонификация platform_admin'ом юзеров клиентских компаний (нет «войти как X»). Только read-only обзор через `/admin/companies/[id]`.
- Аудит-лог изменений ролей (отдельная задача).
- Уведомления (email/push) при появлении нового pending_pm — постзапуск пилота.
- Иерархия машин (site → block) — остаётся плоской.

## Implementation phasing

Пять подспринтов, каждый — отдельный merge:

| # | Что | Прим. время |
|---|---|---|
| **B1** | Roles rename (company_admin → project_manager в БД, типах, UI, invites, RLS) | 1 ч |
| **B2** | Tier 2 без parts (Tier 2 не видит /app/parts, не вызывает parts RPC) | 30 мин |
| **B3** | Двухуровневая модель + дедупликация (миграции 0026/27/28, новые RPC, новые экраны для service/PM, types, RequestActionPanel под все роли+статусы) | 3-4 ч |
| **B4** | Platform admin layout (`/admin` список компаний + обзор каждой + очередь parts кросс-tenant) | 2-3 ч |
| **B5** | Cost gating (`<PriceField>` компонент + замена прямых обращений к quote_* в UI) | 30 мин |

Итого ~7-9 часов разработки + время на применение миграций и тест.

## Verification

1. **Roles migration:** SQL `select role, count(*) from profiles group by role` — нет рядов с `company_admin` после 0025.
2. **Workflow happy path:** прогон по полному пути от operator submitted → consolidated → pending_pm → forwarded → quoted → approved → ordered → received. Каждая стадия проверяется как вызов соответствующего RPC под нужной ролью + проверка изменения статуса в БД.
3. **Дедупликация:** создаём 3 operator-заявки на разные машины с одной общей каталожной позицией (например, фильтр X20). После consolidate проверяем что в `parts_requested` сводной этот фильтр представлен **одной строкой** с суммарным quantity.
4. **Cost gating:** входим как PM, открываем сводную в статусе `forwarded` — `quote_total_amount` не показывается. Меняем статус на `quoted` через platform_admin → перезагружаем как PM → теперь видно.
5. **Tier 2 без parts:** входим как `tier2_engineer`, проверяем что `/app/parts` не доступно (404 или редирект), и `quote_parts_request` падает с permission denied.
6. **Platform admin:** входим как `platform_admin`, открываем `/admin`, видим список компаний с числами; `/admin/companies/[id]` показывает read-only обзор; `/admin/queue/parts` — очередь сводных от всех компаний.
7. **RLS sanity:** `curl` к `/rest/v1/parts_requests` под анонимным ключом возвращает только то что разрешено политиками — без утечки кросс-tenant данных.

## Files touched (high level — детали в плане)

**Новые миграции:** `db/migrations/0025_roles.sql`, `0026_consolidations.sql`, `0027_consolidation_statuses.sql`, `0028_workflow_rpcs.sql`, `0029_rls_updates.sql`.

**Новые компоненты/страницы:** `app/src/components/parts/PriceField.tsx`, `app/src/components/parts/ConsolidationPicker.tsx`, `app/src/app/admin/layout.tsx`, `/admin/page.tsx`, `/admin/companies/[id]/page.tsx`, `/admin/queue/parts/page.tsx`.

**Изменяемые:** `app/src/lib/types.ts`, `app/src/lib/context/GlobalContext.tsx`, `app/src/components/AppLayout.tsx`, `app/src/components/parts/RequestActionPanel.tsx`, `app/src/components/parts/RequestTimeline.tsx`, `app/src/components/parts/RequestStatusBadge.tsx`, `app/src/app/app/parts/page.tsx`, `app/src/app/app/parts/request/page.tsx`, `app/src/app/app/parts/request/[id]/page.tsx`, `app/src/app/app/team/page.tsx`, `app/src/app/api/invites/create/route.ts`, `app/src/app/api/onboarding/create-company/route.ts`.
