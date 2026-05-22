// Atoms + Sidebar + Screens for manager-desktop. Compiled inline.
// Matches AppLayout.tsx + /app/page.tsx + machine list patterns.

const NPGM = {
  blue50: '#f0f6ff', blue100: '#dbe9ff', blue200: '#b8d3ff', blue300: '#88b4ff',
  blue500: '#2563eb', blue600: '#1d4ed8', blue700: '#1e40af',
  red50: '#fef2f2', red100: '#fee2e2', red200: '#fecaca', red500: '#ef4444',
  red600: '#dc2626', red700: '#b91c1c',
  s50: '#f8fafc', s100: '#f1f5f9', s200: '#e2e8f0', s300: '#cbd5e1',
  s400: '#94a3b8', s500: '#64748b', s600: '#475569', s700: '#334155',
  s800: '#1e293b', s900: '#0f172a',
  em50: '#ecfdf5', em200: '#a7f3d0', em500: '#10b981', em600: '#059669', em700: '#047857',
  am50: '#fffbeb', am200: '#fde68a', am500: '#d97706', am600: '#d97706', am700: '#b45309',
  fH: "'IBM Plex Sans', system-ui, sans-serif",
  fB: "'Inter', system-ui, sans-serif",
  fM: "'IBM Plex Mono', ui-monospace, monospace",
};

const _I = (paths) => ({ size = 18, color = 'currentColor', sw = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);
const Icons = {
  Home:       _I(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  Truck:      _I(<><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></>),
  Clipboard:  _I(<><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>),
  MsgSquare:  _I(<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>),
  Wrench:     _I(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>),
  Box:        _I(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>),
  Cart:       _I(<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>),
  Alert:      _I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></>),
  Activity:   _I(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  Users:      _I(<><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>),
  Shield:     _I(<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>),
  User:       _I(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  Search:     _I(<><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>),
  Plus:       _I(<><path d="M5 12h14"/><path d="M12 5v14"/></>),
  ChevronR:   _I(<polyline points="9 18 15 12 9 6"/>),
  ChevronL:   _I(<polyline points="15 18 9 12 15 6"/>),
  ChevronD:   _I(<polyline points="6 9 12 15 18 9"/>),
  Download:   _I(<><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></>),
  ArrowLeft:  _I(<><line x1="19" x2="5" y1="12" y2="12"/><polyline points="12 19 5 12 12 5"/></>),
  Camera:     _I(<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></>),
};

function Badge({ variant = 'default', children, style }) {
  const v = {
    default:     { bg: NPGM.blue50, fg: NPGM.blue700, ring: NPGM.blue200 },
    secondary:   { bg: NPGM.s100,   fg: NPGM.s700,    ring: NPGM.s200 },
    success:     { bg: NPGM.em50,   fg: NPGM.em700,   ring: NPGM.em200 },
    warning:     { bg: NPGM.am50,   fg: NPGM.am700,   ring: NPGM.am200 },
    destructive: { bg: NPGM.red50,  fg: NPGM.red700,  ring: NPGM.red200 },
    outline:     { bg: 'transparent', fg: NPGM.s700,  ring: NPGM.s300 },
  }[variant];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: '2px 8px',
      borderRadius: 6, background: v.bg, color: v.fg,
      boxShadow: `inset 0 0 0 1px ${v.ring}`,
      fontFamily: NPGM.fB, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap', ...style,
    }}>{children}</span>
  );
}

function Button({ variant = 'default', size = 'default', icon, children, onClick }) {
  const bg = { default: NPGM.blue600, destructive: NPGM.red600, outline: '#fff', secondary: NPGM.s100, ghost: 'transparent' }[variant];
  const fg = { default: '#fff', destructive: '#fff', outline: NPGM.s900, secondary: NPGM.s900, ghost: NPGM.s700 }[variant];
  const bd = { default: 'transparent', destructive: 'transparent', outline: NPGM.s300, secondary: 'transparent', ghost: 'transparent' }[variant];
  const h = { sm: 32, default: 36, lg: 40 }[size];
  const pad = { sm: '0 12px', default: '0 14px', lg: '0 24px' }[size];
  return (
    <button onClick={onClick} style={{
      height: h, padding: pad, background: bg, color: fg, border: `1px solid ${bd}`,
      borderRadius: 6, fontFamily: NPGM.fB, fontWeight: 500, fontSize: 13,
      cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
      whiteSpace: 'nowrap', transition: 'background 150ms',
    }}>{icon}{children}</button>
  );
}

function LocaleSwitcher({ lang, setLang }) {
  const pill = (code, flag) => (
    <button key={code} onClick={() => setLang(code)} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 999,
      background: lang === code ? NPGM.blue600 : '#fff',
      color: lang === code ? '#fff' : NPGM.s700,
      border: `1px solid ${lang === code ? NPGM.blue600 : NPGM.s200}`,
      fontFamily: NPGM.fB, fontWeight: 500, fontSize: 12, cursor: 'pointer',
    }}><span style={{ fontSize: 13 }}>{flag}</span>{code}</button>
  );
  return <div style={{ display: 'inline-flex', gap: 4 }}>{pill('RU','🇷🇺')}{pill('EN','🇬🇧')}</div>;
}

// MeshHero — same brand motif
function MeshHero({ height, radius = 12, children }) {
  return (
    <div style={{
      position: 'relative', height, borderRadius: radius, overflow: 'hidden', flexShrink: 0,
      backgroundColor: '#0b1437',
      backgroundImage: [
        'radial-gradient(at 78% 8%,  #6366f1 0px, transparent 55%)',
        'radial-gradient(at 12% 22%, #1d4ed8 0px, transparent 50%)',
        'radial-gradient(at 88% 80%, #a855f7 0px, transparent 50%)',
        'radial-gradient(at 18% 88%, #312e81 0px, transparent 55%)',
        'radial-gradient(at 50% 50%, #1e3a8a 0px, transparent 60%)',
      ].join(','),
    }}>
      <div aria-hidden style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
      }} />
      <div aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: NPGM.red600 }} />
      {children}
    </div>
  );
}

// ============================================================
// Sidebar — mirrors AppLayout.tsx left rail
// ============================================================
function Sidebar({ active, setActive, lang, role }) {
  const t = lang === 'RU' ? {
    home: 'Главная', machines: 'Парк техники', shifts: 'Смены',
    tickets: 'Тикеты', maintenance: 'ТО', parts: 'Гараж',
    team: 'Команда', admin: 'Админ', profile: 'Профиль',
    roleLabel: role === 'project_manager' ? 'Руководитель проекта' : role === 'service_engineer' ? 'Сервис-инженер' : 'NPGM Tier 2',
  } : {
    home: 'Home', machines: 'Fleet', shifts: 'Shifts',
    tickets: 'Tickets', maintenance: 'Maintenance', parts: 'Garage',
    team: 'Team', admin: 'Admin', profile: 'Profile',
    roleLabel: role === 'project_manager' ? 'Project manager' : role === 'service_engineer' ? 'Service engineer' : 'NPGM Tier 2',
  };

  const items = [
    { id: 'home',        label: t.home,        icon: Icons.Home,      roles: ['all'] },
    { id: 'machines',    label: t.machines,    icon: Icons.Truck,     roles: ['all'] },
    { id: 'shifts',      label: t.shifts,      icon: Icons.Clipboard, roles: ['operator', 'service_engineer', 'project_manager'] },
    { id: 'tickets',     label: t.tickets,     icon: Icons.MsgSquare, roles: ['all'] },
    { id: 'maintenance', label: t.maintenance, icon: Icons.Wrench,    roles: ['service_engineer', 'project_manager', 'platform_admin'] },
    { id: 'parts',       label: t.parts,       icon: Icons.Box,       roles: ['operator', 'service_engineer', 'project_manager'] },
    { id: 'team',        label: t.team,        icon: Icons.Users,     roles: ['project_manager', 'service_engineer'] },
    { id: 'admin',       label: t.admin,       icon: Icons.Shield,    roles: ['platform_admin'] },
    { id: 'profile',     label: t.profile,     icon: Icons.User,      roles: ['all'] },
  ].filter(it => it.roles.includes('all') || it.roles.includes(role));

  return (
    <div style={{
      width: 256, background: '#fff', borderRight: `1px solid ${NPGM.s200}`,
      display: 'flex', flexDirection: 'column', flexShrink: 0, height: '100%',
    }}>
      {/* Logo header — matches AppLayout 16-px logo block */}
      <div style={{ height: 64, padding: '0 16px', borderBottom: `1px solid ${NPGM.s200}`, display: 'flex', alignItems: 'center' }}>
        <img src={NPGM_LOGO_FULL} alt="NPGM" style={{ height: 24 }} />
      </div>

      {/* Nav */}
      <nav style={{ padding: '16px 8px', display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {items.map(it => {
          const isActive = active === it.id;
          const Ic = it.icon;
          return (
            <button key={it.id} onClick={() => setActive(it.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '8px 12px', height: 38,
              background: isActive ? NPGM.blue50 : 'transparent',
              color: isActive ? NPGM.blue700 : NPGM.s600,
              border: 'none', borderRadius: 6, cursor: 'pointer',
              fontFamily: NPGM.fB, fontWeight: isActive ? 600 : 500, fontSize: 14,
              textAlign: 'left',
            }}>
              <Ic size={20} color={isActive ? NPGM.blue600 : NPGM.s400} />
              <span style={{ whiteSpace: 'nowrap' }}>{it.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Role badge at bottom */}
      <div style={{ padding: '12px 16px', borderTop: `1px solid ${NPGM.s200}`, background: NPGM.s50 }}>
        <div style={{ fontFamily: NPGM.fB, fontSize: 10, color: NPGM.s500, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{lang === 'RU' ? 'Текущая роль' : 'Current role'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: NPGM.blue100, color: NPGM.blue700, display: 'grid', placeItems: 'center', fontFamily: NPGM.fH, fontSize: 12, fontWeight: 600 }}>АК</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>А. Кузнецов</div>
            <Badge variant="default" style={{ fontSize: 10, padding: '1px 6px' }}>{t.roleLabel}</Badge>
          </div>
        </div>
      </div>
    </div>
  );
}

function TopBar({ lang, setLang }) {
  return (
    <div style={{
      height: 64, padding: '0 24px', background: '#fff', borderBottom: `1px solid ${NPGM.s200}`,
      display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, width: 280, height: 36,
        padding: '0 12px', background: NPGM.s50, border: `1px solid ${NPGM.s200}`, borderRadius: 6,
      }}>
        <Icons.Search size={16} color={NPGM.s400} />
        <input placeholder={lang === 'RU' ? 'Поиск техники, тикетов, заявок…' : 'Search machines, tickets, requests…'}
          style={{ flex: 1, border: 'none', background: 'transparent', outline: 'none',
            fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s900 }} />
      </div>
      <div style={{ flex: 1 }} />
      <LocaleSwitcher lang={lang} setLang={setLang} />
      <button style={{
        display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none',
        cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
      }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: NPGM.blue100, color: NPGM.blue700, display: 'grid', placeItems: 'center', fontFamily: NPGM.fH, fontWeight: 600, fontSize: 13 }}>АК</div>
        <span style={{ fontFamily: NPGM.fB, fontSize: 13, color: NPGM.s700 }}>{lang === 'RU' ? 'a.kuznetsov@npgm.ru' : 'a.kuznetsov@npgm.ru'}</span>
        <Icons.ChevronD size={14} color={NPGM.s400} />
      </button>
    </div>
  );
}

Object.assign(window, { NPGM, Icons, Badge, Button, LocaleSwitcher, MeshHero, Sidebar, TopBar });
