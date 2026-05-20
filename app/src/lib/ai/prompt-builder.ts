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
