/* global React, ReactDOM, Chart */
const { useState, useEffect, useRef, createContext, useContext, useCallback } = React;

// ── Auth Context ──────────────────────────────────────────────────────
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

// ── Helpers ───────────────────────────────────────────────────────────
function fmtNum(n) {
  if (n == null) return '—';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return n.toLocaleString();
}

const PLATFORM_CONFIG = {
  youtube: { icon: '\u25B6', cls: 'yt', color: '#ff0000', bg: 'rgba(255,0,0,.15)' },
  reddit: { icon: 'R', cls: 'reddit', color: '#ff4500', bg: 'rgba(255,69,0,.15)' },
  twitter: { icon: 'X', cls: 'twitter', color: '#1da1f2', bg: 'rgba(29,161,242,.15)' },
  twitch: { icon: '\uD83C\uDFAE', cls: 'twitch', color: '#a970ff', bg: 'rgba(169,112,255,.15)' },
  hn: { icon: 'Y', cls: 'hn', color: '#f60', bg: 'rgba(255,102,0,.15)' },
  trends: { icon: '\uD83D\uDCC8', cls: 'trends', color: '#4285f4', bg: 'rgba(66,133,244,.15)' },
  rss: { icon: '\uD83D\uDCE1', cls: 'rss', color: '#ffa500', bg: 'rgba(255,165,0,.15)' },
  instagram: { icon: '\uD83D\uDCF7', cls: 'instagram', color: '#e1306c', bg: 'rgba(225,48,108,.15)' },
  tiktok: { icon: '\uD83C\uDFA7', cls: 'tiktok', color: '#00f2ea', bg: 'rgba(0,242,234,.15)' },
};

function getPlatformConfig(p) { return PLATFORM_CONFIG[p] || { icon: '?', cls: '', color: '#888', bg: 'rgba(128,128,128,.15)' }; }

function getTheme() { return document.documentElement.getAttribute('data-theme') || 'dark'; }
function isDark() { return getTheme() === 'dark'; }

// ── Chart Manager ─────────────────────────────────────────────────────
const chartInstances = {};
function safeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new Chart(canvas, config);
}

// ── Components ────────────────────────────────────────────────────────
function Skeleton({ count = 3 }) {
  return React.createElement('div', null,
    Array.from({ length: count }, (_, i) =>
      React.createElement('div', { key: i, className: 'card' },
        React.createElement('div', { className: 'skeleton', style: { height: 24, width: '60%', marginBottom: 8 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 24, width: '80%', marginBottom: 8 } }),
        React.createElement('div', { className: 'skeleton', style: { height: 100, width: '100%' } }),
      )
    )
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
    change ? React.createElement('div', { className: `change ${changeDir}` }, change) : null,
  );
}

function ContentItem({ item }) {
  const cfg = getPlatformConfig(item.platform);
  const m = item.raw_metrics || {};
  const tagClass = item.classification === 'trending' ? 'tag' : item.classification === 'popular' ? 'tag' : 'tag';
  return React.createElement('a', { href: item.url, target: '_blank', className: 'content-item' },
    React.createElement('div', { className: 'platform-badge', style: { background: cfg.bg, color: cfg.color } }, cfg.icon),
    React.createElement('div', { style: { flex: 1, minWidth: 0 } },
      React.createElement('div', { className: 'content-title', style: { fontWeight: 600, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '.9rem' } }, item.title),
      React.createElement('div', { style: { display: 'flex', gap: 12, fontSize: '.8rem', color: 'var(--text3)', flexWrap: 'wrap' } },
        React.createElement('span', null, `\uD83D\uDCCD ${item.source || item.platform}`),
        React.createElement('span', null, `\uD83D\uDCCA ${fmtNum(item.engagement_score)}`),
        m.views ? React.createElement('span', null, `\uD83D\uDC41 ${fmtNum(m.views)}`) : null,
        m.likes ? React.createElement('span', null, `\uD83D\uDC4D ${fmtNum(m.likes)}`) : null,
        React.createElement('span', { className: `tag ${tagClass}` }, item.classification || 'new'),
      ),
    ),
  );
}

function StatRow({ label, value }) {
  return React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)', fontSize: '.85rem' } },
    React.createElement('span', { style: { color: 'var(--text3)' } }, label),
    React.createElement('span', { style: { color: 'var(--text)', fontWeight: 600 } }, value),
  );
}

// ── Pages ─────────────────────────────────────────────────────────────
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
        React.createElement('input', { className: 'input', type: 'password', value: password, onChange: e => setPassword(e.target.value), placeholder: '••••••••', required: true }),
      ),
      React.createElement('button', { type: 'submit', className: 'btn btn-primary', style: { width: '100%', justifyContent: 'center' }, disabled: loading },
        loading ? 'Signing in...' : 'Sign In',
      ),
      React.createElement('p', { style: { textAlign: 'center', marginTop: 16, fontSize: '.85rem', color: 'var(--text3)' } },
        "Don't have an account? ",
        React.createElement('a', { href: '#register', style: { color: 'var(--accent)', textDecoration: 'none' } }, 'Register'),
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

// ── Dashboard ─────────────────────────────────────────────────────────
function DashboardPage() {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setData(null);
    try {
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
      React.createElement('div', { className: 'chart-grid' },
        React.createElement('div', { className: 'card' },
          React.createElement('div', { className: 'card-header' },
            React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83D\uDCC8'),
            React.createElement('h2', null, `Google Trends: ${data.trends?.topic || p.niche || 'Niche'}`),
          ),
          React.createElement('div', { className: 'chart-container' },
            React.createElement('canvas', { id: 'trend-chart' }),
          ),
        ),
        React.createElement('div', { className: 'card' },
          React.createElement('div', { className: 'card-header' },
            React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,68,68,.15)', color: 'var(--primary)' } }, '\u25B6'),
            React.createElement('h2', null, 'Market Position'),
          ),
          c ? React.createElement('div', null,
            React.createElement('p', { style: { color: 'var(--text2)', marginBottom: 8 } }, React.createElement('strong', { style: { color: 'var(--success)' } }, 'Position: '), c.market_position || 'Analyzing...'),
            React.createElement('p', { style: { color: 'var(--text2)', marginBottom: 8 } }, React.createElement('strong', { style: { color: 'var(--accent)' } }, 'Advantage: '), c.competitive_advantage || 'Niche expertise'),
            React.createElement('p', { style: { color: 'var(--text2)' } }, React.createElement('strong', { style: { color: 'var(--warning)' } }, 'Threat Level: '), c.threat_level || 'Low'),
          ) : null,
        ),
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
    ) : null,
  );
}

// ── Channel Analysis ──────────────────────────────────────────────────
function AnalyzePage() {
  const { api } = useAuth();
  const [url, setUrl] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const res = await api('/analyze-channel', { method: 'POST', body: JSON.stringify({ channel_url: url }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) { setResult(d); }
      else { setErr(d.detail || 'Analysis failed'); }
    } catch (ex) { setErr('Network error'); }
    finally { setLoading(false); }
  };

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Channel Analysis'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Deep dive into your channel\'s performance'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-icon', style: { background: 'rgba(255,68,68,.15)', color: 'var(--primary)' } }, '\uD83D\uDCFA'),
        React.createElement('h2', null, 'Analyze a Channel'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 600 } },
        React.createElement('input', { className: 'input', placeholder: 'YouTube URL, @handle, or channel ID...', value: url, onChange: e => setUrl(e.target.value), onKeyDown: e => e.key === 'Enter' && analyze() }),
        React.createElement('button', { className: 'btn btn-primary', onClick: analyze, disabled: loading }, loading ? 'Analyzing...' : 'Analyze'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    result && result.job_id ? React.createElement('div', { className: 'insight' },
      React.createElement('h3', null, '\u2699\uFE0F Analysis Submitted'),
      React.createElement('p', null, `Job ID: ${result.job_id}. Check the status at ${result.status_url || '/api/jobs/' + result.job_id}`),
    ) : null,
    !result && !loading ? React.createElement('div', { className: 'empty-state' },
      React.createElement('div', { className: 'emoji' }, '\uD83D\uDD0D'),
      React.createElement('p', null, 'Enter a channel URL to begin analysis'),
    ) : null,
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

  return React.createElement('div', null,
    React.createElement('h1', { style: { fontSize: '1.5rem', fontWeight: 700, marginBottom: 4 } }, 'Competitor Analysis'),
    React.createElement('p', { style: { color: 'var(--text3)', fontSize: '.9rem', marginBottom: 20 } }, 'Discover and analyze competing channels'),
    React.createElement('div', { className: 'card' },
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83D\uDC65'),
        React.createElement('h2', null, 'Find Competitors'),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, maxWidth: 500 } },
        React.createElement('input', { className: 'input', placeholder: 'YouTube channel ID...', value: channelId, onChange: e => setChannelId(e.target.value), onKeyDown: e => e.key === 'Enter' && find() }),
        React.createElement('button', { className: 'btn btn-accent', onClick: find, disabled: loading }, loading ? 'Searching...' : 'Search'),
      ),
      React.createElement(LoadingBar, { active: loading }),
      React.createElement(ErrorBox, { message: err }),
    ),
    competitors?.length ? React.createElement('div', { className: 'card' },
      React.createElement('h3', { style: { fontSize: '.9rem', color: 'var(--text2)', marginBottom: 10 } }, `Found ${competitors.length} competitors`),
      React.createElement('div', { className: 'competitor-grid' },
        competitors.map((co, i) =>
          React.createElement('div', { key: i, className: 'competitor-card' },
            React.createElement('div', { className: 'name' }, co.title),
            React.createElement('div', { className: 'note' }, co.relevance_note || ''),
            React.createElement('div', { className: 'subs' }, `${fmtNum(co.subscriber_count)} subs`),
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
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83D\uDD0D'),
        React.createElement('h2', null, 'Multi-Source Search'),
      ),
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
    } catch (ex) { /* ignore */ }
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
      React.createElement('div', { className: 'card-header' },
        React.createElement('div', { className: 'card-icon', style: { background: 'rgba(62,166,255,.15)', color: 'var(--accent)' } }, '\uD83D\uDCB0'),
        React.createElement('h2', null, 'Subscription Plans'),
      ),
      React.createElement('div', { className: 'stats', style: { marginBottom: 0 } },
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Free'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, '3 analyses/mo'),
          usage?.plan === 'free' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, disabled: true }, 'Current'),
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Pro'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, '50 analyses/mo'),
          usage?.plan === 'pro' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-primary', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, onClick: () => openCheckout('pro') }, 'Upgrade'),
        ),
        React.createElement('div', { className: 'stat' },
          React.createElement('div', { className: 'label' }, 'Business'),
          React.createElement('div', { className: 'value', style: { fontSize: '1rem' } }, 'Unlimited'),
          usage?.plan === 'business' ? React.createElement('div', { className: 'change up' }, 'Current') : React.createElement('button', { className: 'btn btn-accent', style: { marginTop: 8, width: '100%', justifyContent: 'center', padding: '6px 12px', fontSize: '.8rem' }, onClick: () => openCheckout('business') }, 'Upgrade'),
        ),
      ),
      usage?.plan !== 'free' ? React.createElement('button', { className: 'btn btn-ghost', style: { marginTop: 12 }, onClick: openPortal, disabled: portalLoading },
        portalLoading ? 'Loading...' : 'Manage Subscription',
      ) : null,
    ),
  );
}

// ── App Shell ─────────────────────────────────────────────────────────
function AppShell({ page, setPage }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '\uD83D\uDCCA', section: 'Main' },
    { id: 'analyze', label: 'Channel Analysis', icon: '\uD83D\uDCFA', section: 'Main' },
    { id: 'competitors', label: 'Competitors', icon: '\uD83D\uDC65', section: 'Main' },
    { id: 'discover', label: 'Content Discovery', icon: '\uD83D\uDD0D', section: 'Main' },
    { id: 'billing', label: 'Billing & Usage', icon: '\uD83D\uDCB0', section: 'Settings' },
  ];

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return React.createElement(DashboardPage);
      case 'analyze': return React.createElement(AnalyzePage);
      case 'competitors': return React.createElement(CompetitorsPage);
      case 'discover': return React.createElement(DiscoverPage);
      case 'billing': return React.createElement(BillingPage);
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
        ...['Main', 'Settings'].map(section =>
          React.createElement(React.Fragment, { key: section },
            React.createElement('div', { className: 'nav-section' }, section),
            ...navItems.filter(n => n.section === section).map(item =>
              React.createElement('button', {
                key: item.id,
                className: `nav-item${page === item.id ? ' active' : ''}`,
                onClick: () => { setPage(item.id); setSidebarOpen(false); },
              }, item.icon, ' ', item.label),
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
        React.createElement('div', { className: 'topbar-search' },
          React.createElement('input', { placeholder: 'Search channels, topics, or paste URL...' }),
          React.createElement('button', { className: 'icon-btn' }, '\uD83D\uDD0D'),
        ),
        React.createElement('div', { className: 'topbar-actions' },
          React.createElement('span', { style: { fontSize: '.85rem', color: 'var(--text2)' } }, user?.email || ''),
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

  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace('#', '') || 'dashboard';
      if (['dashboard', 'analyze', 'competitors', 'discover', 'billing', 'login', 'register'].includes(hash)) {
        setPage(hash);
      }
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    window.location.hash = page;
  }, [page]);

  if (!user) {
    if (page === 'register') return React.createElement(RegisterPage);
    return React.createElement(LoginPage);
  }

  return React.createElement(AppShell, { page, setPage });
}

// ── Mount ─────────────────────────────────────────────────────────────
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  React.createElement(AuthProvider, null, React.createElement(App))
);

// Inject responsive menu-toggle display
const style = document.createElement('style');
style.textContent = `@media(max-width:768px){.menu-toggle{display:flex!important}}`;
document.head.appendChild(style);
