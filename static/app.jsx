/* global React, ReactDOM, Chart */
const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;

const AuthContext = createContext(null);

function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem('ccr_user') || 'null'));
  const [token, setToken] = useState(() => localStorage.getItem('ccr_token') || '');

  const login = useCallback((t, u) => {
    setToken(t); setUser(u);
    localStorage.setItem('ccr_token', t);
    localStorage.setItem('ccr_user', JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setToken(''); setUser(null);
    localStorage.removeItem('ccr_token');
    localStorage.removeItem('ccr_user');
  }, []);

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

function fmtNum(n) {
  if (n == null) return '\u2014';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

const PLATFORM_CONFIG = {
  youtube: { icon: '\u25B6', color: '#ff0000', bg: 'rgba(255,0,0,.15)' },
  reddit: { icon: 'R', color: '#ff4500', bg: 'rgba(255,69,0,.15)' },
  twitter: { icon: 'X', color: '#1da1f2', bg: 'rgba(29,161,242,.15)' },
  twitch: { icon: '\uD83C\uDFAE', color: '#a970ff', bg: 'rgba(169,112,255,.15)' },
  hn: { icon: 'Y', color: '#f60', bg: 'rgba(255,102,0,.15)' },
  trends: { icon: '\uD83D\uDCC8', color: '#4285f4', bg: 'rgba(66,133,244,.15)' },
  rss: { icon: '\uD83D\uDCE1', color: '#ffa500', bg: 'rgba(255,165,0,.15)' },
  instagram: { icon: '\uD83D\uDCF7', color: '#e1306c', bg: 'rgba(225,48,108,.15)' },
  tiktok: { icon: '\uD83C\uDFA7', color: '#00f2ea', bg: 'rgba(0,242,234,.15)' },
};

function getPlatformConfig(p) { return PLATFORM_CONFIG[p] || { icon: '?', color: '#888', bg: 'rgba(128,128,128,.15)' }; }

function isDark() { return (document.documentElement.getAttribute('data-theme') || 'dark') === 'dark'; }

const chartInstances = {};
function safeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new Chart(canvas, config);
}

function Skeleton({ count = 3 }) {
  return React.createElement('div', null,
    Array.from({ length: count }, (_, i) =>
      React.createElement('div', { key: i, className: 'card' },
        React.createElement('div', { className: 'skeleton', style: { height: 24, width: '60%', marginBottom: 8 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 24, width: '80%', marginBottom: 8 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 100, width: '100%' } }),
      )
    ),
  );
}

function LoadingBar({ active }) {
  return React.createElement('div', { className: `loading-bar${active ? ' active' : ''}` });
}

function ErrorBox({ message }) {
  if (!message) return null;
  return React.createElement('div', { className: 'error-box', style: { display: 'block' } }, message);
}

function StatCard({ label, value, change, changeDir = 'up' }) {
  return React.createElement('div', { className: 'stat' },
    React.createElement('div', { className: 'label' }, label),
    React.createElement('div', { className: 'value' }, fmtNum(value)),
    change ? React.createElement('div', { className: `change ${changeDir}`, style: { fontSize: '.78rem', fontWeight: 600, marginTop: 4 } }, change) : null,
  );
}

function ContentItem({ item }) {
  const cfg = getPlatformConfig(item.platform);
  const m = item.raw_metrics || {};
  return React.createElement('a', { href: item.url, target: '_blank', className: 'content-item' },
    React.createElement('div', { className: 'platform-badge', style: { background: cfg.bg, color: cfg.color } }, cfg.icon),
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { style: { fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.9rem' } }, item.title),
      React.createElement('div', { style: { display: 'flex', gap: 12, fontSize: '.8rem', color: 'var(--text3)', flexWrap: 'wrap' } },
        React.createElement('span', null, `\uD83D\uDCCD ${item.source || item.platform}`),
        React.createElement('span', null, `\uD83D\uDCCA ${fmtNum(item.engagement_score)}`),
        m.views ? React.createElement('span', null, `\uD83D\uDC41 ${fmtNum(m.views)}`) : null,
        m.likes ? React.createElement('span', null, `\uD83D\uDC4D ${fmtNum(m.likes)}`) : null,
        React.createElement('span', { className: `tag` }, item.classification || 'new'),
      ),
    ),
  );
}

// ── Auth Pages ─────────────────────────────────────────────────────────
function LoginPage() {
  const { login, api } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { login(d.access_token, d.user); }
      else { setErr(d.detail || 'Login failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('form', { onSubmit: handleSubmit, className: 'auth-card' },
      React.createElement('h1', null, 'Creator Content Radar'),
      React.createElement('p', { className: 'subtitle' }, 'Sign in to your account'),
      err ? React.createElement('div', { className: 'error', style: { display: 'block' } }, err) : null,
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Email'),
        React.createElement('input', { className: 'input', type: 'email', value: email, onChange: e => setEmail(e.target.value), placeholder: 'you@example.com', required: true }),
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Password'),
        React.createElement('input', { className: 'input', type: 'password', value: password, onChange: e => setPassword(e.target.value), placeholder: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022', required: true }),
      ),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary', style: { width: '100%', justifyContent: 'center' }, disabled: loading },
        loading ? 'Signing in...' : 'Sign In',
      ),
      React.createElement('p', { style: { textAlign: 'center', marginTop: 16, fontSize: '.85rem', color: 'var(--text3)' } },
        "Don't have an account? ",
        React.createElement('a', { href: '#register', style: { color: 'var(--accent)', textDecoration: 'none' } }, 'Register'),
      ),
      React.createElement('p', { style: { textAlign: 'center', marginTop: 12, fontSize: '.85rem', color: 'var(--text3)' } },
        React.createElement('a', { href: '#pricing', style: { color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 } }, 'View Pricing & Plans'),
      ),
    ),
  );
}

function RegisterPage() {
  const { login, api } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault(); setErr(''); setLoading(true);
    try {
      const res = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { login(d.access_token, d.user); }
      else { setErr(d.detail || 'Registration failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('form', { onSubmit: handleSubmit, className: 'auth-card' },
      React.createElement('h1', null, 'Create Account'),
      React.createElement('p', { className: 'subtitle' }, 'Join Creator Content Radar'),
      err ? React.createElement('div', { className: 'error', style: { display: 'block' } }, err) : null,
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Email'),
        React.createElement('input', { className: 'input', type: 'email', value: email, onChange: e => setEmail(e.target.value), placeholder: 'you@example.com', required: true }),
      ),
      React.createElement('div', { className: 'form-group' },
        React.createElement('label', null, 'Password'),
        React.createElement('input', { className: 'input', type: 'password', value: password, onChange: e => setPassword(e.target.value), placeholder: 'Minimum 8 characters', required: true, minLength: 8 }),
      ),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary', style: { width: '100%', justifyContent: 'center' }, disabled: loading },
        loading ? 'Creating account...' : 'Create Account',
      ),
      React.createElement('p', { style: { textAlign: 'center', marginTop: 16, fontSize: '.85rem', color: 'var(--text3)' } },
        'Already have an account? ',
        React.createElement('a', { href: '#login', style: { color: 'var(--accent)', textDecoration: 'none' } }, 'Sign In'),
      ),
    ),
  );
}

// ── Pricing Page ───────────────────────────────────────────────────────
function PricingPage() {
  const { api, user } = useAuth();
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const res = await api('/api/billing/usage');
      if (!res) return;
      const d = await res.json();
      if (res.ok) setUsage(d);
    })();
  }, [api, user]);

  const openCheckout = async (plan) => {
    const res = await api('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
    if (!res) return;
    const d = await res.json();
    if (d.url) window.location.href = d.url;
  };

  const plans = [
    { id: 'free', name: 'Free', price: '$0', desc: 'Perfect for getting started', analyses: '3 analyses/mo', exports: 'No', api: 'No', support: 'Community', features: ['Basic channel analysis', 'Competitor discovery', 'Cross-platform content search', 'Email support'] },
    { id: 'pro', name: 'Pro', price: '$19', desc: 'For serious creators', analyses: '50 analyses/mo', exports: 'CSV + PDF', api: 'No', support: 'Priority email', features: ['Everything in Free', 'Export reports (CSV/PDF)', 'Content idea generator', 'Competitor monitoring alerts', 'Email digests', 'Content calendar'] },
    { id: 'business', name: 'Business', price: '$49', desc: 'For teams & agencies', analyses: 'Unlimited', exports: 'CSV + PDF + Shareable links', api: 'Full API access', support: 'Dedicated support', features: ['Everything in Pro', 'Unlimited analyses', 'API keys for integrations', 'Multi-channel management', 'SEO scorecards', 'A/B thumbnail testing', 'Trend alerts', 'White-label reports'] },
  ];

  return React.createElement('div', null,
    React.createElement('div', { style: { textAlign: 'center', marginBottom: 32 } },
      React.createElement('h1', { style: { fontSize: '2rem', fontWeight: 800, marginBottom: 8 } }, 'Choose Your Plan'),
      React.createElement('p', { style: { color: 'var(--text3)', fontSize: '1rem', maxWidth: 500, margin: '0 auto' } }, 'Unlock the full power of Creator Content Radar. Scale your content strategy with AI-powered insights.'),
    ),
    React.createElement('div', { className: 'stats', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 } },
      plans.map((plan) => {
        const isCurrent = usage?.plan === plan.id;
        return React.createElement('div', {
          key: plan.id,
          className: 'card',
          style: { display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', border: isCurrent ? '2px solid var(--primary)' : '1px solid var(--border)' }
        },
          plan.id === 'pro' ? React.createElement('div', { style: { position: 'absolute', top: 12, right: 12, background: 'var(--primary)', color: '#fff', padding: '4px 12px', borderRadius: 999, fontSize: '.7rem', fontWeight: 700, textTransform: 'uppercase' } }, 'Popular') : null,
          React.createElement('h2', { style: { fontSize: '1.2rem', fontWeight: 700, marginBottom: 4 } }, plan.name),
          React.createElement('div', { style: { fontSize: '2.5rem', fontWeight: 800, marginBottom: 4 } }, plan.price, React.createElement('span', { style: { fontSize: '1rem', fontWeight: 400, color: 'var(--text3)' } }, '/mo')),
          React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem', marginBottom: 16 } }, plan.desc),
          React.createElement('div', { style: { fontSize: '.9rem', color: 'var(--text2)', marginBottom: 16, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 'var(--radius)', textAlign: 'center', fontWeight: 600 } }, plan.analyses),
          React.createElement('div', { style: { flex: 1 } },
            plan.features.map((f, i) =>
              React.createElement('div', { key: i, style: { padding: '6px 0', fontSize: '.85rem', color: 'var(--text2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 } },
                React.createElement('span', { style: { color: 'var(--success)' } }, '\u2713'), f,
              )
            ),
          ),
          React.createElement('div', { style: { marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' } },
            isCurrent ? React.createElement('button', { className: 'btn btn-ghost', style: { flex: 1, justifyContent: 'center' }, disabled: true }, 'Current Plan') :
            plan.id === 'free' ? React.createElement('button', { className: 'btn btn-ghost', style: { flex: 1, justifyContent: 'center' }, onClick: () => window.location.hash = 'login' }, 'Get Started') :
            React.createElement('button', { className: plan.id === 'pro' ? 'btn btn-primary' : 'btn btn-accent', style: { flex: 1, justifyContent: 'center' }, onClick: () => openCheckout(plan.id) }, 'Subscribe'),
          ),
          React.createElement('div', { style: { marginTop: 8, fontSize: '.75rem', color: 'var(--text3)', textAlign: 'center' } },
            plan.exports !== 'No' ? `\u2713 ${plan.exports}` : null,
            plan.api !== 'No' ? ` \u00B7 ${plan.api}` : null,
            ` \u00B7 ${plan.support}`,
          ),
        );
      }),
    ),
    !user ? React.createElement('div', { className: 'card', style: { textAlign: 'center', padding: 24 } },
      React.createElement('p', { style: { color: 'var(--text3)', marginBottom: 12 } }, 'Already have an account?'),
      React.createElement('button', { className: 'btn btn-primary', onClick: () => window.location.hash = 'login' }, 'Sign In'),
    ) : null,
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────
function DashboardPage() {
  const { api } = useAuth();
  const [url, setUrl] = useState(() => localStorage.getItem('ccr_last_url') || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [jobId, setJobId] = useState(null);

  const load = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setData(null); setJobId(null);
    try {
      localStorage.setItem('ccr_last_url', url);
      const res = await api('/dashboard', { method: 'POST', body: JSON.stringify({ channel_url: url, topic: '' }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setData(d); setTimeout(() => renderCharts(d), 100); }
      else { setErr(d.detail || 'Failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const renderCharts = (d) => {
    const tDark = isDark();
    const gridColor = tDark ? '#303030' : '#e5e5e5';
    const tickColor = tDark ? '#aaa' : '#666';
    if (d.trends?.interest_over_time?.length) {
      safeChart('trend-chart', {
        type: 'line',
        data: {
          labels: d.trends.interest_over_time.map(x => x.label),
          datasets: [{ label: d.trends.topic || 'Interest', data: d.trends.interest_over_time.map(x => x.value), borderColor: '#ff4444', backgroundColor: 'rgba(255,68,68,0.1)', fill: true, tension: 0.3, pointRadius: 3, borderWidth: 2 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: gridColor }, ticks: { color: tickColor, maxTicksLimit: 8 } }, y: { grid: { color: gridColor }, ticks: { color: tickColor } } } },
      });
    }
  };

  const p = data?.profile;
  const c = data?.competitors;

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 } },
      React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700 } }, 'Dashboard'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem' } }, 'Channel overview & performance'),
      ),
      React.createElement('div', { className: 'topbar-search', style: { maxWidth: 320, margin: 0 } },
        React.createElement('input', { type: 'text', placeholder: 'YouTube URL or @handle...', value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && load() }),
        React.createElement('button', { className: 'icon-btn', onClick: load }, '\u25B6'),
      ),
    ),
    React.createElement(LoadingBar, { active: loading }),
    React.createElement(ErrorBox, { message: err }),
    !data && !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCC8'),
      React.createElement('p', null, 'Paste a YouTube channel URL above to see your dashboard'),
      React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 12 }, onClick: () => window.location.hash = 'pricing' }, 'View Plans'),
    ) : null,
    data && p ? React.createElement('div', null,
      React.createElement('div', { className: 'stats' },
        React.createElement(StatCard, { label: 'Subscribers', value: p.subscriber_count, change: p.channel_tier }),
        React.createElement(StatCard, { label: 'Total Views', value: p.view_count, change: p.niche }),
        React.createElement(StatCard, { label: 'Videos', value: p.video_count, change: p.upload_frequency }),
        React.createElement(StatCard, { label: 'Avg Views', value: Math.round(p.average_views_per_video), change: `${p.engagement_rate?.toFixed(1) || 0}% eng.` }),
        React.createElement(StatCard, { label: 'Growth', value: p.growth_potential || 'N/A', change: p.channel_tier }),
        React.createElement(StatCard, { label: 'Sources', value: data.total_sources_checked || 0, change: 'platforms' }),
      ),
      data.cross_platform_content?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83C\uDF10'),
          React.createElement('h2', null, `Cross-Platform Content (${data.cross_platform_content.length})`),
        ),
        React.createElement('div', { className: 'content-list' },
          data.cross_platform_content.slice(0, 8).map((item, i) => React.createElement(ContentItem, { key: i, item })),
        ),
      ) : null,
      c?.competitors?.length ? React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { fontSize: '.9rem', color: 'var(--text2)', marginBottom: 10 } }, `Top Competitors in ${p.niche || 'your niche'}`),
        React.createElement('div', { className: 'competitor-grid' },
          c.competitors.slice(0, 6).map((co, i) =>
            React.createElement('div', { key: i, className: 'competitor-card' },
              React.createElement('div', { className: 'name' }, co.title),
              React.createElement('div', { className: 'note' }, co.relevance_note || ''),
              React.createElement('div', { className: 'subs' }, `${fmtNum(co.subscriber_count)} subs`),
            )
          ),
        ),
      ) : null,
      p.content_recommendations?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,68,68,.15)', color: 'var(--primary)' } }, '\uD83D\uDCA1'),
          React.createElement('h2', null, 'AI Content Recommendations'),
        ),
        React.createElement('ul', { className: 'rec-list' },
          p.content_recommendations.map((r, i) => React.createElement('li', { key: i }, r)),
        ),
      ) : null,
    ) : null,
  );
}

// ── Channel Analysis with Job Progress ────────────────────────────────
function AnalyzePage() {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [job, setJob] = useState(null);
  const intervalRef = useRef(null);

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setResult(null); setJob(null);
    try {
      const res = await api('/api/analyze/async', { method: 'POST', body: JSON.stringify({ channel_url: url, topic: '' }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setResult(d);
        pollJob(d.job_id);
      } else { setErr(d.detail || 'Analysis failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const pollJob = (jobId) => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(async () => {
      try {
        const res = await api(`/api/jobs/${jobId}`);
        if (!res) { clearInterval(intervalRef.current); return; }
        const j = await res.json();
        setJob(j);
        if (j.status === 'completed' || j.status === 'failed') {
          clearInterval(intervalRef.current);
        }
      } catch { /* ignore */ }
    }, 2000);
  };

  useEffect(() => { return () => { if (intervalRef.current) clearInterval(intervalRef.current); }; }, []);

  const steps = [
    { pct: 5, label: 'Queued...' },
    { pct: 15, label: 'Fetching channel data...' },
    { pct: 30, label: 'Analyzing channel...' },
    { pct: 50, label: 'Finding competitors...' },
    { pct: 70, label: 'Gathering cross-platform content...' },
    { pct: 85, label: 'Building dashboard...' },
    { pct: 95, label: 'Finalizing...' },
    { pct: 100, label: 'Complete!' },
  ];

  const currentStep = job ? steps.findIndex(s => s.pct >= job.progress_pct) : -1;
  const currentLabel = job ? job.step || steps[Math.max(0, currentStep)]?.label || 'Processing...' : '';

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Channel Analysis'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Deep dive into your channel\u2019s performance'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 600 } },
        React.createElement('input', { className: 'input', placeholder: 'YouTube URL, @handle, or channel ID...', value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && analyze() }),
        React.createElement('button', { className: 'btn btn-primary', onClick: analyze, disabled: loading }, loading ? 'Analyzing...' : 'Analyze'),
      ),
      React.createElement(LoadingBar, { active: loading || (job && job.status === 'running') }),
      React.createElement(ErrorBox, { message: err }),

      job ? React.createElement('div', { className: 'card', style: { marginTop: 12 } },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
          React.createElement('span', { style: { fontWeight: 600, fontSize: '.85rem' } }, 'Analysis Progress'),
          React.createElement('span', { style: { color: 'var(--text3)', fontSize: '.8rem' } }, `${job.progress_pct}%`),
        ),
        React.createElement('div', { style: { width: '100%', height: 8, background: 'var(--bg3)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 } },
          React.createElement('div', { style: { width: `${job.progress_pct}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary), var(--accent))', borderRadius: 4, transition: 'width .5s ease' } }),
        ),
        React.createElement('p', { style: { color: 'var(--text2)', fontSize: '.85rem' } },
          job.status === 'completed' ? '\u2705 Analysis complete!' :
          job.status === 'failed' ? `\u274C Failed: ${job.error || 'Unknown error'}` :
          `\u2699\uFE0F ${currentLabel}`,
        ),
        job.status === 'completed' ? React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 8, fontSize: '.8rem', padding: '6px 16px' }, onClick: () => window.location.hash = 'reports' }, 'View Reports') : null,
      ) : null,

      result && !job ? React.createElement('div', { className: 'insight' },
        React.createElement('h3', null, '\u2699\uFE0F Analysis Submitted'),
        React.createElement('p', null, `Job ID: ${result.job_id}`),
      ) : null,

      !result && !loading && !job ? React.createElement('div', { className: 'empty-state' },
        React.createElement('div', { className: 'emoji' }, '\uD83D\uDD0D'),
        React.createElement('p', null, 'Enter a channel URL to begin analysis'),
      ) : null,
    ),
  );
}

// ── Competitors ───────────────────────────────────────────────────────
function CompetitorsPage() {
  const { api } = useAuth();
  const [channelId, setChannelId] = useState('');
  const [competitors, setCompetitors] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const find = async () => {
    if (!channelId.trim()) return;
    setLoading(true); setErr(''); setCompetitors(null);
    try {
      const res = await api('/find-competitors', { method: 'POST', body: JSON.stringify({ channel_id: channelId }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setCompetitors(d); }
      else { setErr(d.detail || 'Search failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const watchCompetitor = async (ch) => {
    await api('/api/watched-competitors', { method: 'POST', body: JSON.stringify({ channel_id: ch.channel_id, channel_title: ch.title, subscriber_count: ch.subscriber_count }) });
    alert(`Watching ${ch.title}`);
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Competitor Analysis'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Discover and analyze competing channels'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 500 } },
        React.createElement('input', { className: 'input', placeholder: 'YouTube channel ID...', value: channelId, onChange: e => setChannelId(e.target.value), onKeyDown: e => e.key === 'Enter' && find() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: find, disabled: loading }, loading ? 'Searching...' : 'Search'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    competitors?.length ? React.createElement('div', null,
      React.createElement('div', { className: 'competitor-grid' },
        competitors.map((co, i) =>
          React.createElement('div', { key: i, className: 'competitor-card' },
            React.createElement('div', { className: 'name' }, co.title),
            React.createElement('div', { className: 'note' }, co.relevance_note || ''),
            React.createElement('div', { className: 'subs' }, `${fmtNum(co.subscriber_count)} subs \u00B7 ${co.engagement_rate?.toFixed(1) || '?'}% eng`),
            React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '4px 8px', fontSize: '.78rem' }, onClick: () => watchCompetitor(co) }, '\uD83D\uDC40 Watch'),
          )
        ),
      ),
    ) : null,
    !competitors && !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDC65'),
      React.createElement('p', null, 'Enter a channel ID to discover competitors'),
    ) : null,
  );
}

// ── Content Discovery ─────────────────────────────────────────────────
function DiscoverPage() {
  const { api } = useAuth();
  const [topic, setTopic] = useState('');
  const [channelId, setChannelId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [sources, setSources] = useState({ trends: true, twitter: true, twitch: true, hn: true });
  const [activeTab, setActiveTab] = useState('all');

  const search = async () => {
    if (!topic.trim() || !channelId.trim()) { setErr('Enter both topic and channel ID'); return; }
    setLoading(true); setErr(''); setData(null);
    try {
      const res = await api('/multi-source-search', {
        method: 'POST',
        body: JSON.stringify({ channel_id: channelId, topic, include_trends: sources.trends, include_twitter: sources.twitter, include_twitch: sources.twitch, include_hn: sources.hn, include_rss: true, include_tiktok: true, include_instagram: true }),
      });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setData(d); setActiveTab('all'); setTimeout(() => renderCharts(d), 100); }
      else { setErr(d.detail || 'Search failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const renderCharts = (d) => {
    if (!d.trends?.interest_over_time?.length) return;
    const tDark = isDark();
    safeChart('disc-trend-chart', {
      type: 'line',
      data: {
        labels: d.trends.interest_over_time.map(x => x.label),
        datasets: [{ label: 'Interest', data: d.trends.interest_over_time.map(x => x.value), borderColor: '#3ea6ff', backgroundColor: 'rgba(62,166,255,0.1)', fill: true, tension: 0.3, borderWidth: 2 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: tDark ? '#303030' : '#e5e5e5' }, ticks: { color: tDark ? '#aaa' : '#666', maxTicksLimit: 10 } }, y: { grid: { color: tDark ? '#303030' : '#e5e5e5' }, ticks: { color: tDark ? '#aaa' : '#666' } } } },
    });
  };

  const results = data?.cross_platform_content || [];
  const groups = {};
  results.forEach(r => { if (!groups[r.platform]) groups[r.platform] = []; groups[r.platform].push(r); });

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Content Discovery'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Cross-platform search across all sources'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        React.createElement('input', { className: 'input', style: { flex: 1, minWidth: 200 }, placeholder: 'Channel ID...', value: channelId, onChange: e => setChannelId(e.target.value) }),
        React.createElement('input', { className: 'input', style: { flex: 2, minWidth: 200 }, placeholder: 'Search topic...', value: topic, onChange: e => setTopic(e.target.value), onKeyDown: e => e.key === 'Enter' && search() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: search, disabled: loading }, loading ? 'Searching...' : 'Search All'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap', fontSize: '.85rem', color: 'var(--text3)' } },
        Object.entries(sources).map(([k, v]) =>
          React.createElement('label', { key: k, style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
            React.createElement('input', { type: 'checkbox', checked: v, onChange: () => setSources(s => ({ ...s, [k]: !s[k] })) }),
            ` ${k.charAt(0).toUpperCase() + k.slice(1)}`,
          )
        ),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    data ? React.createElement('div', null,
      React.createElement('div', { className: 'stats' },
        ...Object.entries(groups).map(([k, v]) => React.createElement(StatCard, { key: k, label: k, value: v.length, change: 'items' })),
        React.createElement(StatCard, { label: 'total', value: results.length, change: 'sources' }),
      ),
      data.trends?.interest_over_time?.length > 1 ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83D\uDCC8'),
          React.createElement('h2', null, `Google Trends: "${topic}"`),
        ),
        React.createElement('div', { className: 'chart-container' }, React.createElement('canvas', { id: 'disc-trend-chart' })),
      ) : null,
      results.length ? React.createElement('div', null,
        React.createElement('div', { className: 'tabs' },
          React.createElement('button', { className: `tab${activeTab === 'all' ? ' active' : ''}`, onClick: () => setActiveTab('all') }, 'All ', React.createElement('span', { className: 'tab-count' }, results.length)),
          Object.entries(groups).map(([k, v]) =>
            React.createElement('button', { key: k, className: `tab${activeTab === k ? ' active' : ''}`, onClick: () => setActiveTab(k) }, k, ' ', React.createElement('span', { className: 'tab-count' }, v.length)),
          ),
        ),
        React.createElement('div', { className: 'content-list' },
          (activeTab === 'all' ? results : groups[activeTab] || []).map((item, i) => React.createElement(ContentItem, { key: i, item })),
        ),
      ) : React.createElement('div', { className: 'empty-state' },
        React.createElement('div', { className: 'emoji' }, '\uD83D\uDD0D'),
        React.createElement('p', null, `No results found for "${topic}"`),
      ),
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83C\uDF0D'),
      React.createElement('p', null, 'Search any topic to discover content across 7+ platforms'),
    ) : null,
  );
}

// ── Billing/Usage ─────────────────────────────────────────────────────
function BillingPage() {
  const { api, user } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await api('/api/billing/usage');
      if (!res) return;
      const d = await res.json();
      if (res.ok) setUsage(d);
      setLoading(false);
    })();
  }, [api]);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const res = await api('/api/billing/portal', { method: 'POST' });
      if (!res) return;
      const d = await res.json();
      if (d.url) window.location.href = d.url;
    } catch { /* ignore */ }
    finally { setPortalLoading(false); }
  };

  const openCheckout = async (plan) => {
    const res = await api('/api/billing/checkout', { method: 'POST', body: JSON.stringify({ plan }) });
    if (!res) return;
    const d = await res.json();
    if (d.url) window.location.href = d.url;
  };

  if (loading) return React.createElement(Skeleton, { count: 2 });

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Billing & Usage'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Manage your subscription and view usage'),
    usage ? React.createElement('div', { className: 'stats' },
      React.createElement(StatCard, { label: 'Plan', value: usage.plan }),
      React.createElement(StatCard, { label: 'Analyses Used', value: usage.analyses_this_month }),
      React.createElement(StatCard, { label: 'Monthly Limit', value: usage.limit === -1 ? '\u221E' : usage.limit }),
      React.createElement(StatCard, { label: 'Remaining', value: usage.remaining === -1 ? '\u221E' : usage.remaining }),
    ) : null,
    React.createElement('div', { className: 'card' },
      React.createElement('h3', { style: { marginBottom: 12 } }, 'Subscription Plans'),
      React.createElement('div', { className: 'stats', style: { marginBottom: 0 } },
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Free'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, '3 analyses/mo'),
          usage?.plan === 'free' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, disabled: true }, 'Current'),
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Pro - $19/mo'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, '50 analyses/mo'),
          usage?.plan === 'pro' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, onClick: () => openCheckout('pro') }, 'Upgrade'),
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Business - $49/mo'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, 'Unlimited'),
          usage?.plan === 'business' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, onClick: () => openCheckout('business') }, 'Upgrade'),
        ),
      ),
      usage?.plan !== 'free' ? React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 12 }, onClick: openPortal, disabled: portalLoading },
        portalLoading ? 'Loading...' : 'Manage Subscription (Stripe Portal)',
      ) : null,
    ),
  );
}

// ── Content Idea Generator ────────────────────────────────────────────
function IdeasPage() {
  const { api } = useAuth();
  const [topic, setTopic] = useState('');
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true); setErr(''); setIdeas(null);
    try {
      const res = await api('/api/ideas/generate', { method: 'POST', body: JSON.stringify({ topic }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setIdeas(d); }
      else { setErr(d.detail || 'Generation failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const saveIdea = async (idea) => {
    await api('/api/ideas/save', { method: 'POST', body: JSON.stringify({
      topic, title: idea.title, seo_keywords: JSON.stringify(idea.seo_keywords || []),
      thumbnail_ideas: JSON.stringify(idea.thumbnail_ideas || []),
      best_posting_time: idea.best_time_to_post, predicted_performance: idea.predicted_performance,
      platform_focus: JSON.stringify(idea.platform_focus || []), saved: true,
    }) });
    alert('Idea saved!');
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Content Idea Generator'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Get AI-powered video ideas with SEO keywords and thumbnail concepts'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 500 } },
        React.createElement('input', { className: 'input', placeholder: 'e.g. "AI tools for content creators"', value: topic, onChange: e => setTopic(e.target.value), onKeyDown: e => e.key === 'Enter' && generate() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: generate, disabled: loading }, loading ? 'Generating...' : 'Generate Ideas'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    ideas ? React.createElement('div', null,
      ideas.insight_summary ? React.createElement('div', { className: 'insight' },
        React.createElement('h3', null, '\uD83E\uDD16 AI Analysis'),
        React.createElement('p', null, ideas.insight_summary),
      ) : null,
      React.createElement('div', { className: 'stats', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' } },
        ideas.ideas.map((idea, i) =>
          React.createElement('div', { key: i, className: 'card', style: { padding: 16 } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 } },
              React.createElement('h3', { style: { fontSize: '1rem', fontWeight: 700, flex: 1 } }, idea.title),
              React.createElement('span', { className: 'tag', style: { background: idea.confidence_score > 0.8 ? 'rgba(43,166,64,.15)' : 'var(--bg3)', color: idea.confidence_score > 0.8 ? 'var(--success)' : 'var(--text2)' } }, `${Math.round(idea.confidence_score * 100)}%`),
            ),
            React.createElement('p', { style: { color: 'var(--text2)', fontSize: '.85rem', marginBottom: 12 } }, idea.description),
            idea.seo_keywords?.length ? React.createElement('div', null,
              React.createElement('div', { style: { fontSize: '.78rem', color: 'var(--text3)', marginBottom: 4, fontWeight: 600 } }, 'SEO Keywords'),
              React.createElement('div', null, idea.seo_keywords.map((kw, j) => React.createElement('span', { key: j, className: 'tag' }, kw))),
            ) : null,
            idea.thumbnail_ideas?.length ? React.createElement('div', { style: { marginTop: 8 } },
              React.createElement('div', { style: { fontSize: '.78rem', color: 'var(--text3)', marginBottom: 4, fontWeight: 600 } }, '\uD83D\uDDBC Thumbnail Ideas'),
              React.createElement('ul', { style: { fontSize: '.82rem', color: 'var(--text2)', paddingLeft: 16 } },
                idea.thumbnail_ideas.map((t, j) => React.createElement('li', { key: j }, t)),
              ),
            ) : null,
            idea.best_time_to_post ? React.createElement('div', { style: { marginTop: 8, fontSize: '.82rem', color: 'var(--accent)' } },
              '\u23F0 Best time: ', idea.best_time_to_post, ' \u00B7 Predicted: ', idea.predicted_performance,
            ) : null,
            idea.viral_probability !== undefined ? React.createElement('div', { style: { marginTop: 8, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '.82rem' } },
              React.createElement('span', { style: { color: idea.viral_probability > 70 ? 'var(--success)' : 'var(--warning)' } },
                '\uD83D\uDCA5 Viral: ', idea.viral_probability, '%'),
              React.createElement('span', { style: { color: 'var(--text2)' } },
                '\uD83D\uDCC8 Views: ', (idea.expected_view_min || 0).toLocaleString(), '\u2013', (idea.expected_view_max || 0).toLocaleString()),
            ) : null,
            idea.publish_ready !== undefined ? React.createElement('div', { style: { marginTop: 8, padding: '8px 12px', borderRadius: 'var(--radius)', fontSize: '.82rem', background: idea.publish_ready ? 'rgba(43,166,64,.1)' : 'rgba(255,78,69,.1)', border: `1px solid ${idea.publish_ready ? 'var(--success)' : 'var(--error)'}` } },
              idea.publish_ready ? React.createElement('span', { style: { color: 'var(--success)', fontWeight: 600 } }, '\u2714\uFE0F Ready to Publish') : React.createElement('span', { style: { color: 'var(--error)', fontWeight: 600 } }, '\u26A0\uFE0F Improve Before Publishing'),
              idea.publish_reasons?.length ? React.createElement('div', { style: { marginTop: 4, color: 'var(--text2)' } }, idea.publish_reasons.map((r, j) => React.createElement('div', { key: j }, '\u2022 ', r))) : null,
              idea.improve_reasons?.length ? React.createElement('div', { style: { marginTop: 4, color: 'var(--error)' } }, idea.improve_reasons.map((r, j) => React.createElement('div', { key: j }, '\u2022 ', r))) : null,
            ) : null,
            React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 12, width: '100%', justifyContent: 'center', padding: '6px', fontSize: '.8rem' }, onClick: () => saveIdea(idea) }, '\uD83D\uDCBE Save Idea'),
          )
        ),
      ),
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCA1'),
      React.createElement('p', null, 'Enter a topic to generate AI-powered content ideas'),
    ) : null,
  );
}

// ── Settings / Account ────────────────────────────────────────────────
function SettingsPage() {
  const { api, user, logout } = useAuth();
  const [usage, setUsage] = useState(null);
  const [prefs, setPrefs] = useState(null);
  const [apiKeys, setApiKeys] = useState([]);
  const [channels, setChannels] = useState([]);
  const [digestCfg, setDigestCfg] = useState(null);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKey, setNewKey] = useState('');
  const [activeTab, setActiveTab] = useState('profile');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    (async () => {
      const [uRes, pRes, kRes, cRes, dRes] = await Promise.all([
        api('/api/billing/usage'), api('/api/notifications/prefs'),
        api('/api/api-keys'), api('/api/channels'), api('/api/digest-config'),
      ]);
      if (uRes?.ok) { const d = await uRes.json(); setUsage(d); }
      if (pRes?.ok) { const d = await pRes.json(); setPrefs(d); }
      if (kRes?.ok) { const d = await kRes.json(); setApiKeys(d); }
      if (cRes?.ok) { const d = await cRes.json(); setChannels(d); }
      if (dRes?.ok) { const d = await dRes.json(); setDigestCfg(d); }
    })();
  }, [api]);

  const savePrefs = async () => {
    await api('/api/notifications/prefs', { method: 'PUT', body: JSON.stringify(prefs) });
    alert('Preferences saved!');
  };

  const createKey = async () => {
    const res = await api('/api/api-keys', { method: 'POST', body: JSON.stringify({ label: newKeyLabel || 'default' }) });
    if (!res) return;
    const d = await res.json();
    setNewKey(d.key);
    setNewKeyLabel('');
    const kRes = await api('/api/api-keys');
    if (kRes?.ok) setApiKeys(await kRes.json());
  };

  const deleteKey = async (id) => {
    await api(`/api/api-keys/${id}`, { method: 'DELETE' });
    const kRes = await api('/api/api-keys');
    if (kRes?.ok) setApiKeys(await kRes.json());
  };

  const saveDigest = async () => {
    await api('/api/digest-config', { method: 'PUT', body: JSON.stringify(digestCfg) });
    alert('Digest settings saved!');
  };

  const deleteAccount = async () => {
    if (!confirmDelete) return;
    await api('/api/account', { method: 'DELETE' });
    logout();
  };

  const tabs = ['profile', 'notifications', 'api-keys', 'channels', 'digest'];
  const tabLabels = { profile: 'Profile & Usage', notifications: 'Notifications', 'api-keys': 'API Keys', channels: 'Channels', digest: 'Email Digest' };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Settings'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Manage your account and preferences'),
    React.createElement('div', { className: 'tabs' },
      tabs.map(t => React.createElement('button', { key: t, className: `tab${activeTab === t ? ' active' : ''}`, onClick: () => setActiveTab(t) }, tabLabels[t])),
    ),
    React.createElement('div', { className: 'tab-panel', style: { display: activeTab === 'profile' ? 'block' : 'none' } },
      React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 12 } }, 'Account Information'),
        React.createElement('div', { style: { display: 'grid', gap: 8, gridTemplateColumns: '140px 1fr', fontSize: '.9rem' } },
          React.createElement('span', { style: { color: 'var(--text3)' } }, 'Email:'), React.createElement('span', null, user?.email),
          React.createElement('span', { style: { color: 'var(--text3)' } }, 'Plan:'), React.createElement('span', { style: { color: 'var(--primary)', fontWeight: 600 } }, usage?.plan || 'free'),
          React.createElement('span', { style: { color: 'var(--text3)' } }, 'Analyses Used:'), React.createElement('span', null, `${usage?.analyses_this_month || 0} / ${usage?.limit === -1 ? '\u221E' : usage?.limit || 3}`),
          React.createElement('span', { style: { color: 'var(--text3)' } }, 'Member Since:'), React.createElement('span', null, user?.created_date ? new Date(user.created_date).toLocaleDateString() : 'N/A'),
        ),
        usage?.plan !== 'free' ? React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 16 }, onClick: async () => {
          const res = await api('/api/billing/portal', { method: 'POST' });
          if (res?.ok) { const d = await res.json(); if (d.url) window.location.href = d.url; }
        } }, 'Manage Subscription') :
        React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 16 }, onClick: () => window.location.hash = 'pricing' }, 'Upgrade Plan'),
      ),
      React.createElement('div', { className: 'card', style: { borderColor: 'rgba(255,68,68,.3)' } },
        React.createElement('h3', { style: { color: 'var(--error)', marginBottom: 8 } }, 'Danger Zone'),
        React.createElement('p', { style: { fontSize: '.85rem', color: 'var(--text3)', marginBottom: 12 } }, 'Permanently delete your account and all data. This action cannot be undone.'),
        confirmDelete ? React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement('button', { className: 'btn', style: { background: 'var(--error)', color: '#fff' }, onClick: deleteAccount }, 'Confirm Delete'),
          React.createElement('button', { className: 'btn btn-ghost', onClick: () => setConfirmDelete(false) }, 'Cancel'),
        ) : React.createElement('button', { className: 'btn btn-ghost', style: { borderColor: 'var(--error)', color: 'var(--error)' }, onClick: () => setConfirmDelete(true) }, 'Delete Account'),
      ),
    ),
    React.createElement('div', { className: 'tab-panel', style: { display: activeTab === 'notifications' ? 'block' : 'none' } },
      React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 12 } }, 'Notification Preferences'),
        prefs ? Object.entries(prefs).filter(([k]) => k !== 'id').map(([k, v]) =>
          React.createElement('label', { key: k, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.9rem', cursor: 'pointer' } },
            React.createElement('input', { type: typeof v === 'boolean' ? 'checkbox' : 'radio', checked: v === true || v === 'true' || v === 'weekly', onChange: () => {
              if (typeof v === 'boolean') setPrefs(p => ({ ...p, [k]: !p[k] }));
              else setPrefs(p => ({ ...p, [k]: p.digest_frequency === 'weekly' ? 'daily' : 'weekly' }));
            } }),
            k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          )
        ) : null,
        React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 12 }, onClick: savePrefs }, 'Save Preferences'),
      ),
    ),
    React.createElement('div', { className: 'tab-panel', style: { display: activeTab === 'api-keys' ? 'block' : 'none' } },
      React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 4 } }, 'API Keys'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem', marginBottom: 12 } }, 'API keys are only available on the Business plan.'),
        user?.plan === 'business' ? React.createElement('div', null,
          React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 400, marginBottom: 16 } },
            React.createElement('input', { className: 'input', placeholder: 'Key label (e.g. "prod-server")', value: newKeyLabel, onChange: e => setNewKeyLabel(e.target.value) }),
            React.createElement('button', { className: 'btn btn-accent', onClick: createKey }, 'Create Key'),
          ),
          newKey ? React.createElement('div', { className: 'insight' },
            React.createElement('h3', null, '\u26A0\uFE0F Copy this key now — it won\u2019t be shown again'),
            React.createElement('code', { style: { display: 'block', padding: 12, background: 'var(--bg)', borderRadius: 'var(--radius)', marginTop: 8, fontSize: '.85rem', wordBreak: 'break-all' } }, newKey),
          ) : null,
          apiKeys.length ? React.createElement('div', null,
            React.createElement('div', { style: { fontSize: '.85rem', color: 'var(--text3)', marginBottom: 8, fontWeight: 600 } }, 'Existing Keys'),
            apiKeys.map(k => React.createElement('div', { key: k.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' } },
              React.createElement('div', null,
                React.createElement('div', { style: { fontWeight: 600 } }, k.label),
                React.createElement('div', { style: { color: 'var(--text3)' } }, k.key, ' \u00B7 ', new Date(k.created_date).toLocaleDateString()),
              ),
              React.createElement('button', { className: 'btn btn-ghost', style: { padding: '4px 12px', fontSize: '.78rem', borderColor: 'var(--error)', color: 'var(--error)' }, onClick: () => deleteKey(k.id) }, 'Revoke'),
            )),
          ) : React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem' } }, 'No API keys created yet.'),
        ) : React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem', fontStyle: 'italic' } }, 'Upgrade to Business to create API keys.'),
      ),
    ),
    React.createElement('div', { className: 'tab-panel', style: { display: activeTab === 'channels' ? 'block' : 'none' } },
      React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 12 } }, 'Your Channels'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem', marginBottom: 12 } }, 'Manage multiple YouTube channels from one account.'),
        channels.length ? channels.map(c =>
          React.createElement('div', { key: c.id, style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' } },
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: '.9rem' } }, c.channel_title || c.channel_id),
              React.createElement('div', { style: { color: 'var(--text3)', fontSize: '.8rem' } }, c.is_primary ? 'Primary' : 'Secondary'),
            ),
            React.createElement('button', { className: 'btn btn-ghost', style: { padding: '4px 12px', fontSize: '.78rem' }, onClick: async () => {
              await api(`/api/channels/${c.channel_id}`, { method: 'DELETE' });
              const cRes = await api('/api/channels');
              if (cRes?.ok) setChannels(await cRes.json());
            } }, 'Remove'),
          )
        ) : React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem' } }, 'No channels added yet. Analyze a channel to add it.'),
      ),
    ),
    React.createElement('div', { className: 'tab-panel', style: { display: activeTab === 'digest' ? 'block' : 'none' } },
      React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 12 } }, 'Email Digest Configuration'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem', marginBottom: 12 } }, 'Customize your weekly email report.'),
        digestCfg ? Object.entries(digestCfg).filter(([k]) => k !== 'id' && k !== 'updated_at').map(([k, v]) =>
          React.createElement('label', { key: k, style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.9rem', cursor: 'pointer' } },
            React.createElement('input', { type: typeof v === 'boolean' ? 'checkbox' : 'radio', checked: typeof v === 'boolean' ? v : v === 'weekly', onChange: () => {
              if (typeof v === 'boolean') setDigestCfg(d => ({ ...d, [k]: !d[k] }));
              else setDigestCfg(d => ({ ...d, [k]: d.frequency === 'weekly' ? 'daily' : 'weekly' }));
            } }),
            k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
          )
        ) : null,
        React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 12 }, onClick: saveDigest }, 'Save Digest Settings'),
      ),
    ),
  );
}

// ── Saved Ideas ───────────────────────────────────────────────────────
function SavedIdeasPage() {
  const { api } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await api('/api/ideas?saved_only=true');
      if (res?.ok) setIdeas(await res.json());
      setLoading(false);
    })();
  }, [api]);

  if (loading) return React.createElement(Skeleton);

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Saved Ideas'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Your saved content ideas'),
    ideas.length ? React.createElement('div', { className: 'content-list' },
      ideas.map(idea => React.createElement('div', { key: idea.id, className: 'card' },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' } },
          React.createElement('div', null,
            React.createElement('h3', { style: { fontSize: '1rem', fontWeight: 600, marginBottom: 4 } }, idea.title),
            React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.82rem' } }, 'Topic: ', idea.topic),
          ),
          React.createElement('button', { className: 'btn btn-ghost', style: { padding: '4px 12px', fontSize: '.78rem', borderColor: 'var(--error)', color: 'var(--error)' }, onClick: async () => {
            await api(`/api/ideas/${idea.id}`, { method: 'DELETE' });
            setIdeas(ideas.filter(i => i.id !== idea.id));
          } }, 'Delete'),
        ),
        idea.seo_keywords?.length ? React.createElement('div', { style: { marginTop: 8 } },
          idea.seo_keywords.map((kw, i) => React.createElement('span', { key: i, className: 'tag' }, kw)),
        ) : null,
      )),
    ) : React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCBE'),
      React.createElement('p', null, 'No saved ideas yet. Generate some from the Ideas page!'),
    ),
  );
}

// ── Watched Competitors / Monitoring ──────────────────────────────────
function WatchPage() {
  const { api } = useAuth();
  const [watched, setWatched] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('watched');

  useEffect(() => {
    (async () => {
      const [wRes, aRes] = await Promise.all([api('/api/watched-competitors'), api('/api/alerts')]);
      if (wRes?.ok) setWatched(await wRes.json());
      if (aRes?.ok) setAlerts(await aRes.json());
      setLoading(false);
    })();
  }, [api]);

  const markRead = async () => {
    await api('/api/alerts/read', { method: 'POST' });
    setAlerts(alerts.map(a => ({ ...a, read: true })));
  };

  if (loading) return React.createElement(Skeleton);

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Competitor Monitoring'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Watch competitors and get alerted to changes'),
    React.createElement('div', { className: 'tabs' },
      React.createElement('button', { className: `tab${tab === 'watched' ? ' active' : ''}`, onClick: () => setTab('watched') }, 'Watched Channels'),
      React.createElement('button', { className: `tab${tab === 'alerts' ? ' active' : ''}`, onClick: () => setTab('alerts') }, 'Alerts', alerts.filter(a => !a.read).length ? React.createElement('span', { className: 'tab-count', style: { background: 'var(--primary)', color: '#fff' } }, alerts.filter(a => !a.read).length) : null),
    ),
    tab === 'watched' ? React.createElement('div', null,
      watched.length ? React.createElement('div', { className: 'competitor-grid' },
        watched.map(w => React.createElement('div', { key: w.id, className: 'competitor-card' },
          React.createElement('div', { className: 'name' }, w.channel_title || w.channel_id),
          React.createElement('div', { className: 'subs' }, `${fmtNum(w.subscriber_count)} subs \u00B7 Watching since ${new Date(w.added_at).toLocaleDateString()}`),
          React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '4px 8px', fontSize: '.78rem', borderColor: 'var(--error)', color: 'var(--error)' }, onClick: async () => {
            await api(`/api/watched-competitors/${w.channel_id}`, { method: 'DELETE' });
            setWatched(watched.filter(x => x.id !== w.id));
          } }, 'Stop Watching'),
        )),
      ) : React.createElement('div', { className: 'empty-state' },
        React.createElement('div', { className: 'emoji' }, '\uD83D\uDC40'),
        React.createElement('p', null, 'No competitors watched yet. Find competitors and click "Watch" to monitor them.'),
      ),
    ) : React.createElement('div', null,
      alerts.filter(a => !a.read).length ? React.createElement('button', { className: 'btn btn-ghost', style: { marginBottom: 12, fontSize: '.85rem' }, onClick: markRead }, 'Mark All Read') : null,
      alerts.length ? React.createElement('div', { className: 'content-list' },
        alerts.map(a => React.createElement('div', { key: a.id, className: 'card', style: { padding: 12, opacity: a.read ? 0.6 : 1 } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
            React.createElement('span', { style: { fontSize: '1.1rem' } }, a.alert_type === 'new_video' ? '\uD83C\uDFAC' : a.alert_type === 'sub_spike' ? '\uD83D\uDCC8' : '\uD83D\uDCA1'),
            React.createElement('div', null,
              React.createElement('p', { style: { fontSize: '.85rem', fontWeight: 600 } }, a.message),
              React.createElement('p', { style: { fontSize: '.78rem', color: 'var(--text3)' } }, new Date(a.created_at).toLocaleString()),
            ),
          ),
        )),
      ) : React.createElement('div', { className: 'empty-state' },
        React.createElement('div', { className: 'emoji' }, '\uD83D\uDD14'),
        React.createElement('p', null, 'No alerts yet. Alerts will appear when your watched competitors have notable changes.'),
      ),
    ),
  );
}

// ── Content Calendar ─────────────────────────────────────────────────
function CalendarPage() {
  const { api } = useAuth();
  const now = new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', event_time: '', event_type: 'idea', related_channel_id: '' });

  useEffect(() => {
    (async () => {
      const res = await api(`/api/calendar?month=${month}`);
      if (res?.ok) setEvents(await res.json());
      setLoading(false);
    })();
  }, [api, month]);

  const createEvent = async () => {
    const res = await api('/api/calendar', { method: 'POST', body: JSON.stringify(form) });
    if (res?.ok) { setShowForm(false); setForm({ title: '', description: '', event_date: '', event_time: '', event_type: 'idea', related_channel_id: '' }); }
    const fres = await api(`/api/calendar?month=${month}`);
    if (fres?.ok) setEvents(await fres.json());
  };

  const deleteEvent = async (id) => {
    await api(`/api/calendar/${id}`, { method: 'DELETE' });
    setEvents(events.filter(e => e.id !== id));
  };

  const daysInMonth = new Date(parseInt(month), parseInt(month.split('-')[1]), 0).getDate();
  const firstDay = new Date(parseInt(month), parseInt(month.split('-')[1]) - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  if (loading) return React.createElement(Skeleton);

  return React.createElement('div', null,
    React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
      React.createElement('div', null,
        React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Content Calendar'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem' } }, 'Plan and schedule your content'),
      ),
      React.createElement('button', { className: 'btn btn-primary', onClick: () => setShowForm(!showForm) }, showForm ? 'Cancel' : '+ Add Event'),
    ),
    showForm ? React.createElement('div', { className: 'card', style: { marginBottom: 16 } },
      React.createElement('div', { style: { display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr' } },
        React.createElement('input', { className: 'input', placeholder: 'Event title', value: form.title, onChange: e => setForm(f => ({ ...f, title: e.target.value })) }),
        React.createElement('input', { className: 'input', type: 'date', value: form.event_date, onChange: e => setForm(f => ({ ...f, event_date: e.target.value })) }),
        React.createElement('input', { className: 'input', type: 'time', value: form.event_time, onChange: e => setForm(f => ({ ...f, event_time: e.target.value })) }),
        React.createElement('select', { className: 'input', value: form.event_type, onChange: e => setForm(f => ({ ...f, event_type: e.target.value })) },
          React.createElement('option', { value: 'idea' }, 'Content Idea'),
          React.createElement('option', { value: 'upload' }, 'Upload'),
          React.createElement('option', { value: 'meeting' }, 'Meeting'),
          React.createElement('option', { value: 'deadline' }, 'Deadline'),
        ),
      ),
      React.createElement('textarea', { className: 'input', style: { marginTop: 8, minHeight: 60 }, placeholder: 'Description', value: form.description, onChange: e => setForm(f => ({ ...f, description: e.target.value })) }),
      React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 8 }, onClick: createEvent, disabled: !form.title || !form.event_date }, 'Save Event'),
    ) : null,
    React.createElement('div', { style: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 } },
      React.createElement('button', { className: 'btn btn-ghost', style: { padding: '6px 12px' }, onClick: () => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m - 2, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      } }, '\u2190'),
      React.createElement('h2', { style: { fontSize: '1.1rem', fontWeight: 600, minWidth: 160, textAlign: 'center' } }, new Date(parseInt(month), parseInt(month.split('-')[1]) - 1).toLocaleString('default', { month: 'long', year: 'numeric' })),
      React.createElement('button', { className: 'btn btn-ghost', style: { padding: '6px 12px' }, onClick: () => {
        const [y, m] = month.split('-').map(Number);
        const d = new Date(y, m, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      } }, '\u2192'),
      React.createElement('button', { className: 'btn btn-ghost', style: { padding: '6px 12px', fontSize: '.8rem' }, onClick: () => {
        const n = new Date(); setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`);
      } }, 'Today'),
    ),
    React.createElement('div', { style: { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' } },
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' } },
        ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => React.createElement('div', { key: d, style: { padding: '8px', textAlign: 'center', fontSize: '.78rem', color: 'var(--text3)', fontWeight: 600 } }, d)),
      ),
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' } },
        Array.from({ length: firstDay }, (_, i) => React.createElement('div', { key: `empty-${i}`, style: { padding: '8px', minHeight: 80, background: 'var(--bg2)' } })),
        days.map(d => {
          const dateStr = `${month}-${String(d).padStart(2, '0')}`;
          const dayEvents = events.filter(e => e.event_date === dateStr);
          return React.createElement('div', { key: d, style: { padding: '4px', minHeight: 80, borderRight: '1px solid var(--border)', borderBottom: '1px solid var(--border)', cursor: 'pointer' }, onClick: () => setForm(f => ({ ...f, event_date: dateStr })) },
            React.createElement('div', { style: { fontSize: '.8rem', fontWeight: 600, color: 'var(--text2)', marginBottom: 2 } }, d),
            dayEvents.slice(0, 3).map(ev => {
              const bg = ev.event_type === 'upload' ? 'rgba(255,68,68,.15)' : 'rgba(62,166,255,.15)';
              return React.createElement('div', { key: ev.id, style: { fontSize: '.7rem', padding: '2px 4px', marginBottom: 2, background: bg, borderRadius: 4, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, ev.title);
            }),
            dayEvents.length > 3 ? React.createElement('div', { style: { fontSize: '.65rem', color: 'var(--text3)' } }, `+${dayEvents.length - 3} more`) : null,
          );
        }),
      ),
    ),
    React.createElement('div', { style: { marginTop: 16, fontSize: '.85rem', color: 'var(--text3)' } },
      React.createElement('span', null, events.length, ' events this month'),
      events.filter(e => e.event_type === 'upload').length ? React.createElement('span', { style: { marginLeft: 12 } }, '\u00B7 ', events.filter(e => e.event_type === 'upload').length, ' uploads') : null,
    ),
  );
}

// ── Reports (with Export) ─────────────────────────────────────────────
function ReportsPage() {
  const { api } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  const [exporting, setExporting] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api('/api/reports');
      if (res?.ok) setReports(await res.json());
      setLoading(false);
    })();
  }, [api]);

  const loadReport = async (reportId) => {
    const res = await api(`/api/reports/${reportId}`);
    if (res?.ok) setSelectedReport(await res.json());
  };

  const doExport = async (format) => {
    if (!selectedReport?.data?.profile?.channel_id) return;
    setExporting(format);
    try {
      const res = await api(`/api/analyze/${selectedReport.data.profile.channel_id}/export?format=${format}`);
      if (!res) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analysis_${selectedReport.data.profile.channel_id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch { /* ignore */ }
    finally { setExporting(''); }
  };

  if (loading) return React.createElement(Skeleton);

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Reports & Exports'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'View saved analyses and export reports'),
    React.createElement('div', { style: { display: 'grid', gridTemplateColumns: selectedReport ? '1fr 1fr' : '1fr', gap: 16 } },
      React.createElement('div', null,
        React.createElement('div', { className: 'card' },
          React.createElement('h3', { style: { marginBottom: 12 } }, 'Saved Reports'),
          reports.length ? reports.map(r => React.createElement('div', { key: r.report_id, className: 'content-item', style: { marginBottom: 4 }, onClick: () => loadReport(r.report_id) },
            React.createElement('div', null,
              React.createElement('div', { style: { fontWeight: 600, fontSize: '.9rem' } }, r.channel_title || r.channel_url),
              React.createElement('div', { style: { color: 'var(--text3)', fontSize: '.8rem' } }, r.topic || 'Channel analysis', ' \u00B7 ', new Date(r.created_at).toLocaleDateString()),
            ),
          )) : React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem' } }, 'No reports yet. Analyze a channel to see reports here.'),
        ),
      ),
      selectedReport ? React.createElement('div', null,
        React.createElement('div', { className: 'card' },
          React.createElement('h3', { style: { marginBottom: 8 } }, selectedReport.channel_title || 'Report'),
          React.createElement('div', { style: { fontSize: '.85rem', color: 'var(--text3)', marginBottom: 12 } }, selectedReport.topic, ' \u00B7 ', new Date(selectedReport.created_at).toLocaleString()),
          React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement('button', { className: 'btn btn-accent', style: { fontSize: '.82rem', padding: '8px 16px' }, onClick: () => doExport('csv'), disabled: exporting === 'csv' }, exporting === 'csv' ? 'Exporting...' : '\uD83D\uDCC4 Export CSV'),
            React.createElement('button', { className: 'btn btn-primary', style: { fontSize: '.82rem', padding: '8px 16px' }, onClick: () => doExport('pdf'), disabled: exporting === 'pdf' }, exporting === 'pdf' ? 'Exporting...' : '\uD83D\uDCC4 Export PDF'),
            React.createElement('button', { className: 'btn btn-ghost', style: { fontSize: '.82rem', padding: '8px 16px' }, onClick: () => setSelectedReport(null) }, 'Close'),
          ),
        ),
      ) : null,
    ),
  );
}

// ── Repurpose ─────────────────────────────────────────────────────────
function RepurposePage() {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [platforms, setPlatforms] = useState({ tiktok: true, instagram: true });
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      const res = await api('/api/repurpose');
      if (res?.ok) setHistory(await res.json());
    })();
  }, [api]);

  const repurpose = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const targetPlatforms = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
      if (!targetPlatforms.length) { setErr('Select at least one platform'); setLoading(false); return; }
      const res = await api('/api/repurpose', { method: 'POST', body: JSON.stringify({ url, title, target_platforms: targetPlatforms }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setResult(d); }
      else { setErr(d.detail || 'Failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Cross-Platform Repurposing'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Turn YouTube videos into short-form content for other platforms'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        React.createElement('input', { className: 'input', style: { flex: 2, minWidth: 250 }, placeholder: 'YouTube video URL...', value: url, onChange: e => setUrl(e.target.value) }),
        React.createElement('input', { className: 'input', style: { flex: 1, minWidth: 150 }, placeholder: 'Video title (optional)', value: title, onChange: e => setTitle(e.target.value) }),
        React.createElement('button', { className: 'btn btn-accent', onClick: repurpose, disabled: loading }, loading ? 'Generating...' : 'Repurpose'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 16, marginTop: 12, fontSize: '.85rem', color: 'var(--text3)' } },
        Object.entries(platforms).map(([k, v]) =>
          React.createElement('label', { key: k, style: { display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' } },
            React.createElement('input', { type: 'checkbox', checked: v, onChange: () => setPlatforms(p => ({ ...p, [k]: !p[k] })) }),
            getPlatformConfig(k).icon, ' ', k.charAt(0).toUpperCase() + k.slice(1),
          )
        ),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    result ? React.createElement('div', null,
      React.createElement('h3', { style: { marginBottom: 12 } }, 'Generated Scripts'),
      React.createElement('div', { className: 'stats', style: { gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' } },
        result.scripts.map((s, i) => React.createElement('div', { key: i, className: 'card' },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 } },
            React.createElement('span', { className: 'platform-badge', style: { background: getPlatformConfig(s.platform).bg, color: getPlatformConfig(s.platform).color, width: 28, height: 28, fontSize: '.75rem' } }, getPlatformConfig(s.platform).icon),
            React.createElement('h3', { style: { fontSize: '1rem' } }, s.platform, ' Script (', s.duration_seconds, 's)'),
          ),
          React.createElement('pre', { style: { whiteSpace: 'pre-wrap', fontSize: '.82rem', color: 'var(--text2)', background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius)', marginBottom: 8, lineHeight: 1.5 } }, s.script),
          s.tips?.length ? React.createElement('div', null, s.tips.map((t, j) => React.createElement('div', { key: j, style: { fontSize: '.78rem', color: 'var(--text3)', padding: '2px 0' } }, '\uD83D\uDCA1 ', t))) : null,
        )),
      ),
    ) : null,
    history.length ? React.createElement('div', { className: 'card', style: { marginTop: 16 } },
      React.createElement('h3', { style: { marginBottom: 8 } }, 'History'),
      history.slice(0, 5).map(h => React.createElement('div', { key: h.id, style: { padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' } },
        React.createElement('div', { style: { fontWeight: 600 } }, h.source_title || h.source_url),
        React.createElement('div', { style: { color: 'var(--text3)', fontSize: '.8rem' } }, h.target_platforms?.join(', '), ' \u00B7 ', new Date(h.created_at).toLocaleDateString()),
      )),
    ) : null,
    !result && !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDD04'),
      React.createElement('p', null, 'Paste a YouTube video URL to generate platform-specific scripts'),
    ) : null,
  );
}

// ── SEO Scorecard ─────────────────────────────────────────────────────
function SeoPage() {
  const { api } = useAuth();
  const [channelId, setChannelId] = useState('');
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const analyze = async () => {
    if (!channelId.trim()) return;
    setLoading(true); setErr(''); setScorecard(null);
    try {
      const res = await api('/api/seo-scorecard', { method: 'POST', body: JSON.stringify({ channel_id: channelId }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setScorecard(d); }
      else { setErr(d.detail || 'Failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const scoreColor = (s) => s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'SEO Scorecard'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Analyze how well your channel is optimized for search'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 500 } },
        React.createElement('input', { className: 'input', placeholder: 'Channel ID...', value: channelId, onChange: e => setChannelId(e.target.value), onKeyDown: e => e.key === 'Enter' && analyze() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: analyze, disabled: loading }, loading ? 'Scoring...' : 'Score'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    scorecard ? React.createElement('div', null,
      React.createElement('div', { className: 'stats', style: { gridTemplateColumns: '1fr 1fr 1fr 1fr' } },
        React.createElement('div', { className: 'stat', style: { textAlign: 'center' } },
          React.createElement('div', { style: { fontSize: '2.5rem', fontWeight: 800, color: scoreColor(scorecard.overall_score) } }, scorecard.overall_score),
          React.createElement('div', { className: 'label' }, 'Overall SEO Score'),
        ),
        ['title_score', 'description_score', 'tags_score'].map(f => {
          const label = f.replace('_score', '').replace('_', ' ');
          return React.createElement('div', { key: f, className: 'stat', style: { textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '2rem', fontWeight: 700, color: scoreColor(scorecard[f]) } }, scorecard[f]),
            React.createElement('div', { className: 'label' }, label),
          );
        }),
      ),
      scorecard.recommendations?.length ? React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 8 } }, '\uD83D\uDCA1 Recommendations'),
        React.createElement('ul', { className: 'rec-list' },
          scorecard.recommendations.map((r, i) => React.createElement('li', { key: i }, r)),
        ),
      ) : null,
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDD0D'),
      React.createElement('p', null, 'Enter a channel ID to generate an SEO scorecard'),
    ) : null,
  );
}

// ── A/B Thumbnail Tester ──────────────────────────────────────────────
function ThumbnailTestPage() {
  const { api } = useAuth();
  const [urlA, setUrlA] = useState('');
  const [urlB, setUrlB] = useState('');
  const [title, setTitle] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const test = async () => {
    if (!urlA.trim() || !urlB.trim()) { setErr('Both thumbnail URLs are required'); return; }
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await api('/api/thumbnail-test', { method: 'POST', body: JSON.stringify({ thumbnail_a_url: urlA, thumbnail_b_url: urlB, title }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setResult(d); }
      else { setErr(d.detail || 'Test failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'A/B Thumbnail Tester'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'AI predicts which thumbnail will perform better'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'grid', gap: 8, gridTemplateColumns: '1fr 1fr', maxWidth: 600 } },
        React.createElement('input', { className: 'input', placeholder: 'Thumbnail A URL...', value: urlA, onChange: e => setUrlA(e.target.value) }),
        React.createElement('input', { className: 'input', placeholder: 'Thumbnail B URL...', value: urlB, onChange: e => setUrlB(e.target.value) }),
        React.createElement('input', { className: 'input', placeholder: 'Video title (optional)', value: title, onChange: e => setTitle(e.target.value), style: { gridColumn: '1 / -1' } }),
      ),
      React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 8 }, onClick: test, disabled: loading }, loading ? 'Testing...' : 'Compare Thumbnails'),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    result ? React.createElement('div', null,
      React.createElement('div', { className: 'stats', style: { gridTemplateColumns: '1fr 1fr' } },
        ['a', 'b'].map(side => {
          const data = result[`thumbnail_${side}`];
          return React.createElement('div', { key: side, className: 'card', style: { border: result.winner === side.toUpperCase() ? '2px solid var(--success)' : '1px solid var(--border)', textAlign: 'center' } },
            React.createElement('div', { style: { fontSize: '3rem', fontWeight: 800, color: scoreColor(data.score * 10) } }, data.score),
            React.createElement('div', { className: 'label', style: { fontSize: '1rem', marginBottom: 8 } }, `Thumbnail ${side.toUpperCase()}${result.winner === side.toUpperCase() ? ' \uD83C\uDFC6' : ''}`),
            data.factors.map((f, i) => React.createElement('div', { key: i, style: { fontSize: '.82rem', color: 'var(--text2)', padding: '4px 0', borderBottom: '1px solid var(--border)' } }, f)),
          );
        }),
      ),
      result.tips?.length ? React.createElement('div', { className: 'card' },
        React.createElement('h3', { style: { marginBottom: 8 } }, '\uD83D\uDCA1 General Tips'),
        result.tips.map((t, i) => React.createElement('div', { key: i, style: { padding: '4px 0', fontSize: '.85rem', color: 'var(--text2)' } }, t)),
      ) : null,
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDDBC'),
      React.createElement('p', null, 'Enter two thumbnail URLs to see which one performs better'),
    ) : null,
  );
}

function scoreColor(s) {
  s = Number(s);
  return s >= 80 ? 'var(--success)' : s >= 50 ? 'var(--warning)' : 'var(--error)';
}

// ── Trend Alerts ──────────────────────────────────────────────────────
function TrendAlertsPage() {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const res = await api('/api/trend-alerts/check', { method: 'POST' });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setAlerts(d.alerts || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Trend Alerts'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Discover trending topics in your niche'),
    React.createElement('button', { className: 'btn btn-accent', onClick: check, disabled: loading, style: { marginBottom: 16 } }, loading ? 'Checking...' : '\uD83D\uDD14 Check for Trends'),
    alerts.length ? React.createElement('div', { className: 'content-list' },
      alerts.map((a, i) => React.createElement('div', { key: i, className: 'card', style: { padding: 12, borderLeft: `4px solid ${a.strength === 'high' ? 'var(--primary)' : 'var(--warning)'}` } },
        React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: 8 } },
          React.createElement('span', { style: { fontSize: '1.2rem' } }, '\uD83D\uDD25'),
          React.createElement('div', null,
            React.createElement('p', { style: { fontSize: '.9rem', fontWeight: 600 } }, a.topic),
            React.createElement('p', { style: { fontSize: '.82rem', color: 'var(--text2)' } }, a.message),
            React.createElement('p', { style: { fontSize: '.75rem', color: 'var(--text3)', marginTop: 4 } }, 'Platform: ', a.platform, ' \u00B7 Strength: ', a.strength),
          ),
        ),
      )),
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCA1'),
      React.createElement('p', null, 'Click "Check for Trends" to discover trending topics in your niche'),
    ) : null,
  );
}

// ── Comments Analyzer ─────────────────────────────────────────────────
function CommentsPage() {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setData(null);
    try {
      const res = await api('/api/comments/analyze', { method: 'POST', body: JSON.stringify({ video_url: url }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setData(d);
      else setErr(d.detail || 'Analysis failed');
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };

  const sen = data?.sentiment_breakdown || {};
  const total = sen.positive + sen.neutral + sen.negative || 1;
  const pct = (v) => Math.round((v / total) * 100);

  return React.createElement('div', null,
    React.createElement('h1', null, '\uD83D\uDCAC Comment Analyzer'),
    React.createElement('p', { style: { color: 'var(--text3)', marginBottom: 16 } },
      'Paste a YouTube video URL to analyze audience comments with AI sentiment and topic extraction'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 500 } },
        React.createElement('input', { className: 'input', placeholder: 'https://youtube.com/watch?v=...', value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && analyze() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: analyze, disabled: loading }, loading ? 'Analyzing...' : 'Analyze'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    data ? React.createElement('div', null,
      React.createElement('div', { className: 'card' },
        React.createElement('h3', null, data.video_title || 'Untitled Video'),
        React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.85rem' } }, `${data.total_comments} comments analyzed`),
      ),
      React.createElement('div', { className: 'stats', style: { gridTemplateColumns: 'repeat(3, 1fr)' } },
        React.createElement('div', { className: 'stat', style: { borderLeft: '4px solid #2ba640' } },
          React.createElement('div', { className: 'label' }, 'Positive'),
          React.createElement('div', { className: 'value' }, `${pct(sen.positive)}%`),
          React.createElement('div', { className: 'change', style: { color: 'var(--success)' } }, `${sen.positive} comments`),
        ),
        React.createElement('div', { className: 'stat', style: { borderLeft: '4px solid #ffa73c' } },
          React.createElement('div', { className: 'label' }, 'Neutral'),
          React.createElement('div', { className: 'value' }, `${pct(sen.neutral)}%`),
          React.createElement('div', { className: 'change', style: { color: 'var(--warning)' } }, `${sen.neutral} comments`),
        ),
        React.createElement('div', { className: 'stat', style: { borderLeft: '4px solid #ff4e45' } },
          React.createElement('div', { className: 'label' }, 'Negative'),
          React.createElement('div', { className: 'value' }, `${pct(sen.negative)}%`),
          React.createElement('div', { className: 'change', style: { color: 'var(--error)' } }, `${sen.negative} comments`),
        ),
      ),
      data.topics?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)' } }, '\uD83D\uDCDD'),
          React.createElement('h3', null, 'Topics Mentioned'),
        ),
        React.createElement('div', null, data.topics.map((t, i) => React.createElement('span', { key: i, className: 'tag' }, t))),
      ) : null,
      data.content_ideas?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(43,166,64,.15)' } }, '\uD83D\uDCA1'),
          React.createElement('h3', null, 'Content Ideas from Comments'),
        ),
        React.createElement('ul', { className: 'rec-list' }, data.content_ideas.map((idea, i) =>
          React.createElement('li', { key: i }, idea))),
      ) : null,
      data.common_requests?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,167,60,.15)' } }, '\uD83D\uDCE3'),
          React.createElement('h3', null, 'Common Requests'),
        ),
        React.createElement('ul', { className: 'rec-list' }, data.common_requests.map((r, i) =>
          React.createElement('li', { key: i }, r))),
      ) : null,
      data.negative_feedback?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,78,69,.15)' } }, '\u26A0\uFE0F'),
          React.createElement('h3', null, 'Negative Feedback'),
        ),
        React.createElement('ul', { className: 'rec-list' }, data.negative_feedback.map((f, i) =>
          React.createElement('li', { key: i, style: { color: 'var(--error)' } }, f))),
      ) : null,
      data.summary ? React.createElement('div', { className: 'insight' },
        React.createElement('h3', null, '\uD83E\uDD16 AI Summary'),
        React.createElement('p', null, data.summary),
      ) : null,
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCAC'),
      React.createElement('p', null, 'Enter a YouTube video URL to analyze audience comments'),
    ) : null,
  );
}

// ── Publishing Assistant ──────────────────────────────────────────────
function PublishingPage() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true); setErr(''); setData(null);
    try {
      const res = await api('/api/publishing/insights', { method: 'POST', body: JSON.stringify({ topic: '' }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setData(d);
      else setErr(d.detail || 'Failed');
    } catch { setErr('Network error'); }
    finally { setLoading(false); }
  };

  React.useEffect(() => { load(); }, []);

  const slotColor = (s) => s >= 80 ? 'var(--success)' : s >= 60 ? 'var(--warning)' : 'var(--error)';

  return React.createElement('div', null,
    React.createElement('h1', null, '\uD83D\uDCE4 Publishing Assistant'),
    React.createElement('p', { style: { color: 'var(--text3)', marginBottom: 16 } },
      'Optimal posting times, CTR predictions, and A/B slot analysis for your channel'),
    React.createElement(LoadingBar, { active: loading }),
    React.createElement(ErrorBox, { message: err }),
    data ? React.createElement('div', null,
      React.createElement('div', { className: 'stats' },
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Predicted CTR'),
          React.createElement('div', { className: 'value' }, `${data.predicted_ctr}%`),
          React.createElement('div', { className: 'change', style: { color: 'var(--accent)' } }, 'Estimated click-through rate'),
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Niche'),
          React.createElement('div', { className: 'value', style: { fontSize: '1.1rem' } }, data.niche),
          React.createElement('div', { className: 'change', style: { color: 'var(--text3)' } }, `${data.subscriber_count?.toLocaleString() || 0} subscribers`),
        ),
      ),
      data.best_time_slots?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)' } }, '\u23F0'),
          React.createElement('h3', null, 'Best Posting Times'),
        ),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 } },
          data.best_time_slots.map((slot, i) =>
            React.createElement('div', { key: i, className: 'stat', style: { borderLeft: `4px solid ${slotColor(slot.score)}`, padding: 12 } },
              React.createElement('div', { className: 'label' }, `${slot.day} ${slot.time}`),
              React.createElement('div', { className: 'value', style: { fontSize: '1.2rem' } }, `${slot.score}/100`),
            ),
          ),
        ),
      ) : null,
      data.ab_comparison?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,167,60,.15)' } }, '\u2696\uFE0F'),
          React.createElement('h3', null, 'A/B Time Slot Comparison'),
        ),
        data.ab_comparison.map((ab, i) =>
          React.createElement('div', { key: i, style: { padding: '12px 0', borderBottom: i < data.ab_comparison.length - 1 ? '1px solid var(--border)' : 'none' } },
            React.createElement('div', { style: { display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' } },
              React.createElement('span', { style: { background: 'var(--bg3)', padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '.85rem' } }, ab.slot_a),
              React.createElement('span', { style: { color: 'var(--text3)' } }, 'vs'),
              React.createElement('span', { style: { background: 'var(--bg3)', padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '.85rem' } }, ab.slot_b),
            ),
            React.createElement('div', { style: { marginTop: 8, fontSize: '.88rem', color: 'var(--success)' } },
              `Winner: ${ab.winner} \u2014 ${ab.reason}`),
          ),
        ),
      ) : null,
      data.heatmap?.length ? React.createElement('div', { className: 'card' },
        React.createElement('div', { className: 'card-header' },
          React.createElement('div', { className: 'card-icon', style: { background: 'rgba(43,166,64,.15)' } }, '\uD83D\uDCCA'),
          React.createElement('h3', null, 'Optimal Schedule Heatmap'),
        ),
        React.createElement('div', { style: { overflowX: 'auto' } },
          React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '.78rem' } },
            React.createElement('thead', null,
              React.createElement('tr', null,
                React.createElement('th', { style: { padding: '6px 8px', textAlign: 'left', borderBottom: '1px solid var(--border)' } }, 'Day'),
                ['8am', '10am', '12pm', '2pm', '4pm', '6pm', '8pm'].map(h =>
                  React.createElement('th', { key: h, style: { padding: '6px 8px', textAlign: 'center', borderBottom: '1px solid var(--border)' } }, h)
                ),
              ),
            ),
            React.createElement('tbody', null,
              ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day =>
                React.createElement('tr', { key: day },
                  React.createElement('td', { style: { padding: '6px 8px', fontWeight: 600, borderBottom: '1px solid var(--border)' } }, day.slice(0, 3)),
                  data.heatmap.filter(h => h.day === day).map((h, i) => {
                    const bg = h.score >= 80 ? 'rgba(43,166,64,.25)' : h.score >= 60 ? 'rgba(255,167,60,.2)' : 'rgba(255,78,69,.15)';
                    const fg = h.score >= 80 ? 'var(--success)' : h.score >= 60 ? 'var(--warning)' : 'var(--error)';
                    return React.createElement('td', { key: i, style: { padding: '6px 8px', textAlign: 'center', background: bg, color: fg, borderRadius: 4, borderBottom: '1px solid var(--border)' } }, `${h.score}`);
                  }),
                )
              ),
            ),
          ),
        ),
      ) : null,
      data.recommendation ? React.createElement('div', { className: 'insight' },
        React.createElement('h3', null, '\uD83D\uDCCC Recommendation'),
        React.createElement('p', null, data.recommendation),
      ) : null,
    ) : !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDCE4'),
      React.createElement('p', null, 'Loading publishing insights...'),
    ) : null,
  );
}

// ── Onboarding Flow ───────────────────────────────────────────────────
function OnboardingPage() {
  const { api } = useAuth();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState('');

  const steps = [
    { title: 'Welcome!', icon: '\uD83D\uDC4B', desc: 'Creator Content Radar helps you analyze YouTube channels, discover competitors, and find content ideas across 7+ platforms.' },
    { title: 'Analyze Your Channel', icon: '\uD83D\uDCFA', desc: 'Paste your YouTube channel URL or @handle to get started. We\u2019ll analyze your channel and find actionable insights.' },
    { title: 'Discover & Grow', icon: '\uD83D\uDCC8', desc: 'You\u2019ll get competitor analysis, cross-platform content ideas, SEO recommendations, and more. Ready to go?' },
  ];

  const submitUrl = async () => {
    if (!url.trim()) { setStep(2); return; }
    try {
      const res = await api('/api/analyze/async', { method: 'POST', body: JSON.stringify({ channel_url: url, topic: '' }) });
      if (res?.ok) { setStep(2); }
    } catch { setStep(2); }
  };

  return React.createElement('div', { className: 'auth-page' },
    React.createElement('div', { className: 'auth-card', style: { maxWidth: 500, textAlign: 'center' } },
      React.createElement('div', { style: { fontSize: '3rem', marginBottom: 12 } }, steps[step].icon),
      React.createElement('h1', { style: { fontSize: '1.5rem', marginBottom: 8 } }, steps[step].title),
      React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 24, lineHeight: 1.6 } }, steps[step].desc),
      step === 0 ? React.createElement('button', { className: 'btn btn-primary', style: { padding: '12px 32px', fontSize: '1rem' }, onClick: () => setStep(1) }, 'Get Started') : null,
      step === 1 ? React.createElement('div', null,
        React.createElement('input', { className: 'input', style: { marginBottom: 12 }, placeholder: 'YouTube URL or @handle...', value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && submitUrl(), autoFocus: true }),
        React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'center' } },
          React.createElement('button', { className: 'btn btn-primary', onClick: submitUrl }, 'Analyze Channel'),
          React.createElement('button', { className: 'btn btn-ghost', onClick: () => setStep(2) }, 'Skip'),
        ),
      ) : null,
      step === 2 ? React.createElement('div', null,
        React.createElement('button', { className: 'btn btn-primary', style: { padding: '12px 32px', fontSize: '1rem', marginBottom: 8 }, onClick: () => window.location.hash = 'dashboard' }, 'Go to Dashboard'),
        React.createElement('div', { style: { fontSize: '.85rem', color: 'var(--text3)' } },
          React.createElement('a', { href: '#ideas', style: { color: 'var(--accent)', textDecoration: 'none' } }, 'Generate content ideas'),
          ' \u00B7 ',
          React.createElement('a', { href: '#pricing', style: { color: 'var(--primary)', textDecoration: 'none' } }, 'View pricing'),
        ),
      ) : null,
      React.createElement('div', { style: { marginTop: 24, display: 'flex', gap: 8, justifyContent: 'center' } },
        steps.map((_, i) => React.createElement('div', { key: i, style: { width: 10, height: 10, borderRadius: '50%', background: i === step ? 'var(--primary)' : 'var(--bg4)', transition: 'all .2s' } })),
      ),
    ),
  );
}

// ── App Shell ─────────────────────────────────────────────────────────
function AppShell({ page, setPage }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [alertsCount, setAlertsCount] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/alerts?unread_only=true', { headers: { Authorization: `Bearer ${localStorage.getItem('ccr_token')}` } });
        if (res.ok) { const d = await res.json(); setAlertsCount(d.length); }
      } catch { /* ignore */ }
    })();
  }, [page]);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '\uD83D\uDCCA', section: 'Main' },
    { id: 'analyze', label: 'Channel Analysis', icon: '\uD83D\uDCFA', section: 'Main' },
    { id: 'competitors', label: 'Competitors', icon: '\uD83D\uDC65', section: 'Main' },
    { id: 'discover', label: 'Content Discovery', icon: '\uD83D\uDD0D', section: 'Main' },
    { id: 'ideas', label: 'Idea Generator', icon: '\uD83D\uDCA1', section: 'Content' },
    { id: 'watch', label: 'Monitored', icon: '\uD83D\uDC40', section: 'Content', badge: alertsCount || null },
    { id: 'calendar', label: 'Calendar', icon: '\uD83D\uDCC5', section: 'Content' },
    { id: 'repurpose', label: 'Repurpose', icon: '\uD83D\uDD04', section: 'Content' },
    { id: 'seo', label: 'SEO Score', icon: '\uD83D\uDD0D', section: 'Content' },
    { id: 'thumbnail-test', label: 'A/B Thumbnails', icon: '\uD83D\uDDBC', section: 'Content' },
    { id: 'trends', label: 'Trend Alerts', icon: '\uD83D\uDD25', section: 'Content' },
    { id: 'comments', label: 'Comments', icon: '\uD83D\uDCAC', section: 'Content' },
    { id: 'publishing', label: 'Publishing', icon: '\uD83D\uDCE4', section: 'Content' },
    { id: 'reports', label: 'Reports & Export', icon: '\uD83D\uDCC4', section: 'Content' },
    { id: 'saved-ideas', label: 'Saved Ideas', icon: '\uD83D\uDCBE', section: 'Content' },
    { id: 'pricing', label: 'Pricing', icon: '\uD83D\uDCB0', section: 'Settings' },
    { id: 'billing', label: 'Billing & Usage', icon: '\uD83D\uDCB0', section: 'Settings' },
    { id: 'settings', label: 'Settings', icon: '\u2699\uFE0F', section: 'Settings' },
  ];

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return React.createElement(DashboardPage);
      case 'analyze': return React.createElement(AnalyzePage);
      case 'competitors': return React.createElement(CompetitorsPage);
      case 'discover': return React.createElement(DiscoverPage);
      case 'ideas': return React.createElement(IdeasPage);
      case 'watch': return React.createElement(WatchPage);
      case 'calendar': return React.createElement(CalendarPage);
      case 'reports': return React.createElement(ReportsPage);
      case 'saved-ideas': return React.createElement(SavedIdeasPage);
      case 'repurpose': return React.createElement(RepurposePage);
      case 'seo': return React.createElement(SeoPage);
      case 'thumbnail-test': return React.createElement(ThumbnailTestPage);
      case 'trends': return React.createElement(TrendAlertsPage);
      case 'comments': return React.createElement(CommentsPage);
      case 'publishing': return React.createElement(PublishingPage);
      case 'pricing': return React.createElement(PricingPage);
      case 'billing': return React.createElement(BillingPage);
      case 'settings': return React.createElement(SettingsPage);
      case 'onboarding': return React.createElement(OnboardingPage);
      default: return React.createElement(DashboardPage);
    }
  };

  return React.createElement('div', { className: 'app-layout' },
    React.createElement('aside', { className: `sidebar${sidebarOpen ? ' open' : ''}` },
      React.createElement('div', { className: 'sidebar-logo' },
        React.createElement('svg', { viewBox: '0 0 24 24', fill: 'currentColor' },
          React.createElement('path', { d: 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z' }),
        ),
        React.createElement('span', null, 'Creator Radar'),
      ),
      React.createElement('nav', { className: 'sidebar-nav' },
        ...['Main', 'Content', 'Settings'].map(section =>
          React.createElement(React.Fragment, { key: section },
            React.createElement('div', { className: 'nav-section' }, section),
            ...navItems.filter(n => n.section === section).map(item =>
              React.createElement('button', {
                key: item.id,
                className: `nav-item${page === item.id ? ' active' : ''}`,
                onClick: () => { setPage(item.id); setSidebarOpen(false); },
              },
                item.icon, ' ', item.label,
                item.badge ? React.createElement('span', { className: 'badge' }, item.badge) : null,
              ),
            ),
          ),
        ),
      ),
    ),
    React.createElement('div', { className: 'main-area' },
      React.createElement('header', { className: 'topbar' },
        React.createElement('button', { className: 'icon-btn menu-toggle', onClick: () => setSidebarOpen(!sidebarOpen), style: { display: 'none' } },
          React.createElement('svg', { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, width: 22, height: 22 },
            React.createElement('line', { x1: 3, y1: 6, x2: 21, y2: 6 }),
            React.createElement('line', { x1: 3, y1: 12, x2: 21, y2: 12 }),
            React.createElement('line', { x1: 3, y1: 18, x2: 21, y2: 18 }),
          ),
        ),
        React.createElement('div', { style: { flex: 1, display: 'flex', alignItems: 'center', gap: 8 } },
          React.createElement('span', { style: { fontSize: '.85rem', color: 'var(--text2)', fontWeight: 600 } }, user?.email || ''),
          React.createElement('span', { className: 'tag', style: { fontSize: '.7rem', padding: '2px 8px' } }, user?.plan || 'free'),
        ),
        React.createElement('div', { className: 'topbar-actions' },
          React.createElement('button', { className: 'icon-btn', onClick: () => window.location.hash = 'settings', title: 'Settings' }, '\u2699\uFE0F'),
          React.createElement('button', { className: 'icon-btn', onClick: logout, title: 'Sign out' }, '\uD83D\uDEAA'),
        ),
      ),
      React.createElement('main', { className: 'page-content' }, renderPage()),
    ),
  );
}

// ── Router ────────────────────────────────────────────────────────────
function App() {
  const { user } = useAuth();
  const [page, setPage] = useState('dashboard');
  const [onboarding, setOnboarding] = useState(false);

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      const valid = ['dashboard', 'analyze', 'competitors', 'discover', 'ideas', 'watch', 'calendar', 'reports', 'saved-ideas', 'repurpose', 'seo', 'thumbnail-test', 'trends', 'comments', 'publishing', 'pricing', 'billing', 'settings', 'onboarding', 'login', 'register'];
      if (valid.includes(hash)) setPage(hash);
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  useEffect(() => {
    if (user && !localStorage.getItem('ccr_onboarding_done')) {
      localStorage.setItem('ccr_onboarding_done', '1');
      setPage('onboarding');
    }
  }, [user]);

  if (!user) {
    if (page === 'register') return React.createElement(RegisterPage);
    if (page === 'pricing') return React.createElement(PricingPage);
    return React.createElement(LoginPage);
  }

  return React.createElement(AppShell, { page, setPage });
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(AuthProvider, null, React.createElement(App))
);

const style = document.createElement('style');
style.textContent = `@media(max-width:768px){.menu-toggle{display:flex!important}}`;
document.head.appendChild(style);
