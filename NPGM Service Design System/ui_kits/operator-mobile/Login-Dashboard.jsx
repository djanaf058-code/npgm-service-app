// Screens.jsx — consolidated operator-mobile screens.
// Login · Dashboard · Shift start wizard · New ticket · AI assistant.

// ============================================================
// Login
// ============================================================
function LoginScreen({ lang, setLang, onLogin }) {
  const t = lang === 'RU' ? {
    title: 'Вход в аккаунт',
    sub: 'Введите email и пароль',
    email: 'Email', password: 'Пароль', forgot: 'Забыли пароль?',
    submit: 'Войти', noAcc: 'Нет аккаунта? ', register: 'Зарегистрироваться',
    panelTitle: 'Один контур для всего парка техники',
    panelDesc: 'От ежедневного чек-листа оператора до годового бюджета на запчасти. Разрабатывается в партнёрстве с НИПИГОРМАШем.',
  } : {
    title: 'Sign in',
    sub: 'Enter your email and password',
    email: 'Email', password: 'Password', forgot: 'Forgot password?',
    submit: 'Sign in', noAcc: 'No account? ', register: 'Register',
    panelTitle: 'One platform for your entire fleet',
    panelDesc: "From operator daily checklists to yearly parts budget. Built in partnership with NIPIGORMASH.",
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#fff', overflowY: 'auto' }}>
      {/* Mesh-gradient brand panel (top of phone) */}
      <MeshHero height={220}>
        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 2 }}>
          <LocaleSwitcher lang={lang} setLang={setLang} onDark />
        </div>
        <div style={{ position: 'absolute', left: 22, right: 22, bottom: 20, color: '#fff', zIndex: 2 }}>
          <img src={NPGM_LOGO_FULL} alt="NPGM" style={{ height: 32, filter: 'brightness(0) invert(1)' }} />
          <div style={{ fontFamily: NPGM.fH, fontWeight: 600, fontSize: 18, marginTop: 12, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{t.panelTitle}</div>
          <div style={{ fontFamily: NPGM.fB, fontSize: 12, marginTop: 6, color: '#dbe9ff', lineHeight: 1.5 }}>{t.panelDesc}</div>
        </div>
      </MeshHero>

      <div style={{ padding: '24px 22px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontFamily: NPGM.fH, fontSize: 22, fontWeight: 600, color: NPGM.s900, margin: 0 }}>{t.title}</h2>
          <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s500, marginTop: 4 }}>{t.sub}</div>
        </div>

        <Field label={t.email} htmlFor="email">
          <Input id="email" type="email" value="operator@npgm.ru" />
        </Field>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 }}>
            <label htmlFor="pw" style={{ fontFamily: NPGM.fB, fontSize: 14, fontWeight: 500, color: NPGM.s700 }}>{t.password}</label>
            <a href="#" style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.blue600, fontWeight: 500 }}>{t.forgot}</a>
          </div>
          <Input id="pw" type="password" value="••••••••" />
        </div>

        <Button variant="default" size="lg" full onClick={onLogin}>{t.submit}</Button>

        <div style={{ textAlign: 'center', fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s600 }}>
          {t.noAcc}<a href="#" style={{ color: NPGM.blue600, fontWeight: 500 }}>{t.register}</a>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Dashboard (Home) — matches /app dashboard pattern
// ============================================================
function DashboardScreen({ lang, onOpenShift, onOpenTicket }) {
  const t = lang === 'RU' ? {
    eyebrow: 'Оператор СЗМ',
    greeting: 'Здравствуйте, Иван',
    sub: 'Ваши смены, чек-листы, тикеты по технике.',
    kpiActive: 'Активная техника', kpiTO: 'ТО впереди', kpiParts: 'Заявки на запчасти', kpiTickets: 'Открытые тикеты',
    secActive: 'Идёт сейчас', secActiveLink: 'Все смены',
    secUpcoming: 'Предстоящие работы', secUpcomingLink: 'Все машины',
    inProgress: 'Смена идёт', blocked: 'Заблокирована — критический сбой',
    submitRequest: 'Подать заявку', kindThrough: 'через', tonsUnit: 'тонн', daysApprox: '≈ {d} d',
    secQuick: 'Быстрый доступ',
    quickShifts: 'Начать смену', quickShiftsDesc: 'Чек-лист и план зарядки',
    quickTicket: 'Новый тикет', quickTicketDesc: 'Фото + описание для сервис-инженера',
    quickAI: 'AI-помощник', quickAIDesc: 'Артикулы, регламент, неисправности',
    quickGarage: 'Гараж', quickGarageDesc: 'Запчасти и заявки',
    planSuffix: ' · план {tons} т',
  } : {
    eyebrow: 'MMU operator',
    greeting: 'Hello, Ivan',
    sub: 'Your shifts, checklists, machine tickets.',
    kpiActive: 'Active machines', kpiTO: 'Maintenance ahead', kpiParts: 'Parts requests', kpiTickets: 'Open tickets',
    secActive: 'In progress now', secActiveLink: 'All shifts',
    secUpcoming: 'Upcoming work', secUpcomingLink: 'All machines',
    inProgress: 'Shift in progress', blocked: 'Blocked — critical fail',
    submitRequest: 'Submit request', kindThrough: 'in', tonsUnit: 'tons', daysApprox: '≈ {d} d',
    secQuick: 'Quick access',
    quickShifts: 'Start shift', quickShiftsDesc: 'Checklist and charging plan',
    quickTicket: 'New ticket', quickTicketDesc: 'Photo + description to the service engineer',
    quickAI: 'AI assistant', quickAIDesc: 'Parts, schedule, troubleshooting',
    quickGarage: 'Garage', quickGarageDesc: 'Parts inventory and requests',
    planSuffix: ' · plan {tons} t',
  };

  const eb = { fontFamily: NPGM.fB, fontSize: 11, color: NPGM.s500, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' };
  const ebLight = { fontFamily: NPGM.fB, fontSize: 11, color: '#dbe9ff', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase' };

  const activeShifts = [
    { id: 'sh-4012', machine: 'МСЗУ-14-НПВ', type: 'МСЗУ', status: 'in_progress', plan: 280 },
    { id: 'sh-4011', machine: 'МЗВ-20-НПН',  type: 'МЗВ',  status: 'blocked',     plan: 320 },
  ];
  const upcoming = [
    { name: 'МСЗУ-14-НПВ', type: 'МСЗУ', kind: 'ТО-1000', tons: 380, days: 12, urgency: 'high' },
    { name: 'МЗВ-20-НПН',  type: 'МЗВ',  kind: 'ТО-500',  tons: 920, days: 34, urgency: 'medium' },
    { name: 'БУ-50',       type: 'BR',   kind: 'ТО-250',  tons: 0,   days: 0,  urgency: 'critical' },
  ];

  return (
    <div style={{ flex: 1, background: NPGM.s50, overflowY: 'auto' }}>
      {/* Hero card (mesh gradient ≈ landing/dashboard) */}
      <div style={{ padding: 16 }}>
        <MeshHero height={140}>
          <div style={{ padding: 20, position: 'relative', zIndex: 2 }}>
            <div style={ebLight}>{t.eyebrow}</div>
            <div style={{ fontFamily: NPGM.fH, fontSize: 22, fontWeight: 700, color: '#fff', marginTop: 4, letterSpacing: '-0.01em' }}>{t.greeting}</div>
            <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: '#dbe9ff', marginTop: 6, lineHeight: 1.5, maxWidth: 320 }}>{t.sub}</div>
          </div>
        </MeshHero>
      </div>

      {/* KPI 2x2 */}
      <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {[
          { lbl: t.kpiActive,  val: 24, icon: Icons.Truck,      tone: 'default' },
          { lbl: t.kpiTO,      val: 11, icon: Icons.Wrench,     tone: 'warning' },
          { lbl: t.kpiParts,   val: 7,  icon: Icons.Cart,       tone: 'success' },
          { lbl: t.kpiTickets, val: 3,  icon: Icons.MsgSquare,  tone: 'destructive' },
        ].map(k => {
          const Ic = k.icon;
          const ic = {
            default:     { bg: NPGM.blue50, fg: NPGM.blue700 },
            warning:     { bg: NPGM.am50,   fg: NPGM.am700 },
            success:     { bg: NPGM.em50,   fg: NPGM.em700 },
            destructive: { bg: NPGM.red50,  fg: NPGM.red700 },
          }[k.tone];
          return (
            <div key={k.lbl} style={{ background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: ic.bg, color: ic.fg, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Ic size={18} color={ic.fg} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: NPGM.fB, fontSize: 10, color: NPGM.s500, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{k.lbl}</div>
                <div style={{ fontFamily: NPGM.fH, fontSize: 22, fontWeight: 700, color: NPGM.s900, lineHeight: 1.05, fontVariantNumeric: 'tabular-nums' }}>{k.val}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Active shifts */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icons.Activity size={16} color={NPGM.em600} />
            <h3 style={{ fontFamily: NPGM.fH, fontSize: 15, fontWeight: 600, color: NPGM.s900, margin: 0 }}>{t.secActive}</h3>
          </div>
          <Button variant="outline" size="sm">{t.secActiveLink}<Icons.ChevronR size={14} color={NPGM.s700} /></Button>
        </div>
        {activeShifts.map(s => {
          const isBlocked = s.status === 'blocked';
          return (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12,
              background: isBlocked ? '#fef2f240' : '#ecfdf540',
              border: `1px solid ${isBlocked ? NPGM.red200 : NPGM.em200}`,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: isBlocked ? NPGM.red600 : NPGM.em500,
                animation: isBlocked ? null : 'pulse 1.6s infinite',
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: NPGM.fB, fontSize: 14, color: NPGM.s900, fontWeight: 500 }}>
                  {s.machine} <span style={{ fontSize: 12, color: NPGM.s500 }}>({s.type})</span>
                </div>
                <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600 }}>
                  {isBlocked ? t.blocked : t.inProgress}{t.planSuffix.replace('{tons}', s.plan)}
                </div>
              </div>
              <Icons.ChevronR size={16} color={NPGM.s400} />
            </div>
          );
        })}
      </div>

      {/* Upcoming maintenance */}
      <div style={{ padding: '20px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontFamily: NPGM.fH, fontSize: 15, fontWeight: 600, color: NPGM.s900, margin: 0 }}>{t.secUpcoming}</h3>
          <Button variant="outline" size="sm">{t.secUpcomingLink}<Icons.ChevronR size={14} color={NPGM.s700} /></Button>
        </div>
        {upcoming.map(u => {
          const isCritical = u.urgency === 'critical';
          const isHigh = u.urgency === 'high';
          const cardBg = isCritical ? '#fef2f230' : isHigh ? '#fffbeb30' : '#fff';
          const cardBorder = isCritical ? NPGM.red200 : isHigh ? NPGM.am200 : NPGM.s200;
          return (
            <div key={u.name} style={{
              background: cardBg, border: `1px solid ${cardBorder}`, borderRadius: 12, padding: 14,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8, background: NPGM.blue50, color: NPGM.blue700,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>
                {isCritical ? <Icons.Alert size={18} color={NPGM.red600} /> : <Icons.Truck size={18} color={NPGM.blue700} />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ fontFamily: NPGM.fB, fontSize: 14, fontWeight: 500, color: NPGM.s900 }}>{u.name}</div>
                  <Badge variant="outline" style={{ fontSize: 10 }}>{u.type}</Badge>
                </div>
                <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600, marginTop: 2 }}>
                  <strong style={{ color: NPGM.s900 }}>{u.kind}</strong> {t.kindThrough}{' '}
                  {isCritical ? (
                    <strong style={{ color: NPGM.red700, fontVariantNumeric: 'tabular-nums' }}>{lang === 'RU' ? 'сейчас' : 'now'}</strong>
                  ) : (
                    <strong style={{ color: NPGM.s900, fontVariantNumeric: 'tabular-nums' }}>{u.tons.toLocaleString('ru-RU')} {t.tonsUnit}</strong>
                  )}
                  {u.days > 0 && u.days < 365 && <> · {t.daysApprox.replace('{d}', u.days)}</>}
                </div>
              </div>
              <Button variant={isCritical ? 'default' : 'outline'} size="sm">{t.submitRequest}</Button>
            </div>
          );
        })}
      </div>

      {/* Quick access */}
      <div style={{ padding: '20px 16px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <h3 style={{ fontFamily: NPGM.fH, fontSize: 15, fontWeight: 600, color: NPGM.s900, margin: 0 }}>{t.secQuick}</h3>
        {[
          { icon: Icons.Clipboard, title: t.quickShifts,  desc: t.quickShiftsDesc, onClick: () => onOpenShift() },
          { icon: Icons.MsgSquare, title: t.quickTicket,  desc: t.quickTicketDesc, onClick: () => onOpenTicket() },
        ].map(q => {
          const Ic = q.icon;
          return (
            <button key={q.title} onClick={q.onClick} style={{
              background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12, padding: 14,
              display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', textAlign: 'left',
              width: '100%',
            }}>
              <div style={{ width: 40, height: 40, borderRadius: 8, background: NPGM.blue50, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                <Ic size={20} color={NPGM.blue700} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: NPGM.fB, fontSize: 14, fontWeight: 500, color: NPGM.s900 }}>{q.title}</div>
                <div style={{ fontFamily: NPGM.fB, fontSize: 12, color: NPGM.s600, marginTop: 2, lineHeight: 1.4 }}>{q.desc}</div>
              </div>
              <Icons.ChevronR size={16} color={NPGM.s400} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

Object.assign(window, { LoginScreen, DashboardScreen });
