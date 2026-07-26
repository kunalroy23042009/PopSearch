/* global React, ReactDOM, Chart */
const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;

// ═══════════════════════════════════════════════════════════════
//  ICONS — professional stroke-based SVG icon system
// ═══════════════════════════════════════════════════════════════
const Icon = ({ name, size = 18, className = '' }) => {
  const icons = {
    dashboard: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
    analyze: 'M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z',
    competitors: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zm14 10v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75',
    discover: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z',
    ideas: 'M9 18h6m-5 4h4M12 2a7 7 0 00-4 12.7V17h8v-2.3A7 7 0 0012 2z',
    watch: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
    calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z',
    repurpose: 'M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-3M20 14a8 8 0 01-14 3',
    seo: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5M19 5l-7 7m0 0l-3 3 3-3zm0 0l3 3-3-3z',
    thumbnail: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zm3 3l4 3 4-3M8 14h8',
    trends: 'M13 17l5-5-5-5M4 12h14M4 7l5-5M4 17l5 5',
    comments: 'M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z',
    publishing: 'M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z',
    algo: 'M3 12h4l3-9 4 18 3-9h4',
    editing: 'M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
    agent: 'M12 2a4 4 0 014 4v1a4 4 0 11-8 0V6a4 4 0 014-3zm10 14a6 6 0 00-6-6M2 16a6 6 0 016-6',
    reports: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6M8 13h8M8 17h5',
    saved: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
    pricing: 'M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6',
    billing: 'M3 6h18M3 12h18M3 18h12',
    settings: 'M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z',
    logout: 'M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9',
    search: 'M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z',
    bell: 'M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0',
    moon: 'M21 12.8A9 9 0 1111.2 3 7 7 0 0021 12.8z',
    sun: 'M12 1v2m0 18v2M4.2 4.2l1.4 1.4m12.8 12.8l1.4 1.4M1 12h2m18 0h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4M12 7a5 5 0 100 10 5 5 0 000-10z',
    download: 'M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3',
    trash: 'M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2',
    plus: 'M12 5v14m-7-7h14',
    check: 'M20 6L9 17l-5-5',
    x: 'M18 6L6 18M6 6l12 12',
    arrowUp: 'M12 19V5m-7 7l7-7 7 7',
    arrowDown: 'M12 5v14m7-7l-7 7-7-7',
    arrowRight: 'M5 12h14m-7-7l7 7-7 7',
    eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 15a3 3 0 100-6 3 3 0 000 6z',
    like: 'M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3',
    refresh: 'M23 4v6h-6M1 20v-6h6M3.5 9a9 9 0 0114.85-3.36L23 10M1 14l4.65 4.36A9 9 0 0020.5 15',
    sparkles: 'M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z M19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16z',
    youtube: 'M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8 0 12 0 12s0 4 .5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1C24 16 24 12 24 12s0-4-.5-5.8zM9.5 15.5v-7l6.3 3.5-6.3 3.5z',
    chart: 'M3 3v18h18M7 14l4-4 4 4 5-7',
    users: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8z',
    clock: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2',
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    globe: 'M12 22a10 10 0 100-20 10 10 0 000 20zM2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20',
    filter: 'M22 3H2l8 9.46V19l4 2v-8.54L22 3z',
    link: 'M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71',
    alert: 'M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01',
    video: 'M23 7l-7 5 7 5V7zM14 5H3a2 2 0 00-2 2v10a2 2 0 002 2h11a2 2 0 002-2V7a2 2 0 00-2-2z',
    mail: 'M4 4h16a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V6a2 2 0 012-2zm0 2l8 6 8-6',
    key: 'M21 2l-2 2m-7.5 7.5a4 4 0 11-5.66 5.66 4 4 0 015.66-5.66zM21 2L14 9m0 0l3 3',
    target: 'M12 22a10 10 0 100-20 10 10 0 000 20zM12 18a6 6 0 100-12 6 6 0 000 12zM12 14a2 2 0 100-4 2 2 0 000 4z',
    rocket: 'M4.5 16.5l-2 2.5h5l2-4M12 2c2 4 2 8 0 12-2-4-2-8 0-12zM8 20c2-1 3-3 4-6 1 3 2 5 4 6M5 12c0-1 1-4 3-6',
    fileText: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6M8 13h8M8 17h5',
    inbox: 'M22 12h-6l-2 3h-4l-2-3H2M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z',
    bookmark: 'M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z',
    tag: 'M20.59 13.41L12 22l-9-9V3h10l7.59 7.59a2 2 0 010 2.82zM7 7h.01',
    chevronDown: 'M6 9l6 6 6-6',
    chevronRight: 'M9 18l6-6-6-6',
  };
  return React.createElement('svg', {
    width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
    stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', className,
  }, React.createElement('path', { d: icons[name] || icons.dashboard }));
};

// ═══════════════════════════════════════════════════════════════
//  CONTEXTS
// ═══════════════════════════════════════════════════════════════
const AuthContext = createContext(null);
const ToastContext = createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = 'info', duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);
  const icons = { success: Icon({ name: 'check', size: 16 }), error: Icon({ name: 'x', size: 16 }), info: Icon({ name: 'bell', size: 16 }) };
  const container = toasts.length ? React.createElement('div', { className: 'toast-container' },
    ...toasts.map(t => React.createElement('div', { key: t.id, className: `toast ${t.type}` },
      icons[t.type], ' ', t.message,
    )),
  ) : null;
  return React.createElement(React.Fragment, null,
    React.createElement(ToastContext.Provider, { value: add }, children), container);
}
function useToast() { return useContext(ToastContext); }

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('ccr_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('ccr_token') || '');
  const login = useCallback((t, u) => { setToken(t); setUser(u); localStorage.setItem('ccr_token', t); localStorage.setItem('ccr_user', JSON.stringify(u)); }, []);
  const logout = useCallback(() => { setToken(''); setUser(null); localStorage.removeItem('ccr_token'); localStorage.removeItem('ccr_user'); }, []);
  const api = useCallback(async (path, opts = {}) => {
    const headers = { 'Content-Type': 'application/json', ...opts.headers };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) { logout(); return null; }
    return res;
  }, [token, logout]);
  return React.createElement(AuthContext.Provider, { value: { user, token, login, logout, api } }, children);
}
function useAuth() { return useContext(AuthContext); }

// ═══════════════════════════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════════════════════════
function fmtNum(n) {
  if (n == null) return '\u2014';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}
function isDark() { return (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark'; }
function chartColors() {
  const cs = getComputedStyle(document.body);
  return {
    text: cs.getPropertyValue('--text-2').trim() || '#aaa',
    grid: cs.getPropertyValue('--border').trim() || 'rgba(255,255,255,.08)',
    primary: cs.getPropertyValue('--primary').trim() || '#3ea6ff',
    accent: cs.getPropertyValue('--accent').trim() || '#ff2d55',
    success: cs.getPropertyValue('--success').trim() || '#2dba4e',
    error: cs.getPropertyValue('--error').trim() || '#ef4444',
  };
}
const chartInstances = {};
function safeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new Chart(canvas, config);
}
function scoreColor(s) {
  s = Number(s);
  return s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';
}
function scoreClass(s) {
  s = Number(s);
  return s >= 80 ? 'success' : s >= 50 ? 'warning' : 'error';
}

const PLATFORM_CONFIG = {
  youtube: { label: 'YouTube', color: '#ff0000', bg: 'rgba(255,0,0,.12)' },
  reddit: { label: 'Reddit', color: '#ff4500', bg: 'rgba(255,69,0,.12)' },
  twitter: { label: 'X', color: '#1da1f2', bg: 'rgba(29,161,242,.12)' },
  twitch: { label: 'Twitch', color: '#a970ff', bg: 'rgba(169,112,255,.12)' },
  hn: { label: 'HN', color: '#ff6600', bg: 'rgba(255,102,0,.12)' },
  trends: { label: 'Trends', color: '#3ea6ff', bg: 'rgba(62,166,255,.12)' },
  rss: { label: 'RSS', color: '#f59e0b', bg: 'rgba(245,158,11,.12)' },
  instagram: { label: 'Instagram', color: '#e1306c', bg: 'rgba(225,48,108,.12)' },
  tiktok: { label: 'TikTok', color: '#00f2ea', bg: 'rgba(0,242,234,.12)' },
  google: { label: 'Google', color: '#4285f4', bg: 'rgba(66,133,244,.12)' },
};
function getPlatformConfig(p) { return PLATFORM_CONFIG[p] || { label: p, color: '#717171', bg: 'rgba(113,113,113,.12)' }; }

// ═══════════════════════════════════════════════════════════════
//  SHARED COMPONENTS
// ═══════════════════════════════════════════════════════════════
function Skeleton({ count = 3 }) {
  return React.createElement('div', null,
    Array.from({ length: count }, (_, i) =>
      React.createElement('div', { key: i, className: 'card' },
        React.createElement('div', { className: 'skeleton', style: { height: 20, width: '50%', marginBottom: 12 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 14, width: '80%', marginBottom: 8 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 100, width: '100%' } }),
      )
    ),
  );
}
function ErrorBox({ message }) {
  if (!message) return null;
  return React.createElement('div', { className: 'error-box', style: { display: 'flex', alignItems: 'center', gap: 8 } },
    Icon({ name: 'alert', size: 16 }), message);
}
function StatCard({ icon, label, value, change, changeDir = 'up' }) {
  return React.createElement('div', { className: 'stat' },
    React.createElement('div', { className: 'label' }, icon ? Icon({ name: icon, size: 14 }) : null, label),
    React.createElement('div', { className: 'value' }, fmtNum(value)),
    change ? React.createElement('div', { className: `change ${changeDir}` },
      Icon({ name: changeDir === 'up' ? 'arrowUp' : 'arrowDown', size: 12 }), change) : null,
  );
}
function ContentItem({ item }) {
  const cfg = getPlatformConfig(item.platform);
  const m = item.raw_metrics || {};
  return React.createElement('a', { href: item.url, target: '_blank', className: 'content-item' },
    React.createElement('div', { className: 'platform-badge', style: { background: cfg.bg, color: cfg.color } }, cfg.label[0]),
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.88rem' } }, item.title),
      React.createElement('div', { style: { display: 'flex', gap: 12, fontSize: '.78rem', color: 'var(--text-3)', flexWrap: 'wrap', alignItems: 'center' } },
        React.createElement('span', null, item.source || item.platform),
        m.views ? React.createElement('span', null, fmtNum(m.views), ' views') : null,
        m.likes ? React.createElement('span', null, fmtNum(m.likes), ' likes') : null,
        item.classification ? React.createElement('span', { className: `badge badge-${item.classification === 'trending' ? 'primary' : item.classification === 'popular' ? 'accent' : 'success'}` }, item.classification) : null,
      ),
    ),
  );
}
function EmptyState({ icon, title, text, action }) {
  return React.createElement('div', { className: 'empty-state' },
    React.createElement('div', { className: 'empty-icon' }, Icon({ name: icon || 'inbox', size: 28 })),
    title ? React.createElement('h2', null, title) : null,
    React.createElement('p', null, text || 'No data yet'),
    action || null,
  );
}
function PageHeader({ title, subtitle, action }) {
  return React.createElement('div', { className: 'flex-between mb-24' },
    React.createElement('div', null,
      React.createElement('h1', { className: 'section-title' }, title),
      subtitle ? React.createElement('p', { className: 'section-subtitle' }, subtitle) : null,
    ),
    action || null,
  );
}

// ═══════════════════════════════════════════════════════════════
//  GOOGLE SIGN-IN
// ═══════════════════════════════════════════════════════════════
function GoogleSignInButton() {
  const { login } = useAuth();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [hasGoogle, setHasGoogle] = useState(false);

  useEffect(() => {
    setHasGoogle(!!window.__GOOGLE_CLIENT_ID__);
  }, []);

  const handleGoogle = async () => {
    setLoading(true);
    try {
      const client = window.google?.accounts?.oauth2;
      if (!client || !window.__GOOGLE_CLIENT_ID__) {
        toast('Google Sign-In not configured', 'error');
        setLoading(false);
        return;
      }
      const tokenClient = client.initTokenClient({
        client_id: window.__GOOGLE_CLIENT_ID__,
        scope: 'openid email profile',
        callback: async (resp) => {
          if (resp.access_token) {
            try {
              const res = await fetch('/api/auth/google', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: resp.access_token }),
              });
              const d = await res.json();
              if (res.ok) { login(d.access_token, d.user); toast('Signed in with Google', 'success'); }
              else { toast(d.detail || 'Google sign-in failed', 'error'); }
            } catch { toast('Network error', 'error'); }
          }
          setLoading(false);
        },
      });
      tokenClient.requestAccessToken();
    } catch (e) {
      toast('Google sign-in failed', 'error');
      setLoading(false);
    }
  };

  if (!hasGoogle) return null;
  return React.createElement('button', {
    className: 'google-btn',
    onClick: handleGoogle,
    disabled: loading,
  },
    loading ? React.createElement('span', { className: 'spinner' }) : React.createElement('svg', {
      viewBox: '0 0 24 24', width: 18, height: 18,
    },
      React.createElement('path', { fill: '#4285F4', d: 'M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z' }),
      React.createElement('path', { fill: '#34A853', d: 'M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z' }),
      React.createElement('path', { fill: '#FBBC05', d: 'M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z' }),
      React.createElement('path', { fill: '#EA4335', d: 'M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z' }),
    ),
    ' Continue with Google',
  );
}

// ═══════════════════════════════════════════════════════════════
//  AUTH PAGES
// ═══════════════════════════════════════════════════════════════
function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (res.ok) { login(d.access_token, d.user); toast('Welcome back', 'success'); }
      else { setErr(d.detail || 'Login failed'); setLoading(false); }
    } catch { setErr('Network error'); setLoading(false); }
  };
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' }, Icon({ name: 'youtube', size: 24 })),
      React.createElement('h1', null, 'Welcome back'),
      React.createElement('p', { className: 'subtitle' }, 'Sign in to PopSearch'),
      err ? React.createElement('div', { className: 'error-box', style: { marginBottom: 16 } }, err) : null,
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Email'),
          React.createElement('input', { className: 'input', type: 'email', value: email, onChange: e => setEmail(e.target.value), placeholder: 'you@example.com', required: true, autoFocus: true }),
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Password'),
          React.createElement('input', { className: 'input', type: 'password', value: password, onChange: e => setPassword(e.target.value), placeholder: 'Enter your password', required: true }),
        ),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary w-full', style: { marginTop: 4 }, disabled: loading },
          loading ? React.createElement('span', { className: 'spinner' }) : null, loading ? 'Signing in' : 'Sign In'),
      ),
      React.createElement('div', { className: 'auth-divider' },
        React.createElement('div', { className: 'auth-divider-line' }),
        React.createElement('span', { className: 'auth-divider-text' }, 'or continue with'),
        React.createElement('div', { className: 'auth-divider-line' }),
      ),
      React.createElement(GoogleSignInButton, null),
      React.createElement('p', { className: 'auth-link' },
        "Don't have an account? ", React.createElement('a', { href: '#register', onClick: e => { e.preventDefault(); window.location.hash = 'register'; window.location.reload(); } }, 'Create one')),
    ),
  );
}
function RegisterPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (res.ok) { login(d.access_token, d.user); toast('Account created', 'success'); }
      else { setErr(d.detail || 'Registration failed'); setLoading(false); }
    } catch { setErr('Network error'); setLoading(false); }
  };
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card' },
      React.createElement('div', { className: 'auth-logo' }, Icon({ name: 'youtube', size: 24 })),
      React.createElement('h1', null, 'Create your account'),
      React.createElement('p', { className: 'subtitle' }, 'Join PopSearch for free'),
      err ? React.createElement('div', { className: 'error-box', style: { marginBottom: 16 } }, err) : null,
      React.createElement('form', { onSubmit: handleSubmit },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Email'),
          React.createElement('input', { className: 'input', type: 'email', value: email, onChange: e => setEmail(e.target.value), placeholder: 'you@example.com', required: true, autoFocus: true }),
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Password'),
          React.createElement('input', { className: 'input', type: 'password', value: password, onChange: e => setPassword(e.target.value), placeholder: 'Minimum 8 characters', required: true, minLength: 8 }),
        ),
        React.createElement('button', { type: 'submit', className: 'btn btn-primary w-full', style: { marginTop: 4 }, disabled: loading },
          loading ? React.createElement('span', { className: 'spinner' }) : null, loading ? 'Creating account' : 'Create Account'),
      ),
      React.createElement('div', { className: 'auth-divider' },
        React.createElement('div', { className: 'auth-divider-line' }),
        React.createElement('span', { className: 'auth-divider-text' }, 'or continue with'),
        React.createElement('div', { className: 'auth-divider-line' }),
      ),
      React.createElement(GoogleSignInButton, null),
      React.createElement('p', { className: 'auth-link' },
        'Already have an account? ', React.createElement('a', { href: '#login', onClick: e => { e.preventDefault(); window.location.hash = 'login'; window.location.reload(); } }, 'Sign in')),
    ),
  );
}

// ═══════════════════════════════════════════════════════════════
//  UNIFIED DASHBOARD — channel stats, trends, competitors, cross-platform, YT Analytics
// ═══════════════════════════════════════════════════════════════
function DashboardPage() {
  const { api } = useAuth();
  const [url, setUrl] = useState(() => localStorage.getItem('ccr_last_url') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [watched, setWatched] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [connectErr, setConnectErr] = useState('');

  useEffect(() => {
    api('/api/watched-competitors').then(async r => { if (r?.ok) setWatched(await r.json()); });
  }, []);

  const load = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setData(null); setAnalytics(null);
    try {
      localStorage.setItem('ccr_last_url', url);
      const res = await api('/dashboard', { method: 'POST', body: JSON.stringify({ channel_url: url, topic: '' }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setData(d); setTimeout(() => renderCharts(d), 150); loadAnalytics(); }
      else { setErr(d.detail || 'Analysis failed'); }
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };
  const loadAnalytics = async () => {
    setAnalyticsLoading(true);
    try { const res = await api('/api/analytics/overview?days=28'); if (res?.ok) { const d = await res.json(); if (!d.needs_auth) setAnalytics(d); } } catch {}
    finally { setAnalyticsLoading(false); }
  };
  const renderCharts = (d) => {
    const c = chartColors();
    const profile = d.profile;
    if (d.trends?.interest_over_time?.length) {
      const labels = d.trends.interest_over_time.map(x => x.label);
      const values = d.trends.interest_over_time.map(x => x.value);
      const ctx = document.getElementById('dash-trend')?.getContext('2d');
      const grad = ctx?.createLinearGradient(0, 0, 0, 250);
      if (grad) { grad.addColorStop(0, c.primary + '40'); grad.addColorStop(1, c.primary + '00'); }
      safeChart('dash-trend', { type: 'line', data: { labels, datasets: [{ label: 'Interest', data: values, borderColor: c.primary, backgroundColor: grad || c.primary + '10', fill: true, tension: .4, pointRadius: 0, pointHoverRadius: 5, borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { display: false }, ticks: { color: c.text, maxTicksLimit: 8 } }, y: { grid: { color: c.grid }, ticks: { color: c.text } } } } });
    }
    if (profile?.performance_summary) {
      const ps = profile.performance_summary;
      safeChart('dash-donut', { type: 'doughnut', data: { labels: ['Views', 'Engagement', 'Growth'], datasets: [{ data: [ps.average_views_last_30d || 0, profile.engagement_rate || 0, ps.growth_rate || 0].map(v => Math.max(v, 1)), backgroundColor: [c.primary, c.accent, c.success], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: c.text, padding: 12, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' } }, cutout: '68%' } } });
    }
  };
  const watchCompetitor = async (ch) => {
    await api('/api/watched-competitors', { method: 'POST', body: JSON.stringify({ channel_id: ch.channel_id, channel_title: ch.title, thumbnail_url: ch.thumbnail_url || '' }) });
    setWatched(prev => { const exists = prev.find(c => c.channel_id === ch.channel_id); return exists ? prev : [...prev, ch]; });
  };
  const unwatch = async (cid) => {
    await api(`/api/watched-competitors/${cid}`, { method: 'DELETE' });
    setWatched(prev => prev.filter(c => c.channel_id !== cid));
  };
  useEffect(() => { const u = localStorage.getItem('ccr_last_url'); if (u) setUrl(u); }, []);
  const p = data?.profile;
  const ps = p?.performance_summary;
  const comp = data?.competitors;
  const trends = data?.trends;
  const cpc = data?.cross_platform_content || data?.content_items;
  const isTracked = (cid) => watched.some(c => c.channel_id === cid);
  const fmtAz = (n) => { if (!n) return '0'; if (n >= 1e6) return (n/1e6).toFixed(1)+'M'; if (n >= 1e3) return (n/1e3).toFixed(1)+'K'; return String(n); };
  return React.createElement('div', null,
    PageHeader({ title: 'Dashboard', subtitle: 'Unified channel intelligence — stats, trends, competitors, cross-platform, and analytics',
      action: data ? React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => window.open(`/api/analyze/${p?.channel_id}/export?format=csv`, '_blank') },
        Icon({ name: 'download', size: 14 }), ' Export') : null }),
    React.createElement('div', { className: 'flex gap-8 mb-16' },
      React.createElement('input', { className: 'input', value: url, onChange: e => setUrl(e.target.value), placeholder: 'Paste YouTube channel URL...', style: { flex: 1 }, onKeyDown: e => e.key === 'Enter' && load() }),
      React.createElement('button', { className: 'btn btn-primary', onClick: load, disabled: loading }, loading ? React.createElement('span', { className: 'spinner' }) : Icon({ name: 'search', size: 16 }), loading ? 'Analyzing' : 'Analyze'),
    ),
    loading ? Skeleton({ count: 4 }) : err ? ErrorBox({ message: err }) : data ? React.createElement('div', null,
      // ── Stats row ──
      React.createElement('div', { className: 'stats' },
        StatCard({ icon: 'eye', label: 'Total Views', value: p?.view_count }),
        StatCard({ icon: 'users', label: 'Subscribers', value: p?.subscriber_count }),
        StatCard({ icon: 'video', label: 'Videos', value: p?.video_count }),
        StatCard({ icon: 'like', label: 'Engagement', value: p?.engagement_rate ? p.engagement_rate.toFixed(2) + '%' : null }),
        StatCard({ icon: 'chart', label: 'Growth Rate', value: ps?.growth_rate ? ps.growth_rate.toFixed(1) + '%' : null }),
        StatCard({ icon: 'target', label: 'Niche', value: p?.niche || null }),
      ),
      // ── Charts ──
      React.createElement('div', { className: 'chart-grid mb-16' },
        trends?.interest_over_time?.length ? React.createElement('div', { className: 'card' },
          React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Interest Over Time')),
          React.createElement('div', { className: 'chart-container' }, React.createElement('canvas', { id: 'dash-trend' })),
        ) : null,
        ps ? React.createElement('div', { className: 'card' },
          React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Performance Breakdown')),
          React.createElement('div', { className: 'chart-container' }, React.createElement('canvas', { id: 'dash-donut' })),
        ) : null,
      ),
      // ── Channel info ──
      p?.niche ? React.createElement('div', { className: 'card mb-16 flex items-center gap-12', style: { padding: '12px 16px' } },
        React.createElement('span', { style: { fontSize: '.88rem', color: 'var(--text-3)' } }, 'Detected niche:'),
        React.createElement('span', { style: { fontWeight: 700, color: 'var(--primary)' } }, p.niche),
        p?.channel_tier ? React.createElement('span', { style: { marginLeft: 'auto', fontWeight: 600, color: 'var(--accent)', fontSize: '.85rem' } }, p.channel_tier + ' creator') : null,
      ) : null,
      // ── Content themes ──
      p?.content_themes?.length ? React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Content Themes')),
        p.content_themes.map((t, i) => React.createElement('div', { key: i, className: 'info-tip' }, t)),
      ) : null,
      // ── Performance summary ──
      ps ? React.createElement('div', { className: 'stats mb-16' },
        StatCard({ label: 'Avg Views (30d)', value: ps.average_views_last_30d ? fmtNum(ps.average_views_last_30d) : null }),
        StatCard({ label: 'Upload Frequency', value: ps.upload_frequency }),
        StatCard({ label: 'Best Upload Day', value: ps.best_upload_day }),
        ps.top_video_views ? StatCard({ label: 'Top Video Views', value: fmtNum(ps.top_video_views) }) : null,
      ) : null,
      // ── Recent videos ──
      p?.recent_videos?.length ? React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Recent Videos')),
        React.createElement('table', { className: 'table' },
          React.createElement('thead', null, React.createElement('tr', null,
            React.createElement('th', null, 'Title'), React.createElement('th', { className: 'num' }, 'Views'), React.createElement('th', { className: 'num' }, 'Likes'), React.createElement('th', { className: 'num' }, 'Comments'))),
          React.createElement('tbody', null, p.recent_videos.slice(0, 10).map(v =>
            React.createElement('tr', { key: v.video_id },
              React.createElement('td', { style: { maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
                React.createElement('a', { href: 'https://youtube.com/watch?v=' + v.video_id, target: '_blank', style: { color: 'var(--text)', textDecoration: 'none' } }, v.title)),
              React.createElement('td', { className: 'num' }, fmtNum(v.view_count)),
              React.createElement('td', { className: 'num' }, fmtNum(v.like_count)),
              React.createElement('td', { className: 'num' }, fmtNum(v.comment_count)),
            )
          )),
        ),
      ) : null,
      // ── Competitors ──
      comp?.competitors?.length ? React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('h3', null, 'Similar Channels'),
          comp.market_position ? React.createElement('span', { className: 'text-xs text-muted' }, comp.market_position) : null,
        ),
        React.createElement('div', { className: 'grid-2' },
          comp.competitors.slice(0, 8).map((c, i) => React.createElement('div', { key: i, className: 'flex items-center gap-12 p-16 border' },
            c.thumbnail_url ? React.createElement('img', { src: c.thumbnail_url, alt: '', style: { width: 40, height: 40, borderRadius: 20 } }) : React.createElement('div', { style: { width: 40, height: 40, borderRadius: 20, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, Icon({ name: 'users', size: 16 })),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { className: 'truncate font-semibold text-sm' }, c.title),
              React.createElement('div', { className: 'text-xs text-muted' }, fmtNum(c.subscriber_count) + ' subs'),
            ),
            isTracked(c.channel_id) ? React.createElement('button', { className: 'icon-btn', onClick: () => unwatch(c.channel_id), title: 'Untrack' }, Icon({ name: 'check', size: 16 }))
              : React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => watchCompetitor(c) }, Icon({ name: 'plus', size: 14 }), ' Track'),
          )),
        ),
      ) : null,
      // ── Tracked competitors (from /api/watched-competitors) ──
      watched.length > 0 ? React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Tracked Competitors')),
        React.createElement('div', { className: 'grid-2' },
          watched.map(ch => React.createElement('div', { key: ch.channel_id, className: 'flex items-center gap-12 p-16 border' },
            ch.thumbnail_url ? React.createElement('img', { src: ch.thumbnail_url, alt: '', style: { width: 36, height: 36, borderRadius: 18 } }) : React.createElement('div', { style: { width: 36, height: 36, borderRadius: 18, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, Icon({ name: 'users', size: 16 })),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('div', { className: 'truncate font-semibold text-sm' }, ch.channel_title || ch.title),
              React.createElement('div', { className: 'text-xs text-muted' }, ch.channel_id),
            ),
            React.createElement('button', { className: 'icon-btn', onClick: () => unwatch(ch.channel_id), title: 'Remove' }, Icon({ name: 'trash', size: 16 })),
          )),
        ),
      ) : null,
      // ── Cross-platform content ──
      cpc?.length ? React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Cross-Platform Content')),
        cpc.slice(0, 10).map((item, i) => ContentItem({ item, key: i })),
      ) : null,
      // ── YouTube Analytics ──
      React.createElement('div', { className: 'card mb-16' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('h3', null, 'YouTube Analytics'),
          analytics ? React.createElement('span', { className: 'text-xs text-muted' }, 'Connected') : React.createElement('span', { className: 'text-xs text-muted' }, 'Connect for detailed metrics'),
        ),
        analyticsLoading ? React.createElement('div', { style: { textAlign: 'center', padding: 32 } }, React.createElement('span', { className: 'spinner' }))
          : analytics ? React.createElement('div', null,
              analytics.timeseries?.totals ? React.createElement('div', { className: 'stats' },
                StatCard({ label: 'Views (period)', value: fmtAz(analytics.timeseries.totals.views) }),
                StatCard({ label: 'Watch Time (min)', value: fmtAz(analytics.timeseries.totals.estimatedMinutesWatched) }),
                StatCard({ label: 'Subs Gained', value: '+' + fmtAz(analytics.timeseries.totals.subscribersGained) }),
                StatCard({ label: 'Likes', value: fmtAz(analytics.timeseries.totals.likes) }),
                StatCard({ label: 'Comments', value: fmtAz(analytics.timeseries.totals.comments) }),
                StatCard({ label: 'Shares', value: fmtAz(analytics.timeseries.totals.shares) }),
              ) : null,
              analytics.top_videos?.length ? React.createElement('div', { className: 'table-container' },
                React.createElement('table', { className: 'table' },
                  React.createElement('thead', null, React.createElement('tr', null,
                    React.createElement('th', null, 'Title'), React.createElement('th', null, 'Views'), React.createElement('th', null, 'Watch (min)'), React.createElement('th', null, 'Avg Duration'), React.createElement('th', null, 'Retention %'))),
                  React.createElement('tbody', null, analytics.top_videos.slice(0, 5).map((v, i) => React.createElement('tr', { key: i },
                    React.createElement('td', { style: { maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, v.title),
                    React.createElement('td', null, fmtAz(v.views)),
                    React.createElement('td', null, fmtAz(v.watch_minutes)),
                    React.createElement('td', null, v.avg_view_duration ? (() => { const m = Math.floor(v.avg_view_duration/60); const s = Math.round(v.avg_view_duration%60); return m+'m '+s+'s'; })() : '-'),
                    React.createElement('td', null, v.avg_view_percentage != null ? v.avg_view_percentage + '%' : '-'),
                  ))),
                ),
              ) : null,
              analytics.traffic_sources?.length ? React.createElement('div', { style: { padding: '0 16px 16px' } },
                React.createElement('h4', { style: { fontSize: '.82rem', fontWeight: 600, marginBottom: 8, color: 'var(--text-3)' } }, 'Traffic Sources'),
                analytics.traffic_sources.map((t, i) => React.createElement('div', { key: i, className: 'info-tip' },
                  React.createElement('span', { style: { fontWeight: 600 } }, t.source), ' — ', fmtAz(t.views), ' views',
                )),
              ) : null,
            )
          : React.createElement('div', { style: { textAlign: 'center', padding: 32 } },
              React.createElement('p', { className: 'text-sm text-2 mb-16' }, 'Connect your YouTube account to see detailed analytics including watch time, traffic sources, demographics, and more.'),
              connectErr ? React.createElement('p', { className: 'text-xs', style: { color: 'var(--error)', marginBottom: 12 } }, connectErr) : null,
              React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: async () => { setConnectErr(''); try { const r = await api('/api/auth/youtube/url'); if (!r) return; const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else if (d.detail) setConnectErr(d.detail); else setConnectErr('Failed to connect'); } catch { setConnectErr('Network error'); } } }, Icon({ name: 'youtube', size: 16 }), ' Connect YouTube'),
            ),
      ),
    ) : EmptyState({ icon: 'chart', title: 'Enter a channel URL', text: 'Enter a YouTube channel URL above to see analytics, trends, competitors, and cross-platform content — all in one place.', action: React.createElement('button', { className: 'btn btn-ghost', onClick: () => { setUrl('https://www.youtube.com/@MrBeast'); load(); } }, Icon({ name: 'sparkles', size: 16 }), ' Try with MrBeast') }),
  );
}



// ═══════════════════════════════════════════════════════════════
//  IDEA GENERATOR
// ═══════════════════════════════════════════════════════════════
function IdeasPage() {
  const { api } = useAuth();
  const [channelId, setChannelId] = useState('');
  const [niche, setNiche] = useState('');
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const generate = async () => {
    if (!channelId.trim() || !niche.trim()) return;
    setLoading(true); setErr(''); setIdeas(null);
    try {
      const res = await api('/api/ideas/generate', { method: 'POST', body: JSON.stringify({ topic: niche || channelId }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setIdeas(d); else setErr(d.detail || 'Generation failed');
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };
  const saveIdea = async (idea) => {
    await api('/api/ideas/save', { method: 'POST', body: JSON.stringify({ topic: niche || idea.tags?.[0] || 'general', title: idea.title, seo_keywords: (idea.tags || []).join(', '), saved: true }) });
  };
  return React.createElement('div', null,
    PageHeader({ title: 'Idea Generator', subtitle: 'AI-powered content ideas tailored to your channel' }),
    React.createElement('div', { className: 'card mb-16' },
      React.createElement('div', { className: 'grid-2 mb-16' },
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Channel ID'),
          React.createElement('input', { className: 'input', value: channelId, onChange: e => setChannelId(e.target.value), placeholder: 'UCxxxx...' }),
        ),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Niche / Topic'),
          React.createElement('input', { className: 'input', value: niche, onChange: e => setNiche(e.target.value), placeholder: 'e.g. tech reviews', onKeyDown: e => e.key === 'Enter' && generate() }),
        ),
      ),
      React.createElement('button', { className: 'btn btn-primary w-full', onClick: generate, disabled: loading },
        loading ? React.createElement('span', { className: 'spinner' }) : Icon({ name: 'sparkles', size: 16 }), loading ? 'Generating' : 'Generate Ideas'),
    ),
    err ? ErrorBox({ message: err }) : null,
    loading ? Skeleton({ count: 3 }) : ideas?.ideas?.length ? React.createElement('div', { className: 'grid-2' },
      ideas.ideas.map((idea, i) => React.createElement('div', { key: i, className: 'card' },
        React.createElement('div', { className: 'flex items-center gap-8 mb-8' },
          React.createElement('span', { className: 'badge badge-primary' }, '#' + (i + 1)),
          idea.viral_score ? React.createElement('span', { className: `badge badge-${scoreClass(idea.viral_score)}` }, 'Viral: ' + idea.viral_score) : null,
        ),
        React.createElement('h3', { style: { fontSize: '.95rem', fontWeight: 700, marginBottom: 8 } }, idea.title),
        idea.description ? React.createElement('p', { className: 'text-sm text-2', style: { marginBottom: 12 } }, idea.description) : null,
        idea.tags?.length ? React.createElement('div', { className: 'flex flex-wrap gap-8 mb-16' },
          idea.tags.map((t, ti) => React.createElement('span', { key: ti, className: 'badge badge-neutral' }, t))
        ) : null,
        React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: () => saveIdea(idea) }, Icon({ name: 'bookmark', size: 14 }), ' Save'),
      ))
    ) : EmptyState({ icon: 'ideas', title: 'Generate ideas', text: 'Enter your channel ID and niche to get AI-powered content ideas with viral potential scores.' }),
  );
}



// ═══════════════════════════════════════════════════════════════
//  TREND ALERTS
// ═══════════════════════════════════════════════════════════════
function TrendAlertsPage() {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api('/api/alerts').then(async r => { if (r?.ok) { setAlerts(await r.json()); } setLoading(false); });
  }, []);
  return React.createElement('div', null,
    PageHeader({ title: 'Trend Alerts', subtitle: 'Stay on top of trending topics in your niche' }),
    loading ? Skeleton({ count: 2 }) : alerts?.length ? React.createElement('div', null,
      alerts.map((alert, i) => React.createElement('div', { key: i, className: 'card flex items-center gap-16' },
        React.createElement('div', { style: { width: 40, height: 40, borderRadius: 10, background: 'var(--accent-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 } }, Icon({ name: 'trends', size: 18 })),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { className: 'font-semibold' }, alert.topic || alert.title || 'Trend'),
          alert.description ? React.createElement('div', { className: 'text-sm text-2 mt-8' }, alert.description) : null,
          alert.score ? React.createElement('div', { className: 'mt-8' }, React.createElement('div', { className: 'progress-bar', style: { width: 120 } }, React.createElement('div', { className: `progress-bar-fill ${scoreClass(alert.score)}`, style: { width: alert.score + '%' } }))) : null,
        ),
        alert.platform ? React.createElement('span', { className: 'badge badge-primary' }, alert.platform) : null,
      ))
    ) : EmptyState({ icon: 'trends', title: 'No trend alerts', text: 'Trend alerts are generated based on your niche and monitored channels. Check back soon.' }),
  );
}



// ═══════════════════════════════════════════════════════════════
//  ALGORITHM SHIFT TRACKER
// ═══════════════════════════════════════════════════════════════
function AlgoShiftPage() {
  const { api } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const analyze = async () => {
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await api('/api/algorithm/shifts', { method: 'POST', body: JSON.stringify({}) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setResult(d); else setErr(d.detail || 'Failed');
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { analyze(); }, []);
  return React.createElement('div', null,
    PageHeader({ title: 'Algo Shifts', subtitle: 'Track algorithm changes and their impact on your channel' }),
    err ? ErrorBox({ message: err }) : null,
    loading ? Skeleton({ count: 2 }) : result?.shifts?.length ? React.createElement('div', null,
      result.shifts.map((shift, i) => React.createElement('div', { key: i, className: 'card' },
        React.createElement('div', { className: 'flex items-center gap-12 mb-16' },
          Icon({ name: 'algo', size: 20 }),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('div', { className: 'font-semibold' }, shift.type || shift.title || 'Algorithm Shift'),
            React.createElement('div', { className: 'text-xs text-muted' }, shift.date || shift.detected_at || ''),
          ),
          shift.impact ? React.createElement('span', { className: `badge badge-${shift.impact === 'high' ? 'error' : shift.impact === 'medium' ? 'warning' : 'neutral'}` }, shift.impact) : null,
        ),
        shift.description ? React.createElement('p', { className: 'text-sm text-2' }, shift.description) : null,
        shift.recommendation ? React.createElement('div', { className: 'info-tip mt-16' }, 'Recommendation: ', shift.recommendation) : null,
      ))
    ) : result && !result.shifts?.length ? EmptyState({ icon: 'algo', title: 'No shifts detected', text: 'No algorithm shifts detected yet. We monitor for changes that could affect your channel.' }) : EmptyState({ icon: 'algo', title: 'Algorithm Shift Tracker', text: 'Track YouTube algorithm changes and get recommendations for adapting your strategy.' }),
  );
}




// ═══════════════════════════════════════════════════════════════
//  EDITING COACH
// ═══════════════════════════════════════════════════════════════
function EditingPage() {
  const { api } = useAuth();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [needsAuth, setNeedsAuth] = useState(false);
  const analyze = async () => {
    setLoading(true); setErr(''); setResult(null); setNeedsAuth(false);
    try {
      const res = await api('/api/editing/analyze', { method: 'POST', body: JSON.stringify({}) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        if (d.needs_auth) { setNeedsAuth(true); setResult(null); }
        else setResult(d);
      } else setErr(d.detail || 'Failed');
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };
  useEffect(() => { analyze(); }, []);
  return React.createElement('div', null,
    PageHeader({ title: 'Editing Coach', subtitle: 'Retention-based editing feedback powered by YouTube Analytics' }),
    err ? ErrorBox({ message: err }) : null,
    needsAuth ? React.createElement('div', { className: 'card', style: { textAlign: 'center', padding: 48 } },
      Icon({ name: 'key', size: 32 }),
      React.createElement('h2', { className: 'mt-16' }, 'Connect your YouTube account'),
      React.createElement('p', { className: 'text-sm text-2 mt-8 mb-24' }, 'Editing Coach uses YouTube Analytics to analyze your retention data. Connect your account to get started.'),
      React.createElement('button', { className: 'btn btn-primary', onClick: async () => { setErr(''); try { const r = await api('/api/auth/youtube/url'); if (!r) return; const d = await r.json(); if (r.ok && d.url) window.location.href = d.url; else if (d.detail) setErr(d.detail); else setErr('Failed to connect'); } catch { setErr('Network error'); } } }, Icon({ name: 'youtube', size: 16 }), ' Connect YouTube'),
    ) : loading ? Skeleton({ count: 2 }) : result ? React.createElement('div', null,
      result.retention_rate != null ? React.createElement('div', { className: 'stats' },
        StatCard({ label: 'Avg Retention', value: result.retention_rate ? result.retention_rate.toFixed(1) + '%' : null }),
        StatCard({ label: 'Avg View Duration', value: result.avg_view_duration }),
        StatCard({ label: 'Watch Time (hrs)', value: result.watch_time_hours }),
      ) : null,
      result.tips?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Editing Tips')),
        result.tips.map((tip, i) => React.createElement('div', { key: i, className: 'info-tip' }, tip.tip || tip.title || tip)),
      ) : null,
      !result.tips?.length && result.retention_rate == null ? React.createElement('div', { className: 'card' },
        React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.88rem' } }, JSON.stringify(result, null, 2))) : null,
    ) : EmptyState({ icon: 'editing', title: 'Editing Coach', text: 'Connect your YouTube account to get retention-based editing feedback.' }),
  );
}

// ═══════════════════════════════════════════════════════════════
//  GROWTH AGENT
// ═══════════════════════════════════════════════════════════════
function AgentPage() {
  const { api } = useAuth();
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [generating, setGenerating] = useState(false);
  useEffect(() => {
    api('/api/agent/status').then(async r => { if (r?.ok) setStatus(await r.json()); });
  }, []);
  const generatePlan = async () => {
    setGenerating(true);
    try {
      const res = await api('/api/agent/weekly-plan', { method: 'POST', body: JSON.stringify({}) });
      if (res?.ok) { setPlan(await res.json()); }
    } catch { }
    finally { setGenerating(false); }
  };
  return React.createElement('div', null,
    PageHeader({ title: 'Growth Agent', subtitle: 'Your personal AI growth strategist',
      action: React.createElement('button', { className: 'btn btn-primary btn-sm', onClick: generatePlan, disabled: generating },
        generating ? React.createElement('span', { className: 'spinner' }) : Icon({ name: 'sparkles', size: 14 }), generating ? 'Generating' : ' New Plan') }),
    status ? React.createElement('div', { className: 'stats mb-24' },
      StatCard({ label: 'Plan Status', value: status.active ? 'Active' : 'Idle' }),
      StatCard({ label: 'Last Plan', value: status.last_plan_date || '\u2014' }),
      StatCard({ label: 'Tasks Done', value: status.tasks_completed || 0 }),
    ) : null,
    generating ? Skeleton({ count: 2 }) : plan ? React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Weekly Growth Plan')),
      plan.plan ? React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.88rem', lineHeight: 1.6 } }, plan.plan) : React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.88rem' } }, JSON.stringify(plan, null, 2)),
    ) : EmptyState({ icon: 'agent', title: 'Growth Agent', text: 'Generate a personalized weekly growth plan based on your channel data and trends.', action: React.createElement('button', { className: 'btn btn-primary', onClick: generatePlan }, Icon({ name: 'sparkles', size: 16 }), ' Generate First Plan') }),
  );
}

// ═══════════════════════════════════════════════════════════════
//  PRICING & BILLING
// ═══════════════════════════════════════════════════════════════
function PricingPage() {
  const { user } = useAuth();
  const plans = [
    { id: 'free', name: 'Free', price: '$0', features: ['5 analyses/month', 'Basic dashboard', '1 monitored channel'], featured: false },
    { id: 'pro', name: 'Pro', price: '$19', features: ['Unlimited analyses', 'All features', '10 monitored channels', 'Weekly reports', 'Priority support'], featured: true },
    { id: 'business', name: 'Business', price: '$49', features: ['Everything in Pro', 'Unlimited channels', 'Team access (5 seats)', 'API access', 'Custom reports'], featured: false },
  ];
  return React.createElement('div', null,
    PageHeader({ title: 'Pricing', subtitle: 'Choose the plan that fits your channel' }),
    React.createElement('div', { className: 'grid-3' },
      plans.map(p => React.createElement('div', { key: p.id, className: 'card', style: p.featured ? { borderColor: 'var(--primary)', position: 'relative' } : {} },
        p.featured ? React.createElement('span', { className: 'badge badge-primary', style: { position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)' } }, 'Popular') : null,
        React.createElement('h3', { style: { fontSize: '1rem', fontWeight: 700, marginBottom: 4 } }, p.name),
        React.createElement('div', { style: { fontSize: '2rem', fontWeight: 800, marginBottom: 16 } }, p.price, React.createElement('span', { style: { fontSize: '.85rem', fontWeight: 400, color: 'var(--text-3)' } }, '/mo')),
        React.createElement('ul', { style: { listStyle: 'none', padding: 0, margin: '0 0 20px' } },
          p.features.map((f, i) => React.createElement('li', { key: i, style: { padding: '8px 0', fontSize: '.85rem', color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 8, borderBottom: i < p.features.length - 1 ? '1px solid var(--border)' : 'none' } },
            Icon({ name: 'check', size: 14 }), f))
        ),
        React.createElement('button', { className: `btn ${p.featured ? 'btn-primary' : 'btn-secondary'} w-full`, disabled: user?.plan === p.id },
          user?.plan === p.id ? 'Current Plan' : 'Upgrade'),
      ))
    ),
  );
}
function BillingPage() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(false);
  const openPortal = async () => {
    setLoading(true);
    try {
      const res = await api('/api/billing/portal', { method: 'POST', body: JSON.stringify({}) });
      if (res?.ok) { const d = await res.json(); if (d.url) window.location.href = d.url; }
    } catch { }
    finally { setLoading(false); }
  };
  return React.createElement('div', null,
    PageHeader({ title: 'Billing', subtitle: 'Manage your subscription' }),
    React.createElement('div', { className: 'card', style: { textAlign: 'center', padding: 48 } },
      Icon({ name: 'billing', size: 32 }),
      React.createElement('h2', { className: 'mt-16' }, 'Manage your billing'),
      React.createElement('p', { className: 'text-sm text-2 mt-8 mb-24' }, 'View invoices, update payment methods, or cancel your subscription via the billing portal.'),
      React.createElement('button', { className: 'btn btn-primary', onClick: openPortal, disabled: loading }, loading ? React.createElement('span', { className: 'spinner' }) : Icon({ name: 'mail', size: 16 }), ' Open Billing Portal'),
    ),
  );
}

// ═══════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════
function SettingsPage() {
  const { user, logout, api } = useAuth();
  const [keys, setKeys] = useState([]);
  const [newKeyName, setNewKeyName] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  useEffect(() => { api('/api/api-keys').then(async r => { if (r?.ok) setKeys(await r.json()); }); }, []);
  const createKey = async () => {
    if (!newKeyName.trim()) return;
    const res = await api('/api/api-keys', { method: 'POST', body: JSON.stringify({ name: newKeyName }) });
    if (res?.ok) { const k = await res.json(); setKeys(prev => [...prev, k]); setNewKeyName(''); }
  };
  const delKey = async (id) => { await api(`/api/api-keys/${id}`, { method: 'DELETE' }); setKeys(prev => prev.filter(k => k.id !== id)); };
  const delAccount = async () => { await api('/api/account', { method: 'DELETE' }); logout(); window.location.reload(); };
  return React.createElement('div', null,
    PageHeader({ title: 'Settings', subtitle: 'Manage your account and API keys' }),
    React.createElement('div', { className: 'card mb-16' },
      React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'Account')),
      React.createElement('div', { className: 'flex items-center gap-16' },
        React.createElement('div', { style: { width: 48, height: 48, borderRadius: 24, background: 'var(--primary-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' } }, Icon({ name: 'users', size: 20 })),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { className: 'font-semibold' }, user?.email || 'User'),
          React.createElement('div', { className: 'text-xs text-muted' }, 'Plan: ', (user?.plan || 'free').toUpperCase()),
        ),
        React.createElement('button', { className: 'btn btn-ghost btn-sm', onClick: logout }, Icon({ name: 'logout', size: 14 }), ' Sign Out'),
      ),
    ),
    React.createElement('div', { className: 'card mb-16' },
      React.createElement('div', { className: 'card-header' }, React.createElement('h3', null, 'API Keys')),
      keys.length ? keys.map(k => React.createElement('div', { key: k.id, className: 'flex items-center gap-12 p-16 border mb-8' },
        Icon({ name: 'key', size: 16 }),
        React.createElement('div', { style: { flex: 1 } },
          React.createElement('div', { className: 'font-semibold text-sm' }, k.name),
          React.createElement('div', { className: 'text-xs text-muted truncate' }, k.key || k.api_key),
        ),
        React.createElement('button', { className: 'icon-btn', onClick: () => delKey(k.id) }, Icon({ name: 'trash', size: 16 })),
      )) : React.createElement('p', { className: 'text-sm text-muted' }, 'No API keys yet.'),
      React.createElement('div', { className: 'flex gap-8 mt-16' },
        React.createElement('input', { className: 'input', value: newKeyName, onChange: e => setNewKeyName(e.target.value), placeholder: 'Key name...', onKeyDown: e => e.key === 'Enter' && createKey() }),
        React.createElement('button', { className: 'btn btn-primary', onClick: createKey }, Icon({ name: 'plus', size: 16 }), ' Create'),
      ),
    ),
    React.createElement('div', { className: 'card', style: { borderColor: 'rgba(239,68,68,.2)' } },
      React.createElement('div', { className: 'card-header' }, React.createElement('h3', { style: { color: 'var(--error)' } }, 'Danger Zone')),
      showDelete ? React.createElement('div', null,
        React.createElement('p', { className: 'text-sm text-2 mb-16' }, 'This will permanently delete your account and all data. This cannot be undone.'),
        React.createElement('div', { className: 'flex gap-8' },
          React.createElement('button', { className: 'btn btn-accent', onClick: delAccount }, 'Confirm Delete'),
          React.createElement('button', { className: 'btn btn-ghost', onClick: () => setShowDelete(false) }, 'Cancel'),
        ),
      ) : React.createElement('button', { className: 'btn btn-ghost', style: { color: 'var(--error)' }, onClick: () => setShowDelete(true) }, Icon({ name: 'trash', size: 16 }), ' Delete Account'),
    ),
  );
}

// ═══════════════════════════════════════════════════════════════
//  ONBOARDING
// ═══════════════════════════════════════════════════════════════
function OnboardingPage() {
  const { api } = useAuth();
  const [step, setStep] = useState(0);
  const [channelUrl, setChannelUrl] = useState('');
  const [niche, setNiche] = useState('');
  const [loading, setLoading] = useState(false);
  const steps = ['Welcome', 'Your Channel', 'Your Niche', 'Done'];
  const finish = async () => {
    setLoading(true);
    try {
      await api('/api/onboarding/status', { method: 'POST', body: JSON.stringify({ channel_url: channelUrl, niche, completed: true }) });
      localStorage.setItem('ccr_onboarding_done', '1');
      window.location.hash = 'dashboard';
      window.location.reload();
    } catch { }
    finally { setLoading(false); }
  };
  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card', style: { maxWidth: 500 } },
      React.createElement('div', { className: 'flex items-center gap-8 mb-24' },
        steps.map((s, i) => React.createElement('div', { key: i, style: { flex: 1, height: 4, borderRadius: 2, background: i <= step ? 'var(--primary)' : 'var(--bg-elevated)' } }))
      ),
      step === 0 ? React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { className: 'auth-logo' }, Icon({ name: 'youtube', size: 24 })),
        React.createElement('h1', null, 'Welcome to PopSearch'),
        React.createElement('p', { className: 'subtitle', style: { marginBottom: 24 } }, "Your AI-powered YouTube growth toolkit. Let's set things up."),
        React.createElement('button', { className: 'btn btn-primary w-full', onClick: () => setStep(1) }, Icon({ name: 'arrowRight', size: 16 }), ' Get Started'),
      ) : step === 1 ? React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: '1.2rem' } }, 'Your Channel'),
        React.createElement('p', { className: 'subtitle', style: { marginBottom: 24 } }, 'Paste your YouTube channel URL to get started.'),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Channel URL'),
          React.createElement('input', { className: 'input', value: channelUrl, onChange: e => setChannelUrl(e.target.value), placeholder: 'https://youtube.com/@yourchannel', autoFocus: true }),
        ),
        React.createElement('button', { className: 'btn btn-primary w-full', onClick: () => setStep(2), disabled: !channelUrl.trim() }, 'Continue'),
      ) : step === 2 ? React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: '1.2rem' } }, 'Your Niche'),
        React.createElement('p', { className: 'subtitle', style: { marginBottom: 24 } }, 'What topics does your channel cover?'),
        React.createElement('div', { className: 'form-group' },
          React.createElement('label', null, 'Niche / Topic'),
          React.createElement('input', { className: 'input', value: niche, onChange: e => setNiche(e.target.value), placeholder: 'e.g. tech, gaming, cooking', autoFocus: true, onKeyDown: e => e.key === 'Enter' && finish() }),
        ),
        React.createElement('button', { className: 'btn btn-primary w-full', onClick: finish, disabled: loading || !niche.trim() }, loading ? React.createElement('span', { className: 'spinner' }) : 'Finish'),
      ) : null,
    ),
  );
}

// ═══════════════════════════════════════════════════════════════
//  APP SHELL
// ═══════════════════════════════════════════════════════════════
function AppShell({ page, setPage }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(isDark());
  const toggleTheme = () => {
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    document.documentElement.setAttribute('data-theme', next ? '' : 'light');
    localStorage.setItem('ccr_theme', next ? 'dark' : 'light');
    Object.keys(chartInstances).forEach(k => { if (chartInstances[k]) chartInstances[k].destroy(); });
  };
  useEffect(() => {
    const saved = localStorage.getItem('ccr_theme');
    if (saved) { document.documentElement.setAttribute('data-theme', saved === 'dark' ? '' : 'light'); setIsDarkTheme(saved === 'dark'); }
  }, []);
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', section: 'Main' },

    { id: 'ideas', label: 'Idea Generator', icon: 'ideas', section: 'Content' },
    { id: 'trends', label: 'Trend Alerts', icon: 'trends', section: 'Content' },
    { id: 'algo-shift', label: 'Algo Shifts', icon: 'algo', section: 'Content' },
    { id: 'editing', label: 'Editing Coach', icon: 'editing', section: 'Content' },
    { id: 'agent', label: 'Growth Agent', icon: 'agent', section: 'Content' },
    { id: 'pricing', label: 'Pricing', icon: 'pricing', section: 'Settings' },
    { id: 'billing', label: 'Billing', icon: 'billing', section: 'Settings' },
    { id: 'settings', label: 'Settings', icon: 'settings', section: 'Settings' },
  ];
  const renderPage = () => {
    const pages = { dashboard: DashboardPage, ideas: IdeasPage, trends: TrendAlertsPage, 'algo-shift': AlgoShiftPage, editing: EditingPage, agent: AgentPage, pricing: PricingPage, billing: BillingPage, settings: SettingsPage, onboarding: OnboardingPage };
    const C = pages[page] || DashboardPage;
    return React.createElement(C);
  };
  return React.createElement('div', { className: 'app-layout' },
    React.createElement('aside', { className: `sidebar${sidebarOpen ? ' open' : ''}` },
      React.createElement('div', { className: 'sidebar-logo' },
        React.createElement(Icon, { name: 'youtube', size: 24 }),
        React.createElement('span', null, 'PopSearch'),
      ),
      React.createElement('nav', { className: 'sidebar-nav' },
        ...['Main', 'Content', 'Settings'].map(section =>
          React.createElement(React.Fragment, { key: section },
            React.createElement('div', { className: 'nav-section' }, section),
            ...navItems.filter(n => n.section === section).map(item =>
              React.createElement('button', { key: item.id, className: `nav-item${page === item.id ? ' active' : ''}`, onClick: () => { setPage(item.id); setSidebarOpen(false); window.location.hash = item.id; } },
                Icon({ name: item.icon, size: 18 }), ' ', item.label,
              ),
            ),
          ),
        ),
      ),
      React.createElement('div', { className: 'sidebar-footer' },
        React.createElement('div', { className: 'plan-badge' },
          React.createElement('span', { className: 'plan-name' }, Icon({ name: 'pricing', size: 14 }), (user?.plan || 'free').toUpperCase()),
          React.createElement('span', { className: 'upgrade', onClick: () => { setPage('pricing'); window.location.hash = 'pricing'; } }, 'Upgrade'),
        ),
      ),
    ),
    React.createElement('div', { className: 'main-area' },
      React.createElement('header', { className: 'topbar' },
        React.createElement('button', { className: 'icon-btn menu-toggle', onClick: () => setSidebarOpen(!sidebarOpen) },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 22, height: 22 },
            React.createElement('line', { x1: 3, y1: 6, x2: 21, y2: 6 }), React.createElement('line', { x1: 3, y1: 12, x2: 21, y2: 12 }), React.createElement('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
          ),
        ),
        React.createElement('div', { className: 'topbar-search' },
          Icon({ name: 'search', size: 16 }),
          React.createElement('input', { placeholder: 'Search pages...', onKeyDown: e => {
            if (e.key === 'Enter') {
              const q = e.target.value.toLowerCase().trim();
              const found = navItems.find(n => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
              if (found) { setPage(found.id); window.location.hash = found.id; }
            }
          } }),
        ),
        React.createElement('div', { className: 'topbar-actions' },
          React.createElement('button', { className: 'icon-btn', onClick: toggleTheme, title: 'Toggle theme' }, Icon({ name: isDarkTheme ? 'moon' : 'sun', size: 18 })),
          React.createElement('button', { className: 'icon-btn', onClick: logout, title: 'Sign out' }, Icon({ name: 'logout', size: 18 })),
        ),
      ),
      React.createElement('main', { className: 'page-content' }, renderPage()),
    ),
    sidebarOpen ? React.createElement('div', { className: 'sidebar-overlay', onClick: () => setSidebarOpen(false) }) : null,
  );
}

// ═══════════════════════════════════════════════════════════════
//  ROUTER
// ═══════════════════════════════════════════════════════════════
function App() {
  const { user } = useAuth();
  const [page, setPage] = useState('dashboard');
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      const valid = ['dashboard', 'ideas', 'trends', 'algo-shift', 'editing', 'agent', 'pricing', 'billing', 'settings', 'onboarding', 'login', 'register'];
      if (valid.includes(hash)) setPage(hash);
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  useEffect(() => {
    if (user && !localStorage.getItem('ccr_onboarding_done') && page !== 'onboarding') {
      localStorage.setItem('ccr_onboarding_done', '1');
      window.location.hash = 'onboarding';
      setPage('onboarding');
    }
  }, [user, page]);
  if (!user) {
    if (page === 'register') return React.createElement(RegisterPage);
    return React.createElement(LoginPage);
  }
  return React.createElement(AppShell, { page, setPage });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(AuthProvider, null,
    React.createElement(ToastProvider, null,
      React.createElement(App),
    ),
  ),
);
