// Screens.jsx — manager desktop screens.
// Dashboard · Fleet · Machine detail · Garage.

const MACHINES = [
  { id: 'm1', model: 'МСЗУ-14-НПВ', type: 'МСЗУ', sn: 'MZB-2024-0142', pit: 'Северный, блок А-2', hours: 1248, tons: 14320, status: 'active', nextKind: 'ТО-1000', tonsRemaining: 380, days: 12 },
  { id: 'm2', model: 'МЗВ-20-НПН',  type: 'МЗВ',  sn: 'MZB-2023-0098', pit: 'Северный, блок Б-1', hours: 2104, tons: 19620, status: 'active', nextKind: 'ТО-500',  tonsRemaining: 920, days: 34 },
  { id: 'm3', model: 'МСЗ-10-Н',    type: 'МСЗ',  sn: 'MZB-2024-0210', pit: 'Восточный, блок В-3', hours: 540, tons: 4810,  status: 'active', nextKind: 'ТО-250',  tonsRemaining: 190, days: 7 },
  { id: 'm4', model: 'МЗУ-16-НПВ',  type: 'МЗУ',  sn: 'MZB-2022-0073', pit: 'Северный, блок А-1', hours: 4502, tons: 38100, status: 'maintenance', nextKind: 'ТО-2000', tonsRemaining: 0, days: 0 },
  { id: 'm5', model: 'МСЗУ-18-НПН', type: 'МСЗУ', sn: 'MZB-2023-0145', pit: 'Южный, блок Ю-2',    hours: 3940, tons: 28400, status: 'active', nextKind: 'ТО-1000', tonsRemaining: 1600, days: 61 },
  { id: 'm6', model: 'МЗВ-12-НПВ',  type: 'МЗВ',  sn: 'MZB-2024-0089', pit: 'Северный, блок А-2', hours: 380,  tons: 2100,  status: 'active', nextKind: 'ТО-250',  tonsRemaining: 400, days: 22 },
  { id: 'm7', model: 'БУ-50',       type: 'BR',   sn: 'BR-2022-0011',  pit: 'Восточный, блок В-1', hours: 6300, tons: null,   status: 'active', nextKind: 'ТО-2000', tonsRemaining: null, days: 3 },
  { id: 'm8', model: 'МСЗ-14-Н',    type: 'МСЗ',  sn: 'MZB-2024-0234', pit: 'Южный, блок Ю-1',    hours: 210,  tons: 1180,  status: 'active', nextKind: 'ТО-250',  tonsRemaining: 820, days: 95 },
];

const sectionTitle = (s) => ({
  fontFamily: NPGM.fH, fontSize: 18, fontWeight: 600, color: NPGM.s900, margin: 0,
});

// ============================================================
// Dashboard — mirrors /app/page.tsx
// ============================================================
function DashboardScreen({ lang }) {
  const t = lang === 'RU' ? {
    eyebrow: 'Сервис-менеджер', greeting: 'Здравствуйте, Андрей',
    sub: 'Парк, заявки операторов, тикеты, плановое ТО — по вашей компании.',
    kpis: ['Активная техника', 'ТО впереди', 'На рассмотрении', 'Открытые тикеты'],
    secActive: 'Идёт сейчас', allShifts: 'Все смены',
    secUpcoming: 'Предстоящие работы', allMachines: 'Все машины',
    inProgress: 'Смена идёт', blocked: 'Заблокирована — критический сбой',
    planSuffix: ' · план {tons} т',
    submitRequest: 'Подать заявку',
    kindThrough: 'через', tonsUnit: 'тонн',
    secQuick: 'Быстрый доступ',
    quickLinks: [
      { t: 'Парк техники',   d: 'Карточки СЗМ и буровых, пробег, история ТО', icon: 'Truck' },
      { t: 'Тикеты',         d: 'Чат оператора ↔ сервис-инженера с фото',     icon: 'MsgSquare' },
      { t: 'ТО',             d: 'Прогноз ТО по машине и заявки',              icon: 'Wrench' },
      { t: 'Гараж',          d: 'Запчасти, остатки, заявки на закупку',       icon: 'Box' },
      { t: 'Заказать запчасти', d: 'Внеплановая заявка — нужны запчасти',     icon: 'Cart' },
      { t: 'Смены и чек-листы', d: 'План зарядки, осмотр, автоучёт тоннажа',  icon: 'Clipboard' },
    ],
  } : {
    eyebrow: 'Service manager', greeting: 'Hello, Andrey',
    sub: 'Fleet, operator requests, tickets, scheduled maintenance — across your company.',
    kpis: ['Active machines', 'Maintenance ahead', 'Pending review', 'Open tickets'],
    secActive: 'In progress now', allShifts: 'All shifts',
    secUpcoming: 'Upcoming work', allMachines: 'All machines',
    inProgress: 'Shift in progress', blocked: 'Blocked — critical fail',
    planSuffix: ' · plan {tons} t',
    submitRequest: 'Submit request',
    kindThrough: 'in', tonsUnit: 'tons',
    secQuick: 'Quick access',
    quickLinks: [
      { t: 'Fleet',         d: 'MMU and drill cards, mileage, maintenance history', icon: 'Truck' },
      { t: 'Tickets',       d: 'Operator ↔ service engineer chat with photos',      icon: 'MsgSquare' },
      { t: 'Maintenance',   d: 'Per-machine forecast and service requests',         icon: 'Wrench' },
      { t: 'Garage',        d: 'Parts inventory, stock levels, purchase requests',  icon: 'Box' },
      { t: 'Order parts',   d: 'Off-schedule request — you just need parts',        icon: 'Cart' },
      { t: 'Shifts',        d: 'Loading plan, pre-shift inspection, auto tonnage', icon: 'Clipboard' },
    ],
  };

  const kpiData = [
    { lbl: t.kpis[0], val: 24, icon: Icons.Truck,     tone: 'primary' },
    { lbl: t.kpis[1], val: 11, icon: Icons.Wrench,    tone: 'warning' },
    { lbl: t.kpis[2], val: 7,  icon: Icons.Cart,      tone: 'success' },
    { lbl: t.kpis[3], val: 3,  icon: Icons.MsgSquare, tone: 'destructive' },
  ];
  const toneMap = {
    primary: { bg: NPGM.blue50, fg: NPGM.blue700 },
    success: { bg: NPGM.em50, fg: NPGM.em700 },
    warning: { bg: NPGM.am50, fg: NPGM.am700 },
    destructive: { bg: NPGM.red50, fg: NPGM.red700 },
  };

  const activeShifts = [
    { id: 's1', model: 'МСЗУ-14-НПВ', type: 'МСЗУ', status: 'in_progress', plan: 280 },
    { id: 's2', model: 'МЗВ-20-НПН',  type: 'МЗВ',  status: 'blocked',     plan: 320 },
  ];
  const upcoming = MACHINES.filter(m => m.tonsRemaining !== null && m.tonsRemaining < 1000).sort((a,b) => a.tonsRemaining - b.tonsRemaining).slice(0, 3);

  return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Hero card */}
      <MeshHero height={132}>
        <div style={{ padding: '24px 28px', position: 'relative', zIndex: 2 }}>
          <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: '#dbe9ff', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{t.eyebrow}</div>
          <div style={{ fontFamily: NPGM.fH, fontSize: 26, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '-0.01em' }}>{t.greeting}</div>
          <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: '#dbe9ff', marginTop: 4, maxWidth: 560 }}>{t.sub}</div>
        </div>
      </MeshHero>

      {/* KPI 4-up */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {kpiData.map(k => {
          const Ic = k.icon;
          const tone = toneMap[k.tone];
          return (
            <div key={k.lbl} style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: tone.bg, color: tone.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Ic size={20} color={tone.fg} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontFamily: NPGM.fB, fontSize: 11, color: NPGM.s500, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{k.lbl}</div>
                <div style={{ fontFamily: NPGM.fH, fontSize: 24, fontWeight: 700, color: NPGM.s900, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1, marginTop: 4 }}>{k.val}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active shifts */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icons.Activity size={16} color={NPGM.em600} />
            <h2 style={sectionTitle()}>{t.secActive}</h2>
          </div>
          <Button variant="outline" size="sm">{t.allShifts}<Icons.ChevronR size={14} color={NPGM.s700} /></Button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {activeShifts.map(s => {
            const blocked = s.status === 'blocked';
            return (
              <div key={s.id} style={{
                background: blocked ? '#fef2f230' : '#ecfdf530',
                border: `1px solid ${blocked ? NPGM.red200 : NPGM.em200}`,
                borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: blocked ? NPGM.red500 : NPGM.em500,
                  animation: blocked ? null : 'pulse 1.6s infinite', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900, fontWeight: 500 }}>
                    {s.model} <span style={{ fontSize: 12, color: NPGM.s500 }}>({s.type})</span>
                  </div>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600, marginTop: 2 }}>
                    {blocked ? t.blocked : t.inProgress}{t.planSuffix.replace('{tons}', s.plan)}
                  </div>
                </div>
                <Icons.ChevronR size={16} color={NPGM.s400} />
              </div>
            );
          })}
        </div>
      </section>

      {/* Upcoming maintenance */}
      <section>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={sectionTitle()}>{t.secUpcoming}</h2>
          <Button variant="outline" size="sm">{t.allMachines}<Icons.ChevronR size={14} color={NPGM.s700} /></Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {upcoming.map(m => {
            const isCritical = m.tonsRemaining === 0 || m.days <= 7;
            const isHigh = m.tonsRemaining < 500 && !isCritical;
            return (
              <div key={m.id} style={{
                background: isCritical ? '#fef2f230' : isHigh ? '#fffbeb30' : '#fff',
                border: `1px solid ${isCritical ? NPGM.red200 : isHigh ? NPGM.am200 : NPGM.s200}`,
                borderRadius: 12, padding: 16, display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  {isCritical ? <Icons.Alert size={18} color={NPGM.red600} /> : <Icons.Truck size={18} color={NPGM.blue700} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900, fontWeight: 500 }}>{m.model}</div>
                    <Badge variant="outline">{m.type}</Badge>
                  </div>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 2 }}>
                    <strong style={{ color: NPGM.s900 }}>{m.nextKind}</strong> {t.kindThrough}{' '}
                    <strong style={{ color: isCritical ? NPGM.red700 : NPGM.s900, fontVariantNumeric: 'tabular-nums' }}>
                      {m.tonsRemaining === 0 ? (lang === 'RU' ? 'сейчас' : 'now') : `${m.tonsRemaining.toLocaleString('ru-RU')} ${t.tonsUnit}`}
                    </strong>
                    {m.days > 0 && m.days < 365 && <> · ≈ {m.days} d</>}
                  </div>
                </div>
                <Button variant={isCritical ? 'default' : 'outline'} size="sm">{t.submitRequest}</Button>
              </div>
            );
          })}
        </div>
      </section>

      {/* Quick access */}
      <section>
        <h2 style={{ ...sectionTitle(), marginBottom: 12 }}>{t.secQuick}</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {t.quickLinks.map(q => {
            const Ic = Icons[q.icon];
            return (
              <button key={q.t} style={{
                background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 16,
                display: 'flex', gap: 16, alignItems: 'flex-start', cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Ic size={20} color={NPGM.blue700} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900, fontWeight: 500 }}>{q.t}</div>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 2, lineHeight: 1.4 }}>{q.d}</div>
                </div>
                <Icons.ChevronR size={16} color={NPGM.s300} />
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ============================================================
// Fleet — machines list
// ============================================================
function FleetScreen({ lang, onOpen }) {
  const t = lang === 'RU' ? {
    title: 'Парк техники', sub: 'Карточки СЗМ и буровых с двойным пробегом (моточасы + прокачанные тонны)',
    addMachine: 'Добавить машину', searchPh: 'Поиск по модели, серийнику, карьеру…',
    cols: { model: 'Модель', type: 'Тип', sn: 'Серийник', pit: 'Карьер', hours: 'Моточасы', tons: 'Тонны', status: 'Статус' },
    statusActive: 'В работе', statusMaint: 'На ТО', statusOff: 'Выведена',
    hUnit: 'ч', tUnit: 'т',
  } : {
    title: 'Fleet', sub: 'MMU and drilling rig cards with dual mileage (engine hours + pumped tons)',
    addMachine: 'Add machine', searchPh: 'Search by model, serial, pit…',
    cols: { model: 'Model', type: 'Type', sn: 'Serial', pit: 'Pit', hours: 'Engine hours', tons: 'Tons', status: 'Status' },
    statusActive: 'Active', statusMaint: 'In maintenance', statusOff: 'Decommissioned',
    hUnit: 'h', tUnit: 't',
  };

  const statusBadge = (s) => {
    if (s === 'active') return <Badge variant="success">{t.statusActive}</Badge>;
    if (s === 'maintenance') return <Badge variant="warning">{t.statusMaint}</Badge>;
    return <Badge variant="secondary">{t.statusOff}</Badge>;
  };

  const thStyle = { textAlign: 'left', padding: '10px 16px', fontFamily: NPGM.fB, fontSize: 11, fontWeight: 600, color: NPGM.s500, letterSpacing: '0.04em', textTransform: 'uppercase', borderBottom: `1px solid ${NPGM.s200}`, background: NPGM.s50, whiteSpace: 'nowrap' };
  const tdStyle = { padding: '12px 16px', fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s700, borderBottom: `1px solid ${NPGM.s100}` };

  return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: NPGM.fH, fontSize: 24, fontWeight: 700, margin: 0, color: NPGM.s900, letterSpacing: '-0.01em' }}>{t.title}</h1>
          <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 4 }}>{t.sub}</div>
        </div>
        <Button variant="default" icon={<Icons.Plus size={14} color="#fff" />}>{t.addMachine}</Button>
      </div>

      {/* Search */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 6, maxWidth: 420 }}>
        <Icons.Search size={16} color={NPGM.s400} />
        <input placeholder={t.searchPh} style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none', fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900 }} />
      </div>

      <div style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: NPGM.fB, fontSize: 13 }}>
          <thead>
            <tr>
              <th style={thStyle}>{t.cols.model}</th>
              <th style={thStyle}>{t.cols.type}</th>
              <th style={thStyle}>{t.cols.sn}</th>
              <th style={thStyle}>{t.cols.pit}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{t.cols.hours}</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>{t.cols.tons}</th>
              <th style={thStyle}>{t.cols.status}</th>
            </tr>
          </thead>
          <tbody>
            {MACHINES.map(m => (
              <tr key={m.id} onClick={() => onOpen(m.id)} style={{ cursor: 'pointer' }}>
                <td style={{ ...tdStyle, color: NPGM.s900, fontWeight: 500 }}>{m.model}</td>
                <td style={tdStyle}><Badge variant="default">{m.type}</Badge></td>
                <td style={{ ...tdStyle, fontFamily: NPGM.fM, fontSize: 12, color: NPGM.s600 }}>{m.sn}</td>
                <td style={tdStyle}>{m.pit}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: NPGM.fM, color: NPGM.s900, fontVariantNumeric: 'tabular-nums' }}>{m.hours.toLocaleString('ru-RU')} {t.hUnit}</td>
                <td style={{ ...tdStyle, textAlign: 'right', fontFamily: NPGM.fM, color: NPGM.s900, fontVariantNumeric: 'tabular-nums' }}>{m.tons === null ? '—' : `${m.tons.toLocaleString('ru-RU')} ${t.tUnit}`}</td>
                <td style={tdStyle}>{statusBadge(m.status)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Machine detail — passport + dual mileage + maintenance forecast
// ============================================================
function MachineScreen({ lang, machineId, onBack }) {
  const m = MACHINES.find(x => x.id === machineId) || MACHINES[0];
  const t = lang === 'RU' ? {
    back: 'Парк техники',
    typeLabel: 'Тип', model: 'Модель', sn: 'Серийник', pit: 'Карьер', tonnage: 'Тоннаж',
    auger: 'Шнек', augerVal: 'Верхний (ВП)', ggd: 'Газгенератор', ggdVal: 'СН (нитрит натрия)',
    inSvc: 'В работе с',
    statHours: 'Моточасы (двигатель, гидравлика)',
    statTons: 'Прокачано тонн (насосы, шланги, насадки)',
    passportTitle: 'Паспорт машины', passportDesc: 'Технические характеристики и место работы',
    nextTitle: 'Ближайшее ТО', nextThrough: 'через', tonsUnit: 'тонн', approx: 'Приблизительно', days: 'дн.',
    currentOutput: 'Текущая наработка: {tons} тонн · регламент — каждые 2000 прокачанных тонн',
    submitRequest: 'Подать заявку',
    historyTitle: 'История технических обслуживаний',
    history: [
      { date: '2026-03-12', kind: 'ТО-1000', by: 'НИПИГОРМАШ', parts: '4 поз.', cost: '₽142 000', notes: 'Топливный фильтр, шланг ВД, гидротест' },
      { date: '2025-12-08', kind: 'ТО-500',  by: 'Внутренний', parts: '2 поз.', cost: '₽38 200',  notes: 'Замена масла, фильтр' },
      { date: '2025-09-04', kind: 'ТО-250',  by: 'Внутренний', parts: '1 поз.', cost: '₽9 800',   notes: 'Замена топливного фильтра' },
    ],
    historyCols: ['Дата', 'Тип', 'Кем', 'Запчасти', 'Стоимость', 'Заметки'],
  } : {
    back: 'Fleet',
    typeLabel: 'Type', model: 'Model', sn: 'Serial', pit: 'Pit', tonnage: 'Tonnage',
    auger: 'Auger', augerVal: 'Upper (UP)', ggd: 'GGD', ggdVal: 'SN (sodium nitrite)',
    inSvc: 'In service since',
    statHours: 'Engine hours (engine, hydraulics)',
    statTons: 'Pumped tons (pumps, hoses, nozzles)',
    passportTitle: 'Machine passport', passportDesc: 'Technical specifications and work location',
    nextTitle: 'Next maintenance', nextThrough: 'in', tonsUnit: 'tons', approx: 'Approx.', days: 'd',
    currentOutput: 'Current output: {tons} tons · schedule — every 2000 pumped tons',
    submitRequest: 'Submit request',
    historyTitle: 'Service history',
    history: [
      { date: '2026-03-12', kind: 'TO-1000', by: 'NIPIGORMASH', parts: '4 items', cost: '₽142 000', notes: 'Fuel filter, HP hose, hydro test' },
      { date: '2025-12-08', kind: 'TO-500',  by: 'In-house',    parts: '2 items', cost: '₽38 200',  notes: 'Oil & filter change' },
      { date: '2025-09-04', kind: 'TO-250',  by: 'In-house',    parts: '1 item',  cost: '₽9 800',   notes: 'Fuel filter' },
    ],
    historyCols: ['Date', 'Kind', 'By', 'Parts', 'Cost', 'Notes'],
  };

  const statBox = (title, value, sub) => (
    <div style={{ flex: 1, padding: 16, background: NPGM.s50, borderRadius: 8 }}>
      <div style={{ fontFamily: NPGM.fB, fontSize: 11, color: NPGM.s500, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{title}</div>
      <div style={{ fontFamily: NPGM.fH, fontSize: 24, fontWeight: 700, color: NPGM.s900, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
      {sub && <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s500, marginTop: 2 }}>{sub}</div>}
    </div>
  );

  const rowStyle = { display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: `1px solid ${NPGM.s100}`, fontFamily: NPGM.fB, fontSize: 13 };

  return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <button onClick={onBack} style={{ background: 'transparent', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, color: NPGM.s600, fontFamily: NPGM.fB, fontSize: 13, cursor: 'pointer', padding: 0, alignSelf: 'flex-start' }}>
        <Icons.ArrowLeft size={16} color={NPGM.s600} /> {t.back}
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h1 style={{ fontFamily: NPGM.fH, fontSize: 28, fontWeight: 700, margin: 0, color: NPGM.s900, letterSpacing: '-0.01em' }}>{m.model}</h1>
            <Badge variant="default" style={{ fontSize: 14, padding: '4px 12px', fontWeight: 600 }}>{m.type}</Badge>
            {m.status === 'active' ? <Badge variant="success">{lang === 'RU' ? 'В работе' : 'Active'}</Badge> : <Badge variant="warning">{lang === 'RU' ? 'На ТО' : 'In maintenance'}</Badge>}
          </div>
          <div style={{ fontFamily: NPGM.fM, fontSize: 13, color: NPGM.s500, marginTop: 4 }}>SN {m.sn} · {m.pit}</div>
        </div>
        <Button variant="default" icon={<Icons.Wrench size={14} color="#fff" />}>{t.submitRequest}</Button>
      </div>

      {/* Dual mileage */}
      <div style={{ display: 'flex', gap: 12 }}>
        {statBox(t.statHours, `${m.hours.toLocaleString('ru-RU')} ${lang === 'RU' ? 'ч' : 'h'}`, null)}
        {statBox(t.statTons, m.tons === null ? '—' : `${m.tons.toLocaleString('ru-RU')} ${lang === 'RU' ? 'т' : 't'}`, null)}
      </div>

      {/* Two columns: passport · next service */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 20 }}>
          <h3 style={{ ...sectionTitle(), fontSize: 16, marginBottom: 4 }}>{t.passportTitle}</h3>
          <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s500, marginBottom: 12 }}>{t.passportDesc}</div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.typeLabel}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>{m.type}</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.model}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>{m.model}</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.tonnage}</span><span style={{ color: NPGM.s900, fontWeight: 500, fontFamily: NPGM.fM, fontVariantNumeric: 'tabular-nums' }}>14 т</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.sn}</span><span style={{ color: NPGM.s900, fontWeight: 500, fontFamily: NPGM.fM }}>{m.sn}</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.inSvc}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>2024-08-12</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.pit}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>{m.pit}</span></div>
            <div style={rowStyle}><span style={{ color: NPGM.s500 }}>{t.auger}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>{t.augerVal}</span></div>
            <div style={{ ...rowStyle, borderBottom: 'none' }}><span style={{ color: NPGM.s500 }}>{t.ggd}</span><span style={{ color: NPGM.s900, fontWeight: 500 }}>{t.ggdVal}</span></div>
          </div>
        </div>

        <div style={{ background: '#fff', border: `1px solid ${m.tonsRemaining !== null && m.tonsRemaining < 500 ? NPGM.am200 : NPGM.s200}`, borderRadius: 12, padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h3 style={{ ...sectionTitle(), fontSize: 16 }}>{t.nextTitle}</h3>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <Badge variant="default" style={{ fontSize: 14, padding: '4px 12px', fontWeight: 600 }}>{m.nextKind}</Badge>
            <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s600 }}>{t.nextThrough}</div>
            <div style={{ fontFamily: NPGM.fH, fontSize: 28, fontWeight: 700, color: m.tonsRemaining < 500 ? NPGM.am700 : NPGM.s900, fontVariantNumeric: 'tabular-nums' }}>
              {m.tonsRemaining === null ? '—' : `${m.tonsRemaining.toLocaleString('ru-RU')} ${t.tonsUnit}`}
            </div>
          </div>
          {m.days > 0 && m.days < 365 && (
            <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s500 }}>{t.approx} {m.days} {t.days}</div>
          )}
          {m.tons !== null && (
            <div style={{ padding: 12, background: NPGM.s50, borderRadius: 6, fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600 }}>
              {t.currentOutput.replace('{tons}', m.tons.toLocaleString('ru-RU'))}
            </div>
          )}
          <Button variant="default" size="default" icon={<Icons.Wrench size={14} color="#fff" />}>{t.submitRequest}</Button>
        </div>
      </div>

      {/* Service history */}
      <div style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: `1px solid ${NPGM.s200}` }}>
          <h3 style={{ ...sectionTitle(), fontSize: 16 }}>{t.historyTitle}</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: NPGM.fB, fontSize: 13 }}>
          <thead>
            <tr>
              {t.historyCols.map((c, i) => (
                <th key={i} style={{ textAlign: i >= 4 ? 'left' : 'left', padding: '10px 20px', fontFamily: NPGM.fB, fontSize: 11, fontWeight: 600, color: NPGM.s500, letterSpacing: '0.04em', textTransform: 'uppercase', background: NPGM.s50, borderBottom: `1px solid ${NPGM.s200}` }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {t.history.map((h, i) => (
              <tr key={i} style={{ borderBottom: i < t.history.length - 1 ? `1px solid ${NPGM.s100}` : 'none' }}>
                <td style={{ padding: '12px 20px', fontFamily: NPGM.fM, color: NPGM.s900 }}>{h.date}</td>
                <td style={{ padding: '12px 20px' }}><Badge variant={h.kind.includes('1000') || h.kind.includes('2000') ? 'default' : 'secondary'}>{h.kind}</Badge></td>
                <td style={{ padding: '12px 20px', color: NPGM.s700 }}>{h.by}</td>
                <td style={{ padding: '12px 20px', color: NPGM.s600, fontFamily: NPGM.fM }}>{h.parts}</td>
                <td style={{ padding: '12px 20px', color: NPGM.s900, fontFamily: NPGM.fM, fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>{h.cost}</td>
                <td style={{ padding: '12px 20px', color: NPGM.s600 }}>{h.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// Garage — parts pipeline
// ============================================================
function GarageScreen({ lang }) {
  const t = lang === 'RU' ? {
    title: 'Гараж', sub: 'Входящие от операторов, ваши консолидированные заявки и склад компании.',
    createConsolidated: 'Создать консолидированную', addStock: 'Пополнить склад',
    secIncoming: 'Входящие от операторов', incomingDesc: 'Объедините несколько заявок в одну консолидированную — нажмите «Создать консолидированную».',
    secMyActive: 'Мои консолидированные', myActiveDesc: 'В пути к НПГМ или от НПГМ.',
    secStock: 'Склад',
    urgency: { normal: 'Норм.', urgent: 'Срочно', critical: 'Критично' },
    itemsCount: 'позиций',
    cols: { part: 'Запчасть', cat: 'Категория', use: 'Применение', qty: 'На складе', actions: '' },
    parts: [
      { sku: 'NPGM-FLT-001-2024', name: 'Топливный фильтр',          cat: 'Фильтры',     use: 'МСЗУ, МЗВ', qty: 12, status: 'ok' },
      { sku: 'NPGM-HSE-014-2023', name: 'Шланг ВД эмульсии 20 м',    cat: 'Шланги',     use: 'МСЗУ-14',   qty: 2,  status: 'low' },
      { sku: 'NPGM-PMP-009-2024', name: 'Насос ВД дозатор',          cat: 'Насосы',     use: 'Все СЗМ',   qty: 0,  status: 'zero' },
      { sku: 'NPGM-OIL-002-2023', name: 'Масло гидравлическое 20 л', cat: 'ГСМ',        use: 'Все буровые', qty: 28, status: 'ok' },
    ],
    statusOk: 'OK', statusLow: 'Мало', statusZero: 'Закончилось',
  } : {
    title: 'Garage', sub: "Incoming operator requests, your consolidated requests, and company stock.",
    createConsolidated: 'Create consolidated', addStock: 'Add to stock',
    secIncoming: 'Incoming from operators', incomingDesc: "Merge multiple requests into one consolidated — click 'Create consolidated'.",
    secMyActive: 'My consolidated in progress', myActiveDesc: 'In flight to or from NPGM.',
    secStock: 'Stock',
    urgency: { normal: 'Normal', urgent: 'Urgent', critical: 'Critical' },
    itemsCount: 'items',
    cols: { part: 'Part', cat: 'Category', use: 'Application', qty: 'In stock', actions: '' },
    parts: [
      { sku: 'NPGM-FLT-001-2024', name: 'Fuel filter',           cat: 'Filters', use: 'MSZU, MZB', qty: 12, status: 'ok' },
      { sku: 'NPGM-HSE-014-2023', name: 'HP emulsion hose 20 m', cat: 'Hoses',  use: 'MSZU-14',   qty: 2,  status: 'low' },
      { sku: 'NPGM-PMP-009-2024', name: 'HP metering pump',      cat: 'Pumps',  use: 'All MMU',   qty: 0,  status: 'zero' },
      { sku: 'NPGM-OIL-002-2023', name: 'Hydraulic oil 20 L',    cat: 'Fluids', use: 'All drills', qty: 28, status: 'ok' },
    ],
    statusOk: 'OK', statusLow: 'Low', statusZero: 'Out',
  };

  const incoming = [
    { id: 'r-411', machine: 'МСЗУ-14-НПВ',  by: 'И. Соколов', urgency: 'critical', items: 2, when: lang === 'RU' ? '2 ч назад'  : '2 h ago' },
    { id: 'r-410', machine: 'МЗВ-20-НПН',   by: 'А. Петров',  urgency: 'urgent',   items: 3, when: lang === 'RU' ? '5 ч назад'  : '5 h ago' },
    { id: 'r-408', machine: 'МСЗ-10-Н',     by: 'В. Никитин', urgency: 'normal',   items: 1, when: lang === 'RU' ? 'вчера'      : 'yesterday' },
  ];
  const myActive = [
    { id: 'c-148', items: 12, urgency: 'urgent',   stage: lang === 'RU' ? 'Согласована — отправлена в НПГМ' : 'Approved — sent to NPGM', when: lang === 'RU' ? '2 дн.' : '2 d' },
    { id: 'c-146', items: 8,  urgency: 'normal',   stage: lang === 'RU' ? 'Получена смета — на согласовании ПМ' : 'Quoted — pending PM approval', when: lang === 'RU' ? '4 дн.' : '4 d' },
  ];

  const urgencyTone = { critical: 'destructive', urgent: 'warning', normal: 'default' };
  const stockTone = { ok: 'success', low: 'warning', zero: 'destructive' };
  const stockLabel = { ok: t.statusOk, low: t.statusLow, zero: t.statusZero };

  return (
    <div style={{ padding: 24, maxWidth: 1152, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: NPGM.fH, fontSize: 24, fontWeight: 700, margin: 0, color: NPGM.s900, letterSpacing: '-0.01em' }}>{t.title}</h1>
          <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 4 }}>{t.sub}</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" icon={<Icons.Plus size={14} color={NPGM.s700} />}>{t.addStock}</Button>
          <Button variant="default" icon={<Icons.Box size={14} color="#fff" />}>{t.createConsolidated}</Button>
        </div>
      </div>

      {/* Incoming */}
      <section>
        <div style={{ marginBottom: 4 }}>
          <h2 style={sectionTitle()}>{t.secIncoming} <span style={{ fontWeight: 500, color: NPGM.s500 }}>({incoming.length})</span></h2>
          <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 4 }}>{t.incomingDesc}</div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {incoming.map(r => (
            <div key={r.id} style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icons.Cart size={18} color={NPGM.blue700} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: NPGM.fM, fontSize: 13, color: NPGM.s900, fontWeight: 500 }}>{r.id}</span>
                  <Badge variant={urgencyTone[r.urgency]}>{t.urgency[r.urgency]}</Badge>
                  <span style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s700 }}>{r.machine} · {r.items} {t.itemsCount}</span>
                </div>
                <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s500, marginTop: 2 }}>{r.by} · {r.when}</div>
              </div>
              <Button variant="outline" size="sm">{lang === 'RU' ? 'Открыть' : 'Open'}</Button>
            </div>
          ))}
        </div>
      </section>

      {/* My active consolidated */}
      <section>
        <div style={{ marginBottom: 4 }}>
          <h2 style={sectionTitle()}>{t.secMyActive} <span style={{ fontWeight: 500, color: NPGM.s500 }}>({myActive.length})</span></h2>
          <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600, marginTop: 4 }}>{t.myActiveDesc}</div>
        </div>
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {myActive.map(c => (
            <div key={c.id} style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Icons.Box size={18} color={NPGM.blue700} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: NPGM.fM, fontSize: 13, color: NPGM.s900, fontWeight: 500 }}>{c.id}</span>
                  <Badge variant={urgencyTone[c.urgency]}>{t.urgency[c.urgency]}</Badge>
                  <span style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s700 }}>{c.items} {t.itemsCount}</span>
                </div>
                <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s500, marginTop: 2 }}>{c.stage} · {c.when}</div>
              </div>
              <Button variant="outline" size="sm">{lang === 'RU' ? 'Открыть' : 'Open'}</Button>
            </div>
          ))}
        </div>
      </section>

      {/* Stock */}
      <section>
        <h2 style={sectionTitle()}>{t.secStock}</h2>
        <div style={{ marginTop: 12, background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: NPGM.fB, fontSize: 13 }}>
            <thead>
              <tr>
                {['SKU', t.cols.part, t.cols.cat, t.cols.use, t.cols.qty, ''].map((c, i) => (
                  <th key={i} style={{ textAlign: i === 4 ? 'right' : 'left', padding: '10px 16px', fontFamily: NPGM.fB, fontSize: 11, fontWeight: 600, color: NPGM.s500, letterSpacing: '0.04em', textTransform: 'uppercase', background: NPGM.s50, borderBottom: `1px solid ${NPGM.s200}` }}>{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {t.parts.map(p => (
                <tr key={p.sku} style={{ borderBottom: `1px solid ${NPGM.s100}` }}>
                  <td style={{ padding: '12px 16px', fontFamily: NPGM.fM, fontSize: 12, color: NPGM.s700 }}>{p.sku}</td>
                  <td style={{ padding: '12px 16px', color: NPGM.s900, fontWeight: 500 }}>{p.name}</td>
                  <td style={{ padding: '12px 16px', color: NPGM.s600 }}>{p.cat}</td>
                  <td style={{ padding: '12px 16px', color: NPGM.s600 }}>{p.use}</td>
                  <td style={{ padding: '12px 16px', textAlign: 'right', fontFamily: NPGM.fM, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: p.status === 'zero' ? NPGM.red700 : p.status === 'low' ? NPGM.am700 : NPGM.s900 }}>{p.qty}</td>
                  <td style={{ padding: '12px 16px' }}><Badge variant={stockTone[p.status]}>{stockLabel[p.status]}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

Object.assign(window, { DashboardScreen, FleetScreen, MachineScreen, GarageScreen });
