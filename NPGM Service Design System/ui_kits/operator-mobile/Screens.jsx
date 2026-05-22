// ShiftStart-Ticket-AI.jsx — operator-mobile screens.
// Shift start (3-step wizard), New ticket, AI assistant drawer.

// ============================================================
// Shift start — 3-step wizard
// ============================================================
function ShiftStartScreen({ lang }) {
  const t = lang === 'RU' ? {
    title: 'Старт смены', stepLbl: 'Шаг',
    s1: 'Машина', s2: 'Чек-лист', s3: 'План',
    machineLbl: 'Машина *', machinePlaceholder: 'Выберите машину…',
    machineDefault: 'МСЗУ-14-НПВ (МСЗУ · SN MZB-2024-0142 · Северный, блок А-2)',
    plannedFor: 'Дата смены',
    next: 'Далее', back: 'Назад', startBtn: 'Начать смену',
    checklistTitle: 'Чек-лист перед сменой',
    checklistHint: 'Для каждого пункта: OK — исправно; Не OK — есть проблема (опишите и приложите фото). Критическое «Не OK» блокирует смену и открывает тикет.',
    answerOk: 'OK', answerNotOk: 'Не OK', criticalBadge: 'Критический',
    problemPlaceholder: 'Опишите проблему…',
    items: [
      { name: 'Уровень масла в норме', critical: true },
      { name: 'Шины без видимых повреждений', critical: false },
      { name: 'Аварийный стоп исправен', critical: true },
      { name: 'Освещение работает', critical: false },
      { name: 'Огнетушитель на месте, годен', critical: true },
      { name: 'Уровень эмульсии в баке', critical: false },
    ],
    criticalWarnStrong: 'Критическое замечание чек-листа.',
    criticalWarnRest: ' Продолжение создаст смену в статусе «Заблокирована» — оператор не сможет начать работу до устранения. Это намеренно, не пытайтесь обойти.',
    planTitle: 'План зарядки',
    planSubtitle: 'Это план — фактические значения вы заполните при закрытии смены.',
    plannedTonsLbl: 'Плановый тоннаж, т', holesLbl: 'Количество скважин',
    recipeLbl: 'Состав', recipes: { ANFO: 'ANFO (100% AN + дизтопливо)', EMULSION: '100% эмульсия', BLEND_70_30: '70/30 (70% эм + 30% АН)', BLEND_30_70: '30/70', OTHER: 'Другое' },
    pitLbl: 'Блок / карьер', pitPlaceholder: 'Блок А, Карьер 2',
  } : {
    title: 'Start shift', stepLbl: 'Step',
    s1: 'Machine', s2: 'Checklist', s3: 'Plan',
    machineLbl: 'Machine *', machinePlaceholder: 'Select a machine…',
    machineDefault: 'MSZU-14-NPV (МСЗУ · SN MZB-2024-0142 · Northern, block A-2)',
    plannedFor: 'Shift date',
    next: 'Next', back: 'Back', startBtn: 'Start shift',
    checklistTitle: 'Pre-shift checklist',
    checklistHint: "For each item: OK — operational; Not OK — there's a problem (describe and attach a photo). A critical 'Not OK' blocks the shift and opens a Tier 2 ticket.",
    answerOk: 'OK', answerNotOk: 'Not OK', criticalBadge: 'Critical',
    problemPlaceholder: 'Describe the issue…',
    items: [
      { name: 'Oil level within range', critical: true },
      { name: 'Tyres free of visible damage', critical: false },
      { name: 'Emergency stop functional', critical: true },
      { name: 'Lighting operational', critical: false },
      { name: 'Fire extinguisher present, valid', critical: true },
      { name: 'Emulsion tank level', critical: false },
    ],
    criticalWarnStrong: 'Critical checklist failure.',
    criticalWarnRest: " Continuing will create a shift in 'Blocked' status — the operator cannot start work until resolved. This is intentional, do not try to bypass.",
    planTitle: 'Charging plan',
    planSubtitle: 'This is the plan — actual values will be entered when closing the shift.',
    plannedTonsLbl: 'Planned tonnage, t', holesLbl: 'Holes count',
    recipeLbl: 'Recipe', recipes: { ANFO: 'ANFO (100% AN + diesel)', EMULSION: '100% emulsion', BLEND_70_30: '70/30 (70% EM + 30% AN)', BLEND_30_70: '30/70', OTHER: 'Other' },
    pitLbl: 'Block / pit', pitPlaceholder: 'Block A, Pit 2',
  };

  const [step, setStep] = React.useState(1);
  const [answers, setAnswers] = React.useState(Array(t.items.length).fill(null));
  const setAns = (i, v) => setAnswers(prev => prev.map((a, j) => j === i ? v : a));
  const allAnswered = answers.every(a => a !== null);
  const hasCriticalFail = t.items.some((it, i) => it.critical && answers[i] === 'not_ok');

  const [planTons, setPlanTons] = React.useState('280');
  const [holes, setHoles] = React.useState('32');
  const [recipe, setRecipe] = React.useState('BLEND_70_30');
  const [pit, setPit] = React.useState('Северный, блок А-2');

  // Step indicator
  const stepDots = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: '#fff', borderBottom: `1px solid ${NPGM.s200}` }}>
      {[1, 2, 3].map(n => (
        <React.Fragment key={n}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            color: step >= n ? NPGM.blue700 : NPGM.s500,
          }}>
            <div style={{
              width: 22, height: 22, borderRadius: '50%',
              background: step >= n ? NPGM.blue600 : NPGM.s200,
              color: step >= n ? '#fff' : NPGM.s500,
              fontFamily: NPGM.fB, fontSize: 11, fontWeight: 600,
              display: 'grid', placeItems: 'center',
            }}>{step > n ? '✓' : n}</div>
            <span style={{ fontFamily: NPGM.fB, fontSize: 12, fontWeight: step === n ? 600 : 500 }}>
              {n === 1 ? t.s1 : n === 2 ? t.s2 : t.s3}
            </span>
          </div>
          {n < 3 && <div style={{ flex: 1, height: 1, background: step > n ? NPGM.blue200 : NPGM.s200 }} />}
        </React.Fragment>
      ))}
    </div>
  );

  return (
    <div style={{ flex: 1, background: NPGM.s50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {stepDots}

      <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {step === 1 && (
          <>
            <Field label={t.machineLbl}>
              <div style={{
                background: '#fff', border: `1px solid ${NPGM.s300}`, borderRadius: 6, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icons.Truck size={18} color={NPGM.blue700} />
                <div style={{ flex: 1, minWidth: 0, fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900 }}>{t.machineDefault}</div>
                <Icons.ChevronD size={16} color={NPGM.s400} />
              </div>
            </Field>
            <Field label={t.plannedFor}>
              <Input value="2026-05-22" />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Card padding={12} style={{ background: NPGM.blue50, borderColor: NPGM.blue200 }}>
              <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.blue700, lineHeight: 1.4 }}>{t.checklistHint}</div>
            </Card>
            {t.items.map((it, i) => {
              const ans = answers[i];
              const failed = ans === 'not_ok';
              return (
                <Card key={i} padding={12}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1, fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900, fontWeight: 500 }}>{i + 1}. {it.name}</div>
                    {it.critical && <Badge variant="destructive">{t.criticalBadge}</Badge>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={() => setAns(i, 'ok')} style={{
                      height: 44, borderRadius: 6,
                      background: ans === 'ok' ? NPGM.em50 : '#fff',
                      color: ans === 'ok' ? NPGM.em700 : NPGM.s700,
                      border: `1px solid ${ans === 'ok' ? NPGM.em500 : NPGM.s300}`,
                      fontFamily: NPGM.fB, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    }}>{ans === 'ok' && <Icons.Check size={16} color={NPGM.em600} />}{t.answerOk}</button>
                    <button onClick={() => setAns(i, 'not_ok')} style={{
                      height: 44, borderRadius: 6,
                      background: ans === 'not_ok' ? NPGM.red50 : '#fff',
                      color: ans === 'not_ok' ? NPGM.red700 : NPGM.s700,
                      border: `1px solid ${ans === 'not_ok' ? NPGM.red600 : NPGM.s300}`,
                      fontFamily: NPGM.fB, fontWeight: 600, fontSize: 14, cursor: 'pointer',
                    }}>{t.answerNotOk}</button>
                  </div>
                  {failed && (
                    <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea placeholder={t.problemPlaceholder} style={{
                        width: '100%', minHeight: 60, padding: 10, borderRadius: 6,
                        border: `1px solid ${NPGM.s300}`, fontFamily: NPGM.fB, fontSize: 14,
                        color: NPGM.s900, resize: 'vertical', boxSizing: 'border-box', outline: 'none',
                      }} />
                      <Button variant="outline" size="sm" icon={<Icons.Camera size={14} color={NPGM.s700} />}>{lang === 'RU' ? 'Добавить фото' : 'Attach photo'}</Button>
                    </div>
                  )}
                </Card>
              );
            })}
            {hasCriticalFail && (
              <Card padding={12} style={{ background: NPGM.red50, borderColor: NPGM.red200 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <Icons.Alert size={18} color={NPGM.red600} />
                  <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.red700, lineHeight: 1.45 }}>
                    <strong>{t.criticalWarnStrong}</strong>{t.criticalWarnRest}
                  </div>
                </div>
              </Card>
            )}
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <h4 style={{ fontFamily: NPGM.fH, fontSize: 16, fontWeight: 600, color: NPGM.s900, margin: '0 0 4px' }}>{t.planTitle}</h4>
              <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600 }}>{t.planSubtitle}</div>
            </div>
            <Field label={t.plannedTonsLbl}><Input value={planTons} onChange={setPlanTons} /></Field>
            <Field label={t.holesLbl}><Input value={holes} onChange={setHoles} /></Field>
            <Field label={t.recipeLbl}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {Object.entries(t.recipes).map(([id, label]) => {
                  const active = recipe === id;
                  return (
                    <button key={id} onClick={() => setRecipe(id)} style={{
                      height: 40, borderRadius: 6, textAlign: 'left',
                      background: active ? NPGM.blue50 : '#fff',
                      color: active ? NPGM.blue700 : NPGM.s700,
                      border: `1px solid ${active ? NPGM.blue600 : NPGM.s300}`,
                      fontFamily: NPGM.fB, fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
                      padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: '50%',
                        border: `1px solid ${active ? NPGM.blue600 : NPGM.s400}`,
                        background: active ? NPGM.blue600 : '#fff', flexShrink: 0,
                        boxShadow: active ? `inset 0 0 0 3px #fff` : null,
                      }} />
                      {label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <Field label={t.pitLbl}><Input value={pit} onChange={setPit} /></Field>
          </>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: `1px solid ${NPGM.s200}`, padding: 16, display: 'flex', gap: 8 }}>
        {step > 1 && <Button variant="outline" size="default" onClick={() => setStep(step - 1)}>{t.back}</Button>}
        <div style={{ flex: 1 }} />
        {step < 3 ? (
          <Button variant="default" size="default" onClick={() => setStep(step + 1)} disabled={step === 2 && !allAnswered}>{t.next}</Button>
        ) : (
          <Button variant={hasCriticalFail ? 'destructive' : 'default'} size="default">{t.startBtn}</Button>
        )}
      </div>
    </div>
  );
}

// ============================================================
// New ticket — priority P1-P5
// ============================================================
function NewTicketScreen({ lang }) {
  const t = lang === 'RU' ? {
    title: 'Новый тикет', sub: 'Опишите проблему. Одно фото лучше тысячи слов.',
    machineLbl: 'Машина', machineVal: 'МСЗУ-14-НПВ · Северный, блок А-2',
    titleLbl: 'Тема (необязательно)', titlePh: 'например, машина не запускается',
    titleHint: 'Если оставить пустым — возьмём первые 80 символов описания.',
    descLbl: 'Описание проблемы *', descPh: 'Что происходит? Когда началось? Что пробовали?',
    prioLbl: 'Приоритет',
    prios: [
      { id: 'P1', label: 'P1 — Критический (полная остановка)' },
      { id: 'P2', label: 'P2 — Высокий (значимые потери)' },
      { id: 'P3', label: 'P3 — Средний (стандартная заявка)' },
      { id: 'P4', label: 'P4 — Низкий (может подождать)' },
      { id: 'P5', label: 'P5 — Не срочный (общий вопрос)' },
    ],
    photoLbl: 'Фото', addPhoto: 'Добавить фото',
    submit: 'Отправить тикет', cancel: 'Отмена',
  } : {
    title: 'New ticket', sub: 'Describe the issue. A photo from your camera beats a thousand words.',
    machineLbl: 'Machine', machineVal: 'MSZU-14-NPV · Northern, block A-2',
    titleLbl: 'Subject (optional)', titlePh: "e.g. machine won't start",
    titleHint: "If left blank, we'll use the first 80 characters of the description.",
    descLbl: 'Problem description *', descPh: "What's happening? When did it start? What have you tried?",
    prioLbl: 'Priority',
    prios: [
      { id: 'P1', label: 'P1 — Critical (full stoppage)' },
      { id: 'P2', label: 'P2 — High (significant losses)' },
      { id: 'P3', label: 'P3 — Medium (standard request)' },
      { id: 'P4', label: 'P4 — Low (can wait)' },
      { id: 'P5', label: 'P5 — Non-urgent (general question)' },
    ],
    photoLbl: 'Photo', addPhoto: 'Attach photo',
    submit: 'Submit ticket', cancel: 'Cancel',
  };

  const [prio, setPrio] = React.useState('P3');

  return (
    <div style={{ flex: 1, background: NPGM.s50, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
        <div>
          <h4 style={{ fontFamily: NPGM.fH, fontSize: 16, fontWeight: 600, color: NPGM.s900, margin: 0 }}>{t.title}</h4>
          <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600, marginTop: 4, lineHeight: 1.4 }}>{t.sub}</div>
        </div>

        <Field label={t.machineLbl}>
          <Card padding={10} style={{ background: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icons.Truck size={18} color={NPGM.blue700} />
              <div style={{ flex: 1, fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900 }}>{t.machineVal}</div>
              <Icons.ChevronR size={14} color={NPGM.s400} />
            </div>
          </Card>
        </Field>

        <Field label={t.titleLbl} hint={t.titleHint}>
          <Input placeholder={t.titlePh} />
        </Field>

        <Field label={t.descLbl}>
          <textarea placeholder={t.descPh} style={{
            width: '100%', minHeight: 90, padding: 10, borderRadius: 6,
            border: `1px solid ${NPGM.s300}`, fontFamily: NPGM.fB, fontSize: 14,
            color: NPGM.s900, resize: 'vertical', boxSizing: 'border-box', outline: 'none',
            boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
          }} />
        </Field>

        <Field label={t.prioLbl}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {t.prios.map(p => {
              const active = prio === p.id;
              const isCrit = p.id === 'P1';
              const isHigh = p.id === 'P2';
              const tone = isCrit ? NPGM.red600 : isHigh ? NPGM.am600 : NPGM.blue600;
              const toneBg = isCrit ? NPGM.red50 : isHigh ? NPGM.am50 : NPGM.blue50;
              const toneText = isCrit ? NPGM.red700 : isHigh ? NPGM.am700 : NPGM.blue700;
              return (
                <button key={p.id} onClick={() => setPrio(p.id)} style={{
                  height: 44, borderRadius: 6, textAlign: 'left',
                  background: active ? toneBg : '#fff',
                  color: active ? toneText : NPGM.s700,
                  border: `1px solid ${active ? tone : NPGM.s300}`,
                  fontFamily: NPGM.fB, fontWeight: active ? 600 : 500, fontSize: 13, cursor: 'pointer',
                  padding: '0 12px', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{
                    width: 14, height: 14, borderRadius: '50%',
                    border: `1px solid ${active ? tone : NPGM.s400}`,
                    background: active ? tone : '#fff', flexShrink: 0,
                    boxShadow: active ? `inset 0 0 0 3px #fff` : null,
                  }} />
                  {p.label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={t.photoLbl}>
          <button style={{
            height: 60, borderRadius: 6, background: '#fff',
            border: `1px dashed ${NPGM.s300}`, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            color: NPGM.blue700, fontFamily: NPGM.fB, fontWeight: 500, fontSize: 13,
          }}>
            <Icons.Camera size={18} color={NPGM.blue700} />{t.addPhoto}
          </button>
        </Field>
      </div>

      <div style={{ position: 'sticky', bottom: 0, background: '#fff', borderTop: `1px solid ${NPGM.s200}`, padding: 16, display: 'flex', gap: 8 }}>
        <Button variant="outline" size="default">{t.cancel}</Button>
        <div style={{ flex: 1 }} />
        <Button variant="default" size="default">{t.submit}</Button>
      </div>
    </div>
  );
}

// ============================================================
// AI assistant — contextual per-machine drawer (matches `ai.*` strings)
// ============================================================
function AIChatScreen({ lang }) {
  const t = lang === 'RU' ? {
    title: 'Чат по МСЗУ-14-НПВ', sub: 'AI отвечает по документации этой машины',
    intro: 'Задайте вопрос — AI ответит по руководству вашей машины.',
    user: 'Артикул топливного фильтра?',
    aiHeader: 'AI thinking…',
    aiAnswer: 'Топливный фильтр для МСЗУ-14-НПВ (шасси Камаз 6520):\n• Артикул: NPGM-FLT-001-2024\n• Замена при ТО-250 или 250 моточасов\n• Совместим: NPGM-FLT-001-2022, -2023\n\nНа складе Северного: 12 шт.',
    confidence: 'Уверенность 86%',
    escalate: 'Не помогло — переслать инженеру',
    placeholder: 'Опишите проблему…', send: 'Отправить', attach: 'Фото',
    suggested: [
      'Что означает код P-0420?',
      'Регламент ТО-500 для МСЗУ',
      'Как заменить шланг ВД?',
    ],
  } : {
    title: 'Chat about MSZU-14-NPV', sub: "AI answers from this machine's manual",
    intro: "Ask a question — AI will answer based on your machine's manual.",
    user: 'Fuel filter part number?',
    aiHeader: 'AI thinking…',
    aiAnswer: 'Fuel filter for MSZU-14-NPV (Kamaz 6520 chassis):\n• P/N: NPGM-FLT-001-2024\n• Replace at TO-250 or 250 engine hours\n• Compatible: NPGM-FLT-001-2022, -2023\n\nNorthern warehouse stock: 12 units.',
    confidence: 'Confidence 86%',
    escalate: "Didn't help — forward to engineer",
    placeholder: 'Describe the issue…', send: 'Send', attach: 'Photo',
    suggested: [
      'What does code P-0420 mean?',
      'TO-500 schedule for MSZU',
      'How to replace the HP hose?',
    ],
  };

  return (
    <div style={{ flex: 1, background: NPGM.s50, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '14px 16px', background: '#fff', borderBottom: `1px solid ${NPGM.s200}`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700, display: 'grid', placeItems: 'center' }}>
          <Icons.Bot size={18} color={NPGM.blue700} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: NPGM.fH, fontSize: 15, fontWeight: 600, color: NPGM.s900 }}>{t.title}</div>
          <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s500 }}>{t.sub}</div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Intro */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: NPGM.blue600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icons.Sparkle size={14} color="#fff" />
          </div>
          <div style={{
            flex: 1, padding: '10px 12px', background: '#fff',
            border: `1px solid ${NPGM.s200}`, borderRadius: 8, borderTopLeftRadius: 2,
          }}>
            <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s700, lineHeight: 1.5 }}>{t.intro}</div>
          </div>
        </div>

        {/* User message */}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ maxWidth: '80%', padding: '10px 12px', background: NPGM.blue600, color: '#fff', borderRadius: 8, borderTopRightRadius: 2 }}>
            <div style={{ fontFamily: NPGM.fB, fontSize: 13, lineHeight: 1.5 }}>{t.user}</div>
          </div>
        </div>

        {/* AI answer */}
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: NPGM.blue600, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <Icons.Sparkle size={14} color="#fff" />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ padding: '12px 12px', background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 8, borderTopLeftRadius: 2 }}>
              <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900, lineHeight: 1.55, whiteSpace: 'pre-line' }}>{t.aiAnswer}</div>
              <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${NPGM.s200}`, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Badge variant="default" style={{ fontSize: 10 }}>{t.confidence}</Badge>
              </div>
            </div>
            <button style={{
              marginTop: 8, padding: '8px 12px', height: 36, borderRadius: 6,
              background: '#fff', border: `1px solid ${NPGM.s300}`,
              fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s700, fontWeight: 500, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}><Icons.MsgSquare size={14} color={NPGM.s600} />{t.escalate}</button>
          </div>
        </div>

        {/* Suggested follow-ups */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
          {t.suggested.map((s, i) => (
            <button key={i} style={{
              textAlign: 'left', padding: '8px 12px', background: '#fff',
              border: `1px solid ${NPGM.s300}`, borderRadius: 999,
              fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s700, cursor: 'pointer',
              alignSelf: 'flex-start',
            }}>{s}</button>
          ))}
        </div>
      </div>

      {/* Composer */}
      <div style={{
        padding: 12, background: '#fff', borderTop: `1px solid ${NPGM.s200}`,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <button style={{
          width: 40, height: 40, borderRadius: 6, background: 'transparent',
          border: `1px solid ${NPGM.s300}`, display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}><Icons.Camera size={18} color={NPGM.s600} /></button>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 40, padding: '0 12px', background: NPGM.s50, border: `1px solid ${NPGM.s200}`, borderRadius: 6 }}>
          <input placeholder={t.placeholder} style={{
            flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900,
          }} />
        </div>
        <button style={{
          width: 40, height: 40, borderRadius: 6, background: NPGM.blue600, border: 'none',
          display: 'grid', placeItems: 'center', cursor: 'pointer',
        }}><Icons.Send size={18} color="#fff" /></button>
      </div>
    </div>
  );
}

Object.assign(window, { ShiftStartScreen, NewTicketScreen, AIChatScreen });
