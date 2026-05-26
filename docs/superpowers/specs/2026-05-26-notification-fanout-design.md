# Spec: починка fan-out in-app уведомлений под новые роли + workflow заявок

**Date:** 2026-05-26
**Status:** approved by user (brainstorming), ready for implementation plan
**Owner:** ВФ + Claude

## Context — почему

В приложении уже есть in-app уведомления: таблица `notifications` + SECURITY
DEFINER триггеры (migration 0040), колокольчик `NotificationsBell` с realtime.
Канал доставки решили **не добавлять** (Telegram/email отклонены: трение для
пилота). Остаёмся на in-app колокольчике — он мгновенный (realtime) и нулевой по
настройке для пользователей.

Но fan-out из 0040 **отстал от текущей модели ролей и workflow заявок**, поэтому
колокольчик загорается не у тех людей:

1. **Тикеты:** сообщение оператора уведомляет клиентского `service_engineer` +
   `platform_admin`. А отвечает на тикеты теперь инженер НПГМ (`tier2_engineer`) —
   у него колокольчик **не загорается вообще**.
2. **Заявки на запчасти:** уведомление создаётся только на INSERT и уходит всем
   `platform_admin`. Переходы консолидированного workflow
   (operator→SE→PM→admin→received) **никого не уведомляют**, а блок «на каждый
   insert админу» шумит и не отражает реальный процесс.

Эта задача чинит «кому и когда загорается колокольчик». Новый канал и изменения
схемы не требуются — только переписать триггеры/функции и добавить i18n-метки
типов.

## Outcome

Когда задача выполнена:

- **Тикеты:** сообщение оператора → `tier2_engineer` + `platform_admin`; ответ
  инженера/AI/админа → оператор тикета. (Отправителя из получателей исключаем.)
- **Заявки:** на каждом шаге workflow уведомляется **следующий актор**:
  - операторская заявка создана → `service_engineer` + `project_manager` той же
    компании;
  - сводная отправлена PM → `project_manager`;
  - PM согласовал scope (forwarded) → `platform_admin` + `tier2_engineer`;
  - админ выставил КП (quoted) → `project_manager`;
  - PM принял КП (approved) → `platform_admin`;
  - админ разместил заказ (ordered) → операторы дочерних заявок + `service_engineer`
    + `project_manager`;
  - получено (received) → `platform_admin` + `project_manager`;
  - отменено (cancelled) → контрагент текущего шага.
- Колокольчик показывает осмысленную метку для каждого нового типа (i18n); realtime
  и mark-read работают как сейчас.

Никаких новых каналов доставки, никаких изменений UI кроме i18n-меток.

## Архитектура

Ничего не меняется в потоке:
```
событие → public.notify(recipients[], company, type, title, link, entity)
        → INSERT в notifications
        → колокольчик (load + realtime фильтр recipient_id=eq.<me>) — как сейчас
```
Меняем только **кто** попадает в `recipients[]` и **на каких событиях**
вызывается `notify()`.

`notify()` (хелпер из 0040) переиспользуем без изменений.
`NotificationsBell.tsx` **не трогаем**: `typeLabel()` уже фолбэчит неизвестные
типы на `type.generic`, поэтому достаточно добавить i18n-ключи.

## Изменения

### 1. Тикеты — переписать `notify_on_ticket_message()` (в migration 0042)

- Ветка `sender_type = 'operator'`: получатели =
  `select array_agg(id) from profiles where role in ('tier2_engineer','platform_admin')`.
  (Раньше брали клиентского `service_engineer` по компании — убираем.)
  `type = 'ticket_operator_msg'`, link `/app/tickets/<id>`.
- Иначе: получатель = `v_ticket.operator_id`, `type = 'ticket_answer'`.
- Отправителя (`new.sender_id`) из получателей исключаем (как сейчас).

### 2. Заявки — заменить INSERT-триггер на точечные уведомления

**Снять** блок «на каждый insert → всем админам»:
```sql
drop trigger if exists trg_notify_parts_request on public.parts_requests;
```

**Новый триггер** на создание операторской заявки (в migration 0042):
- `after insert on parts_requests` `when (new.kind = 'operator')`;
- получатели = `service_engineer` + `project_manager` той же `new.company_id`;
- `type = 'parts_submitted'`, link `/app/parts/request/<id>`;
- `new.requested_by` из получателей исключить.

**Вызовы `notify()` внутри RPC-переходов** (migration 0042 переписывает функции
через `create or replace`; большинство — из 0028, а `mark_parts_request_received`
определена в 0023b — план берёт её актуальное тело оттуда). У каждой RPC уже есть
строка заявки (id, company_id) и роль вызывающего:

| RPC (переход) | type | Получатели | link |
|---|---|---|---|
| `submit_consolidated_to_pm` (→pending_pm) | `parts_pending_pm` | PM компании заявки | `/app/parts/request/<id>` |
| `pm_approve_scope` (→forwarded) | `parts_forwarded` | `platform_admin` + `tier2_engineer` | `/admin/queue/parts` |
| `quote_parts_request` (→quoted) | `parts_quoted` | PM компании заявки | `/app/parts/request/<id>` |
| `pm_accept_quote` (→approved) | `parts_approved` | `platform_admin` | `/admin/queue/parts` |
| `mark_parts_request_ordered` (→ordered) | `parts_ordered` | операторы дочерних (`parent_id=<id>`) + SE + PM компании | `/app/parts/request/<id>` |
| `mark_parts_request_received` (→received) | `parts_received` | `platform_admin` + PM компании | `/admin/queue/parts` |
| `cancel_parts_request` (→cancelled) | `parts_cancelled` | контрагент шага (клиентская сторона → `platform_admin`+`tier2`; НПГМ-сторона → SE+PM компании) | по стороне |

Во всех вызовах актора (вызывающего) из получателей исключаем
(`array_remove(recipients, auth.uid())`).

### 3. i18n — метки новых типов

В namespace `notifications.type.*` (ru/en) добавить ключи для:
`parts_submitted`, `parts_pending_pm`, `parts_forwarded`, `parts_quoted`,
`parts_approved`, `parts_ordered`, `parts_received`, `parts_cancelled`.
(`ticket_operator_msg`, `ticket_answer`, `generic` уже есть.)

Пример (ru): `parts_pending_pm` → «Сводная заявка на согласование»,
`parts_forwarded` → «Заявка переслана в НПГМ», `parts_quoted` → «Выставлено КП»,
`parts_ordered` → «Заказ размещён», `parts_received` → «Запчасти получены».

## Схема

**Изменений схемы нет.** Migration `0042_notification_fanout.sql` содержит только
`create or replace function` для триггеров/RPC и `drop/create trigger`. Enum не
трогаем. Можно одной транзакцией.

## Out of scope
- Любой внешний канал доставки (Telegram/email/web-push) — отклонено.
- Гранулярные настройки/мьют по типам.
- Изменения UI колокольчика (кроме i18n-меток).
- Дайджесты.

## Verification

1. **Тикет:** оператор пишет в тикет → у привязанного к делу `tier2_engineer` и у
   `platform_admin` колокольчик показывает новое уведомление (realtime), у
   клиентского `service_engineer` — **нет**. Инженер отвечает → у оператора
   появляется уведомление.
2. **Заявки (полный цикл):** прогон operator→SE→PM→admin→ordered→received; на
   каждом шаге проверить, что новое уведомление появилось **только** у нужного
   следующего актора (SQL: `select recipient_id, type from notifications order by
   created_at desc limit N`).
3. **Самоуведомление:** актор перехода не получает уведомление о собственном
   действии.
4. **Метки:** в колокольчике у новых типов осмысленная подпись (не `generic`).
5. **Сборка:** `pnpm build` — 0 ошибок типов/линта.

## Файлы (high-level — детали в плане)

**Новые:**
- `db/migrations/0042_notification_fanout.sql` — переписанные `notify_on_ticket_message`,
  снятие `trg_notify_parts_request`, новый триггер на `kind='operator'`, вызовы
  `notify()` в RPC из 0028.

**Изменяемые:**
- `app/messages/ru.json` / `en.json` — `notifications.type.*` для новых типов.

**Без изменений (переиспользуем):**
- `public.notify(...)` (0040), `NotificationsBell.tsx` (фолбэк по типам уже есть).
