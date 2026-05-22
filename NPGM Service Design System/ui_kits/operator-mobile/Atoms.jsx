// Atoms.jsx — shared tokens, icons, primitives for operator mobile.
// Compiled into index.html as an inline <script type="text/babel"> block.

const NPGM = {
  // Primary blue (real codebase values from app/src/app/globals.css)
  blue50: '#f0f6ff', blue100: '#dbe9ff', blue200: '#b8d3ff',
  blue500: '#2563eb', blue600: '#1d4ed8', blue700: '#1e40af',
  blue800: '#1e3a8a', blue900: '#172554',
  // Accent red
  red50: '#fef2f2', red100: '#fee2e2', red200: '#fecaca',
  red600: '#dc2626', red700: '#b91c1c',
  // Slate (secondary)
  s50: '#f8fafc', s100: '#f1f5f9', s200: '#e2e8f0', s300: '#cbd5e1',
  s400: '#94a3b8', s500: '#64748b', s600: '#475569', s700: '#334155',
  s800: '#1e293b', s900: '#0f172a',
  // Tailwind defaults used by success/warning variants
  em50: '#ecfdf5', em200: '#a7f3d0', em500: '#10b981', em600: '#059669', em700: '#047857',
  am50: '#fffbeb', am200: '#fde68a', am500: '#d97706', am600: '#d97706', am700: '#b45309',
  // Fonts
  fH: "'IBM Plex Sans', system-ui, sans-serif",
  fB: "'Inter', system-ui, sans-serif",
  fM: "'IBM Plex Mono', ui-monospace, monospace",
};

// Lucide-style icons (stroke 1.75, 24-px viewBox)
const _I = (paths) => ({ size = 20, color = 'currentColor', sw = 1.75 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color}
       strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{paths}</svg>
);
const Icons = {
  Home:        _I(<><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></>),
  Truck:       _I(<><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></>),
  Wrench:      _I(<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>),
  Clipboard:   _I(<><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>),
  MsgSquare:   _I(<><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>),
  Box:         _I(<><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></>),
  Cart:        _I(<><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></>),
  Alert:       _I(<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></>),
  Activity:    _I(<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>),
  Check:       _I(<polyline points="20 6 9 17 4 12"/>),
  X:           _I(<><path d="M18 6 6 18"/><path d="m6 6 12 12"/></>),
  ChevronR:    _I(<polyline points="9 18 15 12 9 6"/>),
  ChevronL:    _I(<polyline points="15 18 9 12 15 6"/>),
  ChevronD:    _I(<polyline points="6 9 12 15 18 9"/>),
  Plus:        _I(<><path d="M5 12h14"/><path d="M12 5v14"/></>),
  Camera:      _I(<><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></>),
  Send:        _I(<><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></>),
  Sparkle:     _I(<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>),
  Bot:         _I(<><path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/></>),
  User:        _I(<><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>),
  Menu:        _I(<><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></>),
  Loader:      _I(<><path d="M21 12a9 9 0 1 1-6.219-8.56"/></>),
};

// shadcn-style Button. Mobile-friendly heights.
function Button({ variant = 'default', size = 'default', full, icon, children, onClick, disabled, type }) {
  const bg = { default: NPGM.blue600, destructive: NPGM.red600, outline: '#fff', secondary: NPGM.s100, ghost: 'transparent', link: 'transparent' }[variant];
  const fg = { default: '#fff', destructive: '#fff', outline: NPGM.s900, secondary: NPGM.s900, ghost: NPGM.s700, link: NPGM.blue600 }[variant];
  const bd = { default: 'transparent', destructive: 'transparent', outline: NPGM.s300, secondary: 'transparent', ghost: 'transparent', link: 'transparent' }[variant];
  const h = { sm: 36, default: 44, lg: 48, icon: 44 }[size];
  const pad = { sm: '0 12px', default: '0 16px', lg: '0 24px', icon: 0 }[size];
  return (
    <button type={type || 'button'} onClick={disabled ? null : onClick} disabled={disabled} style={{
      height: h, padding: pad, background: bg, color: fg, border: `1px solid ${bd}`,
      borderRadius: 6, fontFamily: NPGM.fB, fontWeight: 500, fontSize: 14,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      width: full ? '100%' : 'auto', display: 'inline-flex', alignItems: 'center',
      justifyContent: 'center', gap: 8, boxSizing: 'border-box', whiteSpace: 'nowrap',
      transition: 'background 150ms',
    }}>{icon}{children}</button>
  );
}

function Input({ value, onChange, placeholder, type = 'text', id }) {
  return (
    <input id={id} type={type} value={value || ''}
      onChange={onChange ? e => onChange(e.target.value) : null} placeholder={placeholder}
      style={{
        height: 40, padding: '0 12px', borderRadius: 6,
        border: `1px solid ${NPGM.s300}`, fontFamily: NPGM.fB, fontSize: 14,
        color: NPGM.s900, outline: 'none', boxSizing: 'border-box', background: '#fff',
        boxShadow: '0 1px 2px rgba(15,23,42,0.04)', width: '100%',
      }}
    />
  );
}

function Field({ label, children, htmlFor, hint, error }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label htmlFor={htmlFor} style={{ fontFamily: NPGM.fB, fontSize: 14, fontWeight: 500, color: NPGM.s700 }}>{label}</label>
      {children}
      {hint && <span style={{ fontFamily: NPGM.fB, fontSize: 12, color: error ? NPGM.red700 : NPGM.s500 }}>{hint}</span>}
    </div>
  );
}

// shadcn Badge — exact variants
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
      fontFamily: NPGM.fB, fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap',
      ...style,
    }}>{children}</span>
  );
}

function Card({ children, padding = 16, style, onClick }) {
  const interactive = !!onClick;
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: `1px solid ${NPGM.s200}`, borderRadius: 12,
      padding, cursor: interactive ? 'pointer' : 'default',
      transition: 'border-color 150ms, box-shadow 150ms', ...style,
    }}>{children}</div>
  );
}

function LocaleSwitcher({ lang, setLang, onDark }) {
  const pill = (code, flag) => {
    const active = lang === code;
    return (
      <button key={code} onClick={() => setLang(code)} style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: active ? NPGM.blue600 : (onDark ? 'rgba(255,255,255,0.1)' : '#fff'),
        color: active ? '#fff' : (onDark ? '#fff' : NPGM.s700),
        border: `1px solid ${active ? NPGM.blue600 : (onDark ? 'rgba(255,255,255,0.25)' : NPGM.s200)}`,
        fontFamily: NPGM.fB, fontWeight: 500, fontSize: 12, cursor: 'pointer',
      }}>
        <span style={{ fontSize: 13 }}>{flag}</span>{code}
      </button>
    );
  };
  return <div style={{ display: 'inline-flex', gap: 4 }}>{pill('RU','🇷🇺')}{pill('EN','🇬🇧')}</div>;
}

// Mesh-gradient hero, used on login & welcome. Pass children to render on top.
function MeshHero({ height = 220, children }) {
  return (
    <div style={{
      position: 'relative', height, flexShrink: 0, overflow: 'hidden',
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
        backgroundSize: '40px 40px',
      }} />
      <div aria-hidden style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 1, background: NPGM.red600 }} />
      {children}
    </div>
  );
}

// Sticky app top bar inside the device. Logo mark on left when no back, back arrow otherwise.
function AppTopBar({ title, onBack, lang, setLang }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
      borderBottom: `1px solid ${NPGM.s200}`, background: '#fff',
      position: 'sticky', top: 0, zIndex: 5, height: 56, boxSizing: 'border-box',
    }}>
      {onBack ? (
        <button onClick={onBack} style={{
          width: 36, height: 36, borderRadius: 6, border: 'none', background: 'transparent',
          display: 'grid', placeItems: 'center', cursor: 'pointer', marginLeft: -6,
        }}><Icons.ChevronL color={NPGM.s700} size={22} /></button>
      ) : (
        <img src={NPGM_LOGO_MARK} alt="" style={{ width: 28, height: 28 }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: NPGM.fH, fontWeight: 600, fontSize: 16, color: NPGM.s900, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
      </div>
      <LocaleSwitcher lang={lang} setLang={setLang} />
    </div>
  );
}

function BottomNav({ tab, setTab, lang }) {
  const t = lang === 'RU'
    ? { home: 'Главная', shifts: 'Смены', tickets: 'Тикеты', ai: 'AI' }
    : { home: 'Home', shifts: 'Shifts', tickets: 'Tickets', ai: 'AI' };
  const items = [
    { id: 'home',    label: t.home,    icon: Icons.Home },
    { id: 'shifts',  label: t.shifts,  icon: Icons.Clipboard },
    { id: 'tickets', label: t.tickets, icon: Icons.MsgSquare },
    { id: 'ai',      label: t.ai,      icon: Icons.Bot },
  ];
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
      borderTop: `1px solid ${NPGM.s200}`, background: '#fff', flexShrink: 0,
    }}>
      {items.map(it => {
        const active = tab === it.id;
        const Ic = it.icon;
        return (
          <button key={it.id} onClick={() => setTab(it.id)} style={{
            height: 60, border: 'none', background: 'transparent',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 2, cursor: 'pointer', color: active ? NPGM.blue600 : NPGM.s500,
          }}>
            <Ic size={20} color={active ? NPGM.blue600 : NPGM.s500} />
            <span style={{ fontFamily: NPGM.fB, fontSize: 11, fontWeight: active ? 600 : 500 }}>{it.label}</span>
          </button>
        );
      })}
    </div>
  );
}

Object.assign(window, { NPGM, Icons, Button, Input, Field, Badge, Card, LocaleSwitcher, MeshHero, AppTopBar, BottomNav });
