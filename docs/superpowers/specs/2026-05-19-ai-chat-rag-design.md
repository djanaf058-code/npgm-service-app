# AI-чат с RAG по мануалам + эскалация на НПГМ-специалиста — дизайн

**Дата:** 19.05.2026
**Статус:** утверждено владельцем, готово к writing-plans
**Skill:** brainstorming → writing-plans (следующий шаг)

---

## 1. Контекст

Из ТЗ (`CODE/docs/specs/2026-05-05-service-platform-design.md`) ключевая функция MVP — AI-ассистент 24/7 как Tier 0 с эскалацией к специалисту НПГМ (Tier 2). В текущей кодовой базе есть `tickets` + `ticket_messages` (миграция 0012) — это статичный чат внутри тикета между оператором и сервисным инженером. AI как участник, RAG по мануалам, retrieval со ссылками на страницы РЭ, learning-loop из решённых эскалаций — отсутствуют.

**Цель спеки:** спроектировать минимальный, но реалистичный AI-чат с RAG, эскалацией и обучением, который закрывает ключевое УТП продукта (см. ТЗ п. 1.2.1 — «AI-ассистент 24/7 для оператора СЗМ + RAG по мануалам»).

**Из ТЗ берём вариант (C) — Full ТЗ** (вопрос 2 brainstorming):
- RAG по PDF РЭ
- Claude Vision на фото
- Self-rated confidence scoring
- Авто-эскалация на НПГМ-специалиста при низкой уверенности
- Learning-loop: решения закрытых тикетов попадают в RAG как «verified»

---

## 2. Сценарий взаимодействия

### 2.1. Happy path (AI справляется)

```
1. Оператор открывает страницу машины (МСЗУ-14-НПБ #серийник)
2. Внизу drawer "Спросить" → раскрывается чат
3. Оператор: "Машина не запускается, мигает красная лампа"
            + фото пульта
4. Backend:
   ├─ создаёт ai_conversations(operator_id, machine_id, status='active')
   ├─ embed(сообщение) → Voyage AI multilingual
   ├─ pgvector retrieve TOP-5 чанков (machine_type=МСЗУ, RU+EN)
   ├─ Claude Sonnet 4.6 с system-prompt:
   │    "Ты эксперт по МСЗУ-14-НПБ. Машина: серийник X, наработка Y часов,
   │    Z тонн. Последнее ТО: ... Отвечай на русском (язык оператора).
   │    Ссылайся на конкретные страницы РЭ. Оцени свою уверенность 0-100."
   ├─ context: top-5 чанков + предыдущие сообщения
   └─ user_message: текст + image (Claude Vision)
5. Claude: "Красная мигающая лампа — индикатор низкого уровня эмульсии
   в баке. Проверьте: 1) уровень эмульсии в баке, 2) предохранитель F12.
   См. РЭ стр. 47, раздел 4.3.2. Confidence: 78."
6. confidence=78 (диапазон 60-80) → UI показывает ответ + кнопку
   "Не помогло, передать инженеру"
7. Оператор: "Сделал, не помогло"
   → новый retrieval + Claude → confidence падает до 45
   → < 60% → автоэскалация
```

### 2.2. Эскалация

```
8. ai_conversations.status='escalated'
9. Создаётся ticket:
   ├─ tickets.row с operator_id, machine_id, company_id
   ├─ title = "[AI escalated] Машина не запускается, мигает красная лампа"
   ├─ status = 'new'
   ├─ priority = 3 (default)
   ├─ resolution_summary = null
10. История ai_messages копируется в ticket_messages:
    ├─ sender_type='ai' (новое значение enum, см. §4)
    ├─ retrieved_chunk_ids[] сохраняются для аудита
11. Push НПГМ-специалисту (platform_admin):
    ├─ email с deeplink на тикет
    ├─ in-app realtime notification (Supabase Realtime)
12. SE компании оператора ТОЖЕ видит тикет (та же tenant-RLS как сейчас)
13. НПГМ-специалист (или SE, кто первый) отвечает в тикете
    → ticket_messages.sender_type='platform_admin' | 'service_engineer'
14. Решение → ticket.status='resolved' + resolution_summary заполнен
```

### 2.3. Learning loop

```
15. Trigger on tickets.status → 'resolved' (когда resolution_summary не пуст):
16. Backend:
    ├─ Claude суммаризирует диалог в (вопрос, решение)-пары
    ├─ для каждой пары:
    │    embed(вопрос + решение) → Voyage
    │    insert в manual_chunks (
    │      machine_type, language='ru'|'en',
    │      source='tier2_resolution:<ticket_id>',
    │      page=null, section='FAQ',
    │      chunk_text='Q: ... A: ...',
    │      embedding, verified_at=now(), verified_by=resolver_id
    │    )
17. В retrieval verified-чанки получают boost (× 1.5 в re-ranking)
18. Следующий похожий вопрос → AI находит этот FAQ → confidence высокая
    → решает напрямую, без эскалации
```

---

## 3. Архитектура

### 3.1. Стек

| Слой | Решение | Обоснование отклонения от ТЗ |
|---|---|---|
| AI | **Anthropic Claude Sonnet 4.6 (API)** | Совпадает с ТЗ |
| Embeddings | **Voyage AI `voyage-multilingual-2`** (1024-dim) | ТЗ говорит multilingual-e5 self-host. Voyage — официальная рекомендация Anthropic, multilingual ru/en качество выше, не нужна self-host инфра. Цена символическая ($0.10 / 1M токенов). |
| Vector store | **pgvector** в Supabase Postgres | Совпадает с ТЗ |
| AI service | **Next.js API routes** (Node) | ТЗ предлагал FastAPI Python. Для 1-person team отдельный Python процесс — лишняя нагрузка. Anthropic SDK + Voyage SDK работают в Node. |
| PDF parsing | **`pdf-parse`** (Node) | Все 4 РЭ — текстовые PDF, OCR не нужен |
| Vision | **Claude Vision** (через тот же Anthropic SDK) | Совпадает с ТЗ |
| Realtime | **Supabase Realtime** на ai_messages + ticket_messages | Совпадает с ТЗ |
| Streaming | **SSE через Next.js Route Handler** | Стандарт для AI-чатов 2026 |

### 3.2. Поток данных

```
Browser (operator)
    │   ↑
    │   │ SSE stream
    ▼   │
Next.js /api/ai/respond (Node runtime, NOT edge — pgvector нужен)
    │
    ├──► Supabase (PostgreSQL + pgvector)
    │      • ai_conversations / ai_messages CRUD
    │      • SELECT embedding <=> $1 LIMIT 5
    │
    ├──► Voyage API (embed user message)
    │
    └──► Anthropic API (Claude Sonnet 4.6 + Vision)
           • streaming completion
           • system prompt построен из retrieved chunks
```

Никаких отдельных сервисов. Всё внутри Next.js приложения.

---

## 4. Схема БД (миграция 0032)

### 4.1. Расширение существующих сущностей

```sql
-- Расширить sender_type enum для ticket_messages
alter type message_sender add value if not exists 'ai';
alter type message_sender add value if not exists 'platform_admin';
-- (legacy tier2 уже есть)
```

### 4.2. Новые таблицы

```sql
-- pgvector extension (если ещё не включено)
create extension if not exists vector;

-- Чанки мануалов + verified solutions из эскалаций
create table manual_chunks (
  id              uuid primary key default gen_random_uuid(),
  machine_type    text not null,        -- 'МСЗУ','МЗУ','МЗВ','МСЗ'
  language        text not null,        -- 'ru','en'
  source          text not null,        -- 'manual:<filename>' | 'tier2_resolution:<ticket_id>'
  page            int,                  -- nullable для FAQ-чанков
  section         text,                 -- 'Эксплуатация','ТО','FAQ',...
  chunk_text      text not null,
  embedding       vector(1024) not null,
  verified_at     timestamptz,          -- non-null = добавлено из эскалации
  verified_by     uuid references profiles(id),
  created_at      timestamptz not null default now()
);

create index manual_chunks_machine_lang_idx
  on manual_chunks (machine_type, language);

-- IVFFlat — баланс между скоростью и точностью для ~2000-10000 чанков
create index manual_chunks_embedding_idx
  on manual_chunks using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- AI-разговоры (отдельная сущность от tickets — большинство НЕ эскалируется)
create table ai_conversations (
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

create index ai_conversations_operator_idx
  on ai_conversations (operator_id, created_at desc);

create index ai_conversations_machine_idx
  on ai_conversations (machine_id, created_at desc);

-- Сообщения внутри AI-чата
create table ai_messages (
  id                    uuid primary key default gen_random_uuid(),
  conversation_id       uuid not null references ai_conversations(id) on delete cascade,
  role                  text not null check (role in ('user','assistant')),
  content               text not null,
  image_url             text,                 -- Supabase Storage path
  retrieved_chunk_ids   uuid[],               -- какие чанки использовал AI
  ai_confidence         smallint
                          check (ai_confidence is null or ai_confidence between 0 and 100),
  created_at            timestamptz not null default now()
);

create index ai_messages_conversation_idx
  on ai_messages (conversation_id, created_at);
```

### 4.3. RLS

```sql
-- ai_conversations
-- operator видит свои разговоры
-- SE/PM/admin компании видят все разговоры в своей компании
-- platform_admin видит всё (cross-tenant)
create policy ai_conversations_operator_self on ai_conversations
  for all using (operator_id = auth.uid())
  with check (operator_id = auth.uid());

create policy ai_conversations_internal_all on ai_conversations
  for all using (
    company_id = public.user_company_id()
    and public.user_role() in ('service_engineer','project_manager')
  );

create policy ai_conversations_platform_all on ai_conversations
  for all using (public.user_role() = 'platform_admin');

-- ai_messages — наследует от parent conversation
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

-- manual_chunks
-- Чтение: все authenticated (мануалы общедоступные)
-- Запись: только platform_admin (загружает мануалы) + system insert при learning loop
create policy manual_chunks_authed_read on manual_chunks
  for select to authenticated using (true);

create policy manual_chunks_platform_write on manual_chunks
  for all using (public.user_role() = 'platform_admin')
  with check (public.user_role() = 'platform_admin');
```

### 4.4. Trigger на закрытие тикета → learning loop

Learning loop работает ТОЛЬКО для тикетов, которые пришли через AI-эскалацию.
Иначе ручные тикеты SE без AI-контекста засоряли бы FAQ.

```sql
-- Прибавляем 2 колонки к tickets:
alter table tickets
  add column if not exists originated_from text
    default 'manual' check (originated_from in ('manual','ai_escalation')),
  add column if not exists resolved_by uuid references profiles(id);

-- ticket_messages.sender_id сейчас NOT NULL. AI-сообщения должны иметь
-- sender_id = NULL (AI не привязан к пользователю). Снимаем NOT NULL.
alter table ticket_messages
  alter column sender_id drop not null;

create table ai_learning_queue (
  id              uuid primary key default gen_random_uuid(),
  ticket_id       uuid not null references tickets(id) on delete cascade,
  processed_at    timestamptz,
  error           text,
  created_at      timestamptz not null default now()
);

create or replace function enqueue_for_learning() returns trigger
language plpgsql as $$
begin
  -- Триггер только для AI-эскалаций — иначе FAQ-индекс засорится
  -- обычными тикетами SE без AI-диалога.
  if new.status = 'resolved'
     and (old.status is null or old.status <> 'resolved')
     and new.resolution_summary is not null
     and new.resolution_summary <> ''
     and new.originated_from = 'ai_escalation' then
    insert into ai_learning_queue (ticket_id)
    values (new.id);
  end if;
  return new;
end$$;

create trigger tickets_enqueue_learning
  after update on tickets
  for each row execute function enqueue_for_learning();
```

Cron на стороне приложения (Vercel cron / Supabase scheduled function) дёргает
`/api/ai/learn` каждые 5 минут, обрабатывает unprocessed rows.

---

## 5. Pipeline ingestion мануалов

Скрипт `scripts/ingest-manuals.ts` (запускается вручную при загрузке нового мануала):

```
1. Принимает path к PDF + machine_type + language
2. pdf-parse → text per page
3. Chunking:
   • ~400 токенов на чанк (≈ 1500 символов RU, 2000 EN)
   • overlap 50 токенов
   • respect page boundaries (если возможно)
   • метаданные: page, section (определяется по заголовкам)
4. Voyage AI batch embed (до 128 чанков за раз)
5. Upsert в manual_chunks
6. Log: "Ingested N chunks from <filename>"
```

Запускаем на наших 5 файлах (МЗВ × 2 языка считаем отдельно):
- МСЗУ-14-НПБ.pdf → ~250 чанков
- Operation Manual MZU-16-4K Eng.pdf → ~180
- ANFO Operational Manual.pdf → ~130
- ТО МЗВ-16.pdf → ~150
- ТО МЗВ-16 eng.pdf → ~155

**Итого ~865 чанков.** Объём embeddings ~3.5MB. Pgvector на этих объёмах работает мгновенно.

Cost (разовый): Voyage AI ~$0.20, Claude OCR не нужен (текстовые PDF).

---

## 6. Pipeline AI response

`POST /api/ai/respond`:

```ts
body: { conversation_id: string, message: string, image_url?: string }

1. Auth check + fetch conversation
2. Load machine context (model, serial, hours, tons, recent maintenance)
3. Save user message (role='user', conversation_id)
4. Embed user message → Voyage
5. Vector search — НЕ фильтруем по языку (multilingual-2 embeddings лежат
   в одном векторном пространстве, см. ТЗ §7.3 — Claude переводит на лету):
   SELECT id, chunk_text, page, section, source, language,
          1 - (embedding <=> $1) as similarity,
          case when verified_at is not null then 1.5 else 1.0 end as boost
     FROM manual_chunks
    WHERE machine_type = $2
    ORDER BY (1 - (embedding <=> $1)) * boost DESC
    LIMIT 5;
6. Build Claude prompt:
   system: """
     You're an expert in NIPIGORMASH {{machine_type}}. Machine details:
     - Model: {{model_code}}
     - Serial: {{serial}}
     - Hours: {{hours}}, Tons: {{tons}}
     - Last maintenance: {{last_to}}
     - Open tickets: {{open_tickets}}

     Operator's language: {{lang}}. Reply in their language.
     Cite specific page numbers from the manual.
     End your response with: "Confidence: NN" (0-100, your self-assessment).
   """
   context (as separate user message): chunks formatted
   history: prior ai_messages
   user_message: text + image
7. Streaming Anthropic call → SSE to client
8. On stream end:
   - parse confidence from response
   - save assistant message with retrieved_chunk_ids[]
   - if confidence ≥ 80 → status remains 'active'
   - if 60 ≤ confidence < 80 → flag UI to offer escalation
   - if confidence < 60 → auto-escalate (call /api/ai/escalate internally)
```

---

## 7. Эскалация — `/api/ai/escalate`

```ts
1. Fetch conversation + all ai_messages
2. INSERT ticket:
   - company_id, operator_id, machine_id from conversation
   - title = (Claude one-liner summary of conversation, "Generate a 5-7
     word ticket title in {{lang}}")
   - status='new', priority=3
   - resolution_summary=null
   - originated_from='ai_escalation'    -- ключ для learning loop §4.4
3. UPDATE ai_conversations SET status='escalated', ticket_id=NEW, escalated_at=now()
4. Copy messages to ticket_messages:
   - role='user' → sender_type='operator', sender_id=operator_id
   - role='assistant' → sender_type='ai', sender_id=NULL (см. §4.4 ALTER COLUMN)
5. Notify:
   - Supabase Realtime broadcast on tickets:platform_admin channel
   - Email via Supabase Auth → next iteration (PDF email lives next to this)
6. Return ticket_id to client → operator sees "Передал инженеру, ETA 2ч"
```

---

## 8. Learning loop — `/api/ai/learn`

Cron каждые 5 мин:

```ts
1. SELECT * FROM ai_learning_queue WHERE processed_at IS NULL LIMIT 10
2. Для каждого row:
   - load ticket + ticket_messages + machine
   - Claude prompt:
     """
     Given this resolved escalation, extract 1-3 (Question, Answer) pairs
     suitable for FAQ. Format as JSON: [{"q":"...","a":"..."}].
     Language: {{detected language}}.
     """
   - для каждой пары:
     • text = "Q: {q}\nA: {a}"
     • embed via Voyage
     • INSERT manual_chunks (
         machine_type from machine,
         language,
         source='tier2_resolution:<ticket_id>',
         section='FAQ',
         chunk_text=text,
         embedding,
         verified_at=now(),
         verified_by=ticket.resolved_by (need to add this column to tickets!)
       )
   - UPDATE ai_learning_queue SET processed_at=now()
3. On error: SET error=msg (для повторной обработки вручную)
```

**Изменения в схеме tickets** уже включены в миграцию 0032 (§4.4):
`originated_from`, `resolved_by`. Колонку `resolved_by` заполняем при
переходе ticket в `resolved` (в обработчике endpoint).

---

## 9. UI

### 9.1. Drawer чата на странице машины (`/app/machines/[id]`)

Внизу страницы — иконка-кнопка «Спросить AI» (chat-bubble icon, нижний правый угол).

Клик → раскрывается drawer высотой 70% экрана:
- header: «Чат по МСЗУ-14-НПБ»
- messages list (streaming-обновления через Supabase Realtime)
- input row: textarea + paperclip (фото) + send
- если последнее ai_message имеет confidence в 60-79 → кнопка «Не помогло, передать инженеру»
- если status='escalated' → баннер «Передал {{resolver_name}}, ETA {{sla}}» + ссылка на тикет

### 9.2. Список AI-разговоров

Не делаем отдельную страницу `/app/ai-chat` — оператор всегда заходит из машины. История его разговоров видна на странице машины (раскрывается выше drawer).

### 9.3. Админская консоль AI

Новая страница `/admin/ai/conversations` — список всех разговоров cross-tenant. Колонки: компания, оператор, машина, последнее сообщение, статус, confidence. Фильтры: «эскалированные», «низкая уверенность», «активные».

### 9.4. Загрузка мануала

Страница `/admin/manuals` — кнопка «Загрузить РЭ». Форма: machine_type, language, PDF upload. На сабмит — uploads в Supabase Storage + триггерит ingestion API endpoint, который запускает ту же логику что скрипт.

---

## 10. Фазы реализации

| Фаза | Содержание | Дни | Deliverable |
|---|---|---|---|
| **A** | Миграция 0032 (pgvector, таблицы, RLS) + ingestion-скрипт + прогон 5 PDF | 1-2 | retrieval работает; SELECT по вектору даёт релевантные чанки на тестовых вопросах |
| **B** | UI чата (drawer на машине) + БД для сообщений (без AI) | 2-3 | оператор пишет, видит свою историю, фото грузятся в Storage |
| **C** | `/api/ai/respond` с RAG + Claude + streaming | 2-3 | AI отвечает на вопросы со ссылками на страницы РЭ |
| **D** | Confidence routing + `/api/ai/escalate` + тикет с историей | 1-2 | оператор получает либо AI-ответ либо тикет с НПГМ-специалистом |
| **E** | `ai_learning_queue` + trigger + `/api/ai/learn` cron | 1-2 | закрытый тикет порождает verified FAQ-чанки |
| **F** | Claude Vision: фото в request → анализ → используется в response | 1-2 | оператор фоткает индикатор → AI читает что мигает |

**Параллелизация:** A и B можно делать параллельно. C зависит от A. D зависит от B+C. E зависит от D. F — последний.

**Минимально-полезный продукт:** A + B + C (5-8 дней). Эскалация без AI можно отложить (оператор просто получает AI-ответ, без тикетов из чата).

---

## 11. Verification workflow

Параллельный запрос пользователя — автоматизация QA, чтобы не пинговать его на каждой итерации.

**Что делаем:**

После каждой фазы реализации (A-F выше) обязательный шаг — вызов sub-agent с инструкцией «verify end-to-end что фаза работает». Sub-agent:

1. Проверяет `pnpm build` без warnings/errors
2. Проверяет применение миграции (там где есть)
3. Прогоняет smoke-тест через REST API c service key:
   - Создание тестового conversation
   - Отправка тестового сообщения
   - Проверка что AI отвечает
   - Очистка тестовых данных
4. Для UI-фаз — Playwright headless: открыть страницу, кликнуть, проверить что drawer открылся

Если что-то ломается — main flow Claude фиксит на месте, не показывает пользователю до зелёного. Если поломка фундаментальная (требует решения) — поднимается до уровня пользователя с конкретным вопросом, не «вот ошибка, что делать».

В Superpowers готовый skill: `verification-before-completion`. Применяем его в плане каждой фазы как явный шаг.

---

## 12. Стоимость и зависимости

**Внешние API (на пилот):**
- Anthropic Claude Sonnet 4.6: ~$15 / 1M input + $75 / 1M output. На 100 разговоров × 4K context × 2K output ≈ $20
- Anthropic Vision: ~$5/1000 images (~1MB фото). На 100 фото ≈ $0.5
- Voyage AI embeddings: $0.10 / 1M токенов. На 10K чанков + 10K user queries ≈ $1

**Итого на пилот (3 месяца, 2 компании, ~500 conversations):** ~$100-150.

**Новые ENV vars:**
- `ANTHROPIC_API_KEY` — Claude
- `VOYAGE_API_KEY` — Voyage embeddings

**npm-зависимости (новые):**
- `@anthropic-ai/sdk` (Claude + Vision)
- `voyageai` (или fetch напрямую — Voyage SDK молодой)
- `pdf-parse` (PDF text)
- `pgvector` для типа в Supabase JS клиенте

---

## 13. Что НЕ делаем в этом спринте

- Голосовой ввод (Whisper) — v2
- Видеоанализ — v2 (только статичные изображения через Vision)
- Multi-language UI (только бэкенд RAG умеет ru/en, интерфейс пока RU)
- PWA / offline — отдельная задача
- Drill & Blast интеграция — v2
- WebRTC-звонок между оператором и НПГМ — v2
- Telegram как канал ввода — v2

---

## 14. Открытые вопросы

**14.1.** PDF МСЗ ANFO Operational Manual.pdf — единственный мануал для МСЗ, но он на английском. Если у MCS оператор пишет по-русски — RAG найдёт английский чанк, Claude переведёт. Это ОК или нужно сначала добыть RU-версию у НИПИГОРМАШа?

**14.2.** «НПГМ-специалист» = `platform_admin` (ты, один человек на старте). При росте — нужно несколько админов с pooling. Сейчас закладываем простую модель (один human reviewer), масштабирование в v2.

**14.3.** Push-уведомления для тебя при эскалации — email через Supabase Auth работает, но без шаблонов. Достаточно ли простого «New escalated ticket: [link]» в MVP, или нужны кастомные шаблоны? Закладываю простой.

**14.4.** Электросхемы / каталог запчастей — упомянуты тобой как ценные документы. На MVP не загружаем (нет ещё PDF/структуры). После пилота — отдельный батч в RAG с метаданными «type=schema» / «type=parts_catalog».

---

## 15. Следующий шаг

После approval этой спеки → `superpowers:writing-plans` сгенерирует пофазовый план (A→F) с чек-листами «что сделать», «какой код написать», «какая verification после». Затем `superpowers:executing-plans` пройдётся по плану.
