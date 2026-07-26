// app.jsx
var { useState, useEffect, useRef, createContext, useContext, useCallback } = React;
var AuthContext = createContext(null);
var ToastContext = createContext(null);
function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info", duration = 3500) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), duration);
  }, []);
  const container = toasts.length ? React.createElement(
    "div",
    { className: "toast-container" },
    ...toasts.map((t) => React.createElement(
      "div",
      { key: t.id, className: `toast ${t.type}` },
      t.type === "success" ? "\u2705" : t.type === "error" ? "\u274C" : "\u2139\uFE0F",
      " ",
      t.message
    ))
  ) : null;
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(ToastContext.Provider, { value: add }, children),
    container
  );
}
function useToast() {
  return useContext(ToastContext);
}
function AuthProvider({ children }) {
  const [user, setUser] = useState(() => JSON.parse(localStorage.getItem("ccr_user") || "null"));
  const [token, setToken] = useState(() => localStorage.getItem("ccr_token") || "");
  const login = useCallback((t, u) => {
    setToken(t);
    setUser(u);
    localStorage.setItem("ccr_token", t);
    localStorage.setItem("ccr_user", JSON.stringify(u));
  }, []);
  const logout = useCallback(() => {
    setToken("");
    setUser(null);
    localStorage.removeItem("ccr_token");
    localStorage.removeItem("ccr_user");
  }, []);
  const api = useCallback(async (path, opts = {}) => {
    const headers = { "Content-Type": "application/json", ...opts.headers };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(path, { ...opts, headers });
    if (res.status === 401) {
      logout();
      return null;
    }
    return res;
  }, [token, logout]);
  return React.createElement(AuthContext.Provider, { value: { user, token, login, logout, api } }, children);
}
function useAuth() {
  return useContext(AuthContext);
}
function fmtNum(n) {
  if (n == null) return "\u2014";
  if (n >= 1e6) return (n / 1e6).toFixed(1) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return n.toLocaleString();
}
function isDark() {
  return (document.documentElement.getAttribute("data-theme") || "dark") === "dark";
}
function chartColors() {
  const cs = getComputedStyle(document.body);
  return {
    text: cs.getPropertyValue("--text-2").trim() || "#a0a0b0",
    grid: cs.getPropertyValue("--border").trim() || "rgba(255,255,255,.06)",
    primary: cs.getPropertyValue("--primary").trim() || "#ff2d55",
    accent: cs.getPropertyValue("--accent").trim() || "#3b82f6",
    success: cs.getPropertyValue("--success").trim() || "#22c55e",
    error: cs.getPropertyValue("--error").trim() || "#ef4444"
  };
}
var chartInstances = {};
function safeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const canvas = document.getElementById(id);
  if (!canvas) return;
  chartInstances[id] = new Chart(canvas, config);
}
var PLATFORM_CONFIG = {
  youtube: { icon: "\u25B6", color: "#ff0000", bg: "rgba(255,0,0,.15)" },
  reddit: { icon: "R", color: "#ff4500", bg: "rgba(255,69,0,.15)" },
  twitter: { icon: "X", color: "#1da1f2", bg: "rgba(29,161,242,.15)" },
  twitch: { icon: "\u{1F3AE}", color: "#a970ff", bg: "rgba(169,112,255,.15)" },
  hn: { icon: "Y", color: "#f60", bg: "rgba(255,102,0,.15)" },
  trends: { icon: "\u{1F4C8}", color: "#4285f4", bg: "rgba(66,133,244,.15)" },
  rss: { icon: "\u{1F4E1}", color: "#ffa500", bg: "rgba(255,165,0,.15)" },
  instagram: { icon: "\u{1F4F7}", color: "#e1306c", bg: "rgba(225,48,108,.15)" },
  tiktok: { icon: "\u{1F3A7}", color: "#00f2ea", bg: "rgba(0,242,234,.15)" },
  google: { icon: "G", color: "#4285f4", bg: "rgba(66,133,244,.15)" }
};
function getPlatformConfig(p) {
  return PLATFORM_CONFIG[p] || { icon: "?", color: "#888", bg: "rgba(128,128,128,.15)" };
}
function Skeleton({ count = 3 }) {
  return React.createElement(
    "div",
    null,
    Array.from(
      { length: count },
      (_, i) => React.createElement(
        "div",
        { key: i, className: "card" },
        React.createElement("div", { className: "skeleton", style: { height: 24, width: "60%", marginBottom: 8 } }),
        React.createElement("div", { className: "skeleton", style: { height: 16, width: "80%", marginBottom: 8 } }),
        React.createElement("div", { className: "skeleton", style: { height: 120, width: "100%" } })
      )
    )
  );
}
function ErrorBox({ message }) {
  if (!message) return null;
  return React.createElement("div", { className: "error-box" }, message);
}
function StatCard({ label, value, change, changeDir = "up" }) {
  return React.createElement(
    "div",
    { className: "stat" },
    React.createElement("div", { className: "label" }, label),
    React.createElement("div", { className: "value" }, fmtNum(value)),
    change ? React.createElement("div", { className: `change ${changeDir}` }, change) : null
  );
}
function ContentItem({ item }) {
  const cfg = getPlatformConfig(item.platform);
  const m = item.raw_metrics || {};
  return React.createElement(
    "a",
    { href: item.url, target: "_blank", className: "content-item" },
    React.createElement("div", { className: "platform-badge", style: { background: cfg.bg, color: cfg.color } }, cfg.icon),
    React.createElement(
      "div",
      { style: { flex: 1, minWidth: 0 } },
      React.createElement("div", { style: { fontWeight: 600, marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".9rem" } }, item.title),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 12, fontSize: ".8rem", color: "var(--text-3)", flexWrap: "wrap" } },
        React.createElement("span", null, `\u{1F4CD} ${item.source || item.platform}`),
        React.createElement("span", null, `\u{1F4CA} ${fmtNum(item.engagement_score)}`),
        m.views ? React.createElement("span", null, `\u{1F441} ${fmtNum(m.views)}`) : null,
        m.likes ? React.createElement("span", null, `\u{1F44D} ${fmtNum(m.likes)}`) : null,
        item.classification ? React.createElement("span", { className: `badge badge-${item.classification === "trending" ? "primary" : item.classification === "popular" ? "accent" : "success"}` }, item.classification) : null
      )
    )
  );
}
function EmptyState({ icon, title, text, action }) {
  return React.createElement(
    "div",
    { className: "empty-state" },
    React.createElement("div", { className: "emoji" }, icon || "\u{1F4C2}"),
    title ? React.createElement("h2", null, title) : null,
    React.createElement("p", null, text || "No data yet"),
    action || null
  );
}
function PageHeader({ title, subtitle, action }) {
  return React.createElement(
    "div",
    { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 } },
    React.createElement(
      "div",
      null,
      React.createElement("h1", { style: { fontSize: "1.5rem", fontWeight: 800, marginBottom: 4, letterSpacing: "-.02em" } }, title),
      subtitle ? React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".9rem", lineHeight: 1.5 } }, subtitle) : null
    ),
    action || null
  );
}
function scoreColor(s) {
  s = Number(s);
  return s >= 80 ? "var(--success)" : s >= 50 ? "var(--warning)" : "var(--error)";
}
function LoginPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (res.ok) {
        login(d.access_token, d.user);
        toast("Welcome back!", "success");
      } else {
        setErr(d.detail || "Login failed");
        setLoading(false);
      }
    } catch {
      setErr("Network error");
      setLoading(false);
    }
  };
  return React.createElement(
    "div",
    { className: "auth-page" },
    React.createElement(
      "div",
      { className: "auth-card" },
      React.createElement(
        "div",
        { style: { textAlign: "center", marginBottom: 28 } },
        React.createElement(
          "div",
          { style: { width: 52, height: 52, borderRadius: "50%", background: "var(--primary-muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "1.5rem" } },
          React.createElement("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--primary)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("circle", { cx: 12, cy: 12, r: 10 }), React.createElement("path", { d: "M12 6v6l4 2" }))
        ),
        React.createElement("h1", null, "Welcome back"),
        React.createElement("p", { className: "subtitle" }, "Sign in to PopSearch")
      ),
      err ? React.createElement("div", { className: "error-box", style: { marginBottom: 16 } }, err) : null,
      React.createElement(
        "form",
        { onSubmit: handleSubmit },
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", null, "Email"),
          React.createElement("input", { className: "input", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true })
        ),
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", null, "Password"),
          React.createElement("input", { className: "input", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Enter your password", required: true })
        ),
        React.createElement(
          "button",
          { type: "submit", className: "btn btn-primary", style: { width: "100%", justifyContent: "center", marginTop: 4 }, disabled: loading },
          loading ? React.createElement("span", { className: "spinner" }) : null,
          loading ? "Signing in..." : "Sign In"
        )
      ),
      React.createElement(
        "p",
        { style: { textAlign: "center", marginTop: 20, fontSize: ".85rem", color: "var(--text-3)" } },
        "Don't have an account? ",
        React.createElement("a", { href: "#register", style: { color: "var(--accent)", textDecoration: "none", fontWeight: 600 } }, "Create one")
      )
    )
  );
}
function RegisterPage() {
  const { login } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
      const d = await res.json();
      if (res.ok) {
        login(d.access_token, d.user);
        toast("Account created!", "success");
      } else {
        setErr(d.detail || "Registration failed");
        setLoading(false);
      }
    } catch {
      setErr("Network error");
      setLoading(false);
    }
  };
  return React.createElement(
    "div",
    { className: "auth-page" },
    React.createElement(
      "div",
      { className: "auth-card" },
      React.createElement(
        "div",
        { style: { textAlign: "center", marginBottom: 28 } },
        React.createElement(
          "div",
          { style: { width: 52, height: 52, borderRadius: "50%", background: "var(--accent-muted)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontSize: "1.5rem" } },
          React.createElement("svg", { width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "var(--accent)", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" }, React.createElement("path", { d: "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" }), React.createElement("circle", { cx: 8.5, cy: 7, r: 4 }), React.createElement("line", { x1: 20, y1: 8, x2: 20, y2: 14 }), React.createElement("line", { x1: 23, y1: 11, x2: 17, y2: 11 }))
        ),
        React.createElement("h1", null, "Create your account"),
        React.createElement("p", { className: "subtitle" }, "Join PopSearch for free")
      ),
      err ? React.createElement("div", { className: "error-box", style: { marginBottom: 16 } }, err) : null,
      React.createElement(
        "form",
        { onSubmit: handleSubmit },
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", null, "Email"),
          React.createElement("input", { className: "input", type: "email", value: email, onChange: (e) => setEmail(e.target.value), placeholder: "you@example.com", required: true })
        ),
        React.createElement(
          "div",
          { className: "form-group" },
          React.createElement("label", null, "Password"),
          React.createElement("input", { className: "input", type: "password", value: password, onChange: (e) => setPassword(e.target.value), placeholder: "Minimum 8 characters", required: true, minLength: 8 })
        ),
        React.createElement(
          "button",
          { type: "submit", className: "btn btn-primary", style: { width: "100%", justifyContent: "center", marginTop: 4 }, disabled: loading },
          loading ? React.createElement("span", { className: "spinner" }) : null,
          loading ? "Creating account..." : "Create Account"
        )
      ),
      React.createElement(
        "p",
        { style: { textAlign: "center", marginTop: 20, fontSize: ".85rem", color: "var(--text-3)" } },
        "Already have an account? ",
        React.createElement("a", { href: "#login", style: { color: "var(--accent)", textDecoration: "none", fontWeight: 600 } }, "Sign in")
      )
    )
  );
}
function DashboardPage() {
  const { api } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState(() => localStorage.getItem("ccr_last_url") || "");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const load = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErr("");
    setData(null);
    try {
      localStorage.setItem("ccr_last_url", url);
      const res = await api("/dashboard", { method: "POST", body: JSON.stringify({ channel_url: url, topic: "" }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setTimeout(() => renderCharts(d), 150);
      } else {
        setErr(d.detail || "Analysis failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const renderCharts = (d) => {
    const c = chartColors();
    const profile = d.profile;
    if (d.trends?.interest_over_time?.length) {
      const labels = d.trends.interest_over_time.map((x) => x.label);
      const values = d.trends.interest_over_time.map((x) => x.value);
      safeChart("dash-trend", {
        type: "line",
        data: { labels, datasets: [{ label: "Interest", data: values, borderColor: c.primary, backgroundColor: c.primary + "15", fill: true, tension: 0.4, pointRadius: 3, borderWidth: 2 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: c.grid }, ticks: { color: c.text, maxTicksLimit: 8 } }, y: { grid: { color: c.grid }, ticks: { color: c.text } } } }
      });
    }
    if (profile?.performance_summary) {
      const ps2 = profile.performance_summary;
      const engLabels = ["Views", "Engagement", "Growth"];
      const engValues = [ps2.average_views_last_30d || 0, profile.engagement_rate || 0, ps2.growth_rate || 0];
      safeChart("dash-donut", {
        type: "doughnut",
        data: { labels: engLabels, datasets: [{ data: engValues.map((v) => Math.max(v, 1)), backgroundColor: [c.primary, c.accent, c.success], borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { color: c.text, padding: 12, font: { size: 11 } } } }, cutout: "65%" }
      });
    }
  };
  useEffect(() => {
    const u = localStorage.getItem("ccr_last_url");
    if (u) {
      setUrl(u);
    }
  }, []);
  const p = data?.profile;
  const ps = p?.performance_summary;
  return React.createElement(
    "div",
    null,
    PageHeader({
      title: "Dashboard",
      subtitle: "Your YouTube channel at a glance",
      action: data ? React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => {
        const fn = `/api/analyze/${p?.channel_id}/export?format=csv`;
        window.open(fn, "_blank");
      } }, "\u{1F4C4} Export CSV") : null
    }),
    React.createElement(
      "div",
      { style: { display: "flex", gap: 8, marginBottom: 24, maxWidth: 500 } },
      React.createElement("input", { className: "input", placeholder: "YouTube URL or @handle...", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && load() }),
      React.createElement("button", { className: "btn btn-primary", onClick: load, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "\u{1F50D} Analyze")
    ),
    React.createElement(ErrorBox, { message: err }),
    loading ? React.createElement(Skeleton, { count: 4 }) : null,
    !data && !loading ? EmptyState({ icon: "\u{1F4FA}", title: "Welcome to PopSearch", text: "Enter a YouTube channel URL above to analyze performance, find competitors, and discover content ideas.", action: React.createElement("button", { className: "btn btn-primary", style: { marginTop: 16 }, onClick: () => window.location.hash = "pricing" }, "View Plans") }) : null,
    data && p ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "stats" },
        React.createElement(StatCard, { label: "Subscribers", value: p.subscriber_count, change: p.channel_tier || "Niche: " + (p.niche || "N/A") }),
        React.createElement(StatCard, { label: "Total Views", value: p.view_count, change: fmtNum(p.total_uploads || p.video_count) + " videos" }),
        React.createElement(StatCard, { label: "Engagement Rate", value: (p.engagement_rate || 0).toFixed(1) + "%", change: "Avg " + fmtNum(Math.round(p.average_views_per_video || 0)) + " views" }),
        React.createElement(StatCard, { label: "Uploads", value: p.total_uploads || p.video_count || 0, change: p.upload_frequency || "per month" })
      ),
      React.createElement(
        "div",
        { className: "chart-grid" },
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "card-header" },
            React.createElement("div", { className: "card-icon", style: { background: "var(--primary-muted)", color: "var(--primary)" } }, "\u{1F4C8}"),
            React.createElement("h3", null, "Performance Trend")
          ),
          React.createElement("div", { className: "chart-container" }, React.createElement("canvas", { id: "dash-trend" }))
        ),
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "card-header" },
            React.createElement("div", { className: "card-icon", style: { background: "var(--accent-muted)", color: "var(--accent)" } }, "\u{1F310}"),
            React.createElement("h3", null, "Engagement Breakdown")
          ),
          React.createElement("div", { className: "chart-container" }, React.createElement("canvas", { id: "dash-donut" }))
        )
      ),
      React.createElement(
        "div",
        { className: "chart-grid-2" },
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "card-header" },
            React.createElement("div", { className: "card-icon", style: { background: "rgba(34,197,94,.12)", color: "var(--success)" } }, "\u2B50"),
            React.createElement("h3", null, "Top Videos")
          ),
          p.top_performing_videos?.length ? React.createElement(
            "table",
            { className: "table" },
            React.createElement(
              "thead",
              null,
              React.createElement(
                "tr",
                null,
                React.createElement("th", null, "Title"),
                React.createElement("th", { className: "num" }, "Views"),
                React.createElement("th", { className: "num" }, "Eng.")
              )
            ),
            React.createElement(
              "tbody",
              null,
              p.top_performing_videos.slice(0, 5).map(
                (v, i) => React.createElement(
                  "tr",
                  { key: i },
                  React.createElement("td", { style: { maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: ".85rem" } }, v.title || `Video ${i + 1}`),
                  React.createElement("td", { className: "num", style: { fontSize: ".85rem" } }, fmtNum(v.views)),
                  React.createElement("td", { className: "num", style: { color: (v.engagement_rate || 0) > 5 ? "var(--success)" : "var(--text-2)", fontSize: ".85rem" } }, (v.engagement_rate || 0).toFixed(1) + "%")
                )
              )
            )
          ) : React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem", textAlign: "center", padding: 20 } }, "No video data yet")
        ),
        React.createElement(
          "div",
          { className: "card" },
          React.createElement(
            "div",
            { className: "card-header" },
            React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)", color: "var(--accent)" } }, "\u{1F916}"),
            React.createElement("h3", null, "AI Insights")
          ),
          p.ai_summary ? React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.7 } }, p.ai_summary) : null,
          p.content_recommendations?.length ? React.createElement(
            "ul",
            { className: "rec-list", style: { marginTop: 12 } },
            p.content_recommendations.slice(0, 4).map((r, i) => React.createElement(
              "li",
              { key: i, style: { padding: "8px 0 8px 24px", borderBottom: "1px solid var(--border)", fontSize: ".85rem", color: "var(--text-2)", position: "relative", listStyle: "none" } },
              React.createElement("span", { style: { position: "absolute", left: 0, color: "var(--primary)" }, dangerouslySetInnerHTML: { __html: "&rarr;" } }),
              r
            ))
          ) : null
        )
      ),
      p.content_gaps?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(245,158,11,.12)", color: "var(--warning)" } }, "\u{1F50D}"),
          React.createElement("h3", null, "Content Gaps")
        ),
        React.createElement(
          "div",
          { style: { display: "flex", flexWrap: "wrap", gap: 4 } },
          p.content_gaps.map((g, i) => React.createElement("span", { key: i, className: "tag" }, g))
        )
      ) : null
    ) : null
  );
}
function AnalyzePage() {
  const { api } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const res = await api("/analyze-channel", { method: "POST", body: JSON.stringify({ channel_url: url }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setResult(d);
        toast("Analysis complete!", "success");
      } else {
        setErr(d.detail || "Analysis failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const renderCharts = (d) => {
    const c = chartColors();
    if (d.upload_frequency_by_month?.length) {
      safeChart("analyze-upload", {
        type: "bar",
        data: { labels: d.upload_frequency_by_month.map((x) => x.month), datasets: [{ label: "Uploads", data: d.upload_frequency_by_month.map((x) => x.count), backgroundColor: c.accent + "60", borderColor: c.accent, borderWidth: 1, borderRadius: 4 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: c.grid }, ticks: { color: c.text } }, y: { grid: { color: c.grid }, ticks: { color: c.text } } } }
      });
    }
  };
  useEffect(() => {
    if (result) setTimeout(() => renderCharts(result), 100);
  }, [result]);
  const p = result?.profile || result;
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Channel Analysis", subtitle: "Deep dive into channel performance" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, maxWidth: 600 } },
        React.createElement("input", { className: "input", placeholder: "YouTube URL, @handle, or channel ID...", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && analyze() }),
        React.createElement("button", { className: "btn btn-primary", onClick: analyze, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Analyze")
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 3 }) : null,
    result ? React.createElement(
      "div",
      null,
      p?.title ? React.createElement(
        "div",
        { style: { background: "linear-gradient(135deg, var(--primary), var(--accent))", borderRadius: "var(--radius)", padding: "28px 24px", marginBottom: 20 } },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 16 } },
          React.createElement("div", { style: { width: 64, height: 64, borderRadius: "50%", background: "rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.8rem", fontWeight: 700, color: "#fff", border: "3px solid rgba(255,255,255,.3)" } }, (p.title || "?")[0].toUpperCase()),
          React.createElement(
            "div",
            null,
            React.createElement("h2", { style: { color: "#fff", fontSize: "1.3rem", fontWeight: 700, marginBottom: 2 } }, p.title),
            React.createElement("p", { style: { color: "rgba(255,255,255,.8)", fontSize: ".85rem" } }, `${fmtNum(p.subscriber_count)} subs \xB7 ${p.niche || "N/A"} \xB7 ${p.channel_tier || ""}`)
          )
        )
      ) : null,
      React.createElement(
        "div",
        { className: "stats" },
        React.createElement(StatCard, { label: "Subscribers", value: p.subscriber_count }),
        React.createElement(StatCard, { label: "Views", value: p.view_count }),
        React.createElement(StatCard, { label: "Videos", value: p.video_count }),
        React.createElement(StatCard, { label: "Engagement", value: (p.engagement_rate || 0).toFixed(1) + "%" })
      ),
      result.upload_frequency_by_month?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "var(--accent-muted)", color: "var(--accent)" } }, "\u{1F4C8}"),
          React.createElement("h3", null, "Upload Frequency")
        ),
        React.createElement("div", { className: "chart-container chart-container-sm" }, React.createElement("canvas", { id: "analyze-upload" }))
      ) : null,
      p.ai_summary ? React.createElement(
        "div",
        { className: "card", style: { background: "var(--bg-surface)", border: "1px solid var(--accent-muted)" } },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)", color: "var(--accent)" } }, "\u{1F916}"),
          React.createElement("h3", null, "AI Summary")
        ),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".9rem", lineHeight: 1.7 } }, p.ai_summary)
      ) : null,
      p.content_recommendations?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(34,197,94,.12)", color: "var(--success)" } }, "\u{1F4A1}"),
          React.createElement("h3", null, "Recommendations")
        ),
        React.createElement("ul", { className: "rec-list" }, p.content_recommendations.map((r, i) => React.createElement(
          "li",
          { key: i, style: { padding: "10px 0 10px 28px", borderBottom: "1px solid var(--border)", color: "var(--text-2)", fontSize: ".88rem", position: "relative", listStyle: "none" } },
          React.createElement("span", { style: { position: "absolute", left: 0, color: "var(--primary)" } }, "\u2192"),
          r
        )))
      ) : null,
      p.content_gaps?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(245,158,11,.12)", color: "var(--warning)" } }, "\u{1F50D}"),
          React.createElement("h3", null, "Content Gaps")
        ),
        React.createElement("div", null, p.content_gaps.map((g, i) => React.createElement("span", { key: i, className: "tag" }, g)))
      ) : null,
      p.title_patterns?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)", color: "var(--accent)" } }, "\u{1F4DD}"),
          React.createElement("h3", null, "Title Patterns")
        ),
        React.createElement("div", null, p.title_patterns.map((t, i) => React.createElement("span", { key: i, className: "tag" }, t)))
      ) : null
    ) : !loading ? EmptyState({ icon: "\u{1F50D}", title: "Enter a channel URL", text: "Paste a YouTube channel URL to get a complete analysis" }) : null
  );
}
function CompetitorsPage() {
  const { api } = useAuth();
  const toast = useToast();
  const [channelId, setChannelId] = useState(() => localStorage.getItem("ccr_last_url") || "");
  const [competitors, setCompetitors] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const find = async () => {
    if (!channelId.trim()) return;
    setLoading(true);
    setErr("");
    setCompetitors(null);
    try {
      const res = await api("/find-competitors", { method: "POST", body: JSON.stringify({ channel_url: channelId, niche: "" }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setCompetitors(d);
        toast("Competitors found!", "success");
      } else {
        setErr(d.detail || "Search failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const items = Array.isArray(competitors) ? competitors : competitors?.competitors || [];
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Competitor Analysis", subtitle: "Discover and analyze competing channels" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, maxWidth: 500 } },
        React.createElement("input", { className: "input", placeholder: "YouTube channel URL or @handle...", value: channelId, onChange: (e) => setChannelId(e.target.value), onKeyDown: (e) => e.key === "Enter" && find() }),
        React.createElement("button", { className: "btn btn-accent", onClick: find, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Find Competitors")
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    items.length ? React.createElement(
      "div",
      { className: "competitor-grid", style: { marginTop: 16 } },
      items.map(
        (co, i) => React.createElement(
          "div",
          { key: i, className: "competitor-card", style: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", padding: 20, cursor: "pointer", transition: "all .15s" } },
          React.createElement("div", { className: "name", style: { fontWeight: 700, marginBottom: 4, fontSize: ".95rem" } }, co.title || "Unknown"),
          React.createElement("div", { className: "note", style: { fontSize: ".82rem", color: "var(--text-2)", marginBottom: 8, lineHeight: 1.5 } }, co.relevance_note || ""),
          React.createElement("div", { className: "subs", style: { fontSize: ".8rem", color: "var(--accent)", fontWeight: 600 } }, `${fmtNum(co.subscriber_count)} subs`),
          React.createElement(
            "div",
            { style: { display: "flex", gap: 4, marginTop: 8 } },
            React.createElement("span", { className: "badge", style: { background: (co.overlap_score || 0) > 70 ? "rgba(34,197,94,.12)" : "rgba(245,158,11,.12)", color: (co.overlap_score || 0) > 70 ? "var(--success)" : "var(--warning)", border: "1px solid", borderColor: (co.overlap_score || 0) > 70 ? "rgba(34,197,94,.25)" : "rgba(245,158,11,.25)", fontSize: ".65rem" } }, `${co.overlap_score || 0}% overlap`)
          )
        )
      )
    ) : !loading ? EmptyState({ icon: "\u{1F465}", title: "No competitors yet", text: "Enter a channel to discover similar channels and analyze their performance." }) : null,
    competitors?.market_position ? React.createElement(
      "div",
      { className: "card", style: { marginTop: 16 } },
      React.createElement(
        "div",
        { className: "card-header" },
        React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)", color: "var(--accent)" } }, "\u{1F4CA}"),
        React.createElement("h3", null, "Market Position")
      ),
      React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem" } }, competitors.market_position),
      competitors.competitive_advantage ? React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem", marginTop: 8 } }, competitors.competitive_advantage) : null
    ) : null
  );
}
function DiscoverPage() {
  const { api } = useAuth();
  const [topic, setTopic] = useState("");
  const [channelUrl, setChannelUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [platforms, setPlatforms] = useState({ youtube: true, reddit: true, twitter: true, twitch: true, hn: true, rss: true, tiktok: true, instagram: true });
  const search = async () => {
    if (!topic.trim()) {
      setErr("Enter a topic to search");
      return;
    }
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const enabled = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
      const res = await api("/search-topic", {
        method: "POST",
        body: JSON.stringify({ topic, platforms: enabled, channel_url: channelUrl || void 0 })
      });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setData(d);
        setActiveTab("all");
      } else {
        setErr(d.detail || "Search failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const results = data?.results || data?.cross_platform_content || data?.content || [];
  const groups = {};
  results.forEach((r) => {
    const p = r.platform || "other";
    if (!groups[p]) groups[p] = [];
    groups[p].push(r);
  });
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Content Discovery", subtitle: "Find trending topics across 9+ platforms" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        React.createElement("input", { className: "input", style: { flex: 1, minWidth: 200 }, placeholder: 'Search topic (e.g. "AI tools")...', value: topic, onChange: (e) => setTopic(e.target.value), onKeyDown: (e) => e.key === "Enter" && search() }),
        React.createElement("button", { className: "btn btn-accent", onClick: search, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Search")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", fontSize: ".82rem" } },
        Object.entries(platforms).map(
          ([k, v]) => React.createElement(
            "label",
            { key: k, style: { display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--text-2)" } },
            React.createElement("input", { type: "checkbox", checked: v, onChange: () => setPlatforms((s) => ({ ...s, [k]: !s[k] })) }),
            ` ${k.charAt(0).toUpperCase() + k.slice(1)}`
          )
        )
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 3 }) : null,
    results.length ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "tabs" },
        React.createElement("button", { className: `tab${activeTab === "all" ? " active" : ""}`, onClick: () => setActiveTab("all") }, "All ", React.createElement("span", { className: "badge", style: { background: "var(--bg-elevated)", color: "var(--text-2)", fontSize: ".6rem", padding: "1px 6px", marginLeft: 4 } }, results.length)),
        Object.entries(groups).map(
          ([k, v]) => React.createElement("button", { key: k, className: `tab${activeTab === k ? " active" : ""}`, onClick: () => setActiveTab(k) }, k, " ", React.createElement("span", { className: "badge", style: { background: "var(--bg-elevated)", color: "var(--text-2)", fontSize: ".6rem", padding: "1px 6px", marginLeft: 4 } }, v.length))
        )
      ),
      React.createElement(
        "div",
        { className: "content-list" },
        (activeTab === "all" ? results : groups[activeTab] || []).slice(0, 20).map((item, i) => React.createElement(ContentItem, { key: i, item }))
      )
    ) : !loading ? EmptyState({ icon: "\u{1F30D}", title: "Search for content", text: "Enter a topic to discover content across 9+ platforms." }) : null
  );
}
function IdeasPage() {
  const { api } = useAuth();
  const toast = useToast();
  const [topic, setTopic] = useState("");
  const [ideas, setIdeas] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const generate = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    setErr("");
    setIdeas(null);
    try {
      const res = await api("/api/ideas/generate", { method: "POST", body: JSON.stringify({ topic, channel_url: "" }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setIdeas(d);
        toast("Ideas generated!", "success");
      } else {
        setErr(d.detail || "Generation failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const saveIdea = async (idea) => {
    await api("/api/ideas/save", { method: "POST", body: JSON.stringify({ topic, title: idea.title, description: idea.description }) });
    toast("Idea saved!", "success");
  };
  const ideaList = ideas?.ideas || ideas?.results || (Array.isArray(ideas) ? ideas : []);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Content Idea Generator", subtitle: "AI-powered video concepts with SEO keywords" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, maxWidth: 500 } },
        React.createElement("input", { className: "input", placeholder: 'e.g. "AI tools for creators"', value: topic, onChange: (e) => setTopic(e.target.value), onKeyDown: (e) => e.key === "Enter" && generate() }),
        React.createElement("button", { className: "btn btn-accent", onClick: generate, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Generate")
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    ideaList.length ? React.createElement(
      "div",
      { className: "grid-2", style: { marginTop: 16 } },
      ideaList.slice(0, 6).map(
        (idea, i) => React.createElement(
          "div",
          { key: i, className: "card" },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
            React.createElement("h3", { style: { fontSize: ".95rem", fontWeight: 700, flex: 1 } }, idea.title),
            idea.confidence_score ? React.createElement("span", { className: `badge ${idea.confidence_score > 0.7 ? "badge-success" : "badge-warning"}`, style: { fontSize: ".65rem" } }, `${Math.round(idea.confidence_score * 100)}%`) : null
          ),
          React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".85rem", marginBottom: 12 } }, idea.description),
          idea.seo_keywords?.length ? React.createElement(
            "div",
            null,
            React.createElement("div", { style: { fontSize: ".75rem", color: "var(--text-3)", marginBottom: 4, fontWeight: 600 } }, "SEO Keywords"),
            React.createElement("div", null, idea.seo_keywords.map((kw, j) => React.createElement("span", { key: j, className: "tag" }, kw)))
          ) : null,
          idea.viral_probability !== void 0 ? React.createElement(
            "div",
            { style: { marginTop: 8, display: "flex", gap: 8, alignItems: "center", fontSize: ".82rem" } },
            React.createElement("span", { className: `badge ${idea.viral_probability > 70 ? "badge-primary" : "badge-warning"}`, style: { fontSize: ".65rem" } }, `\u{1F4A5} Viral: ${idea.viral_probability}%`),
            idea.expected_view_min ? React.createElement("span", { style: { color: "var(--text-3)" } }, `${(idea.expected_view_min || 0).toLocaleString()} views`) : null
          ) : null,
          idea.best_time_to_post ? React.createElement("div", { style: { marginTop: 8, fontSize: ".82rem", color: "var(--accent)" } }, `\u23F0 Best: ${idea.best_time_to_post}`) : null,
          React.createElement("button", { className: "btn btn-ghost btn-sm", style: { marginTop: 12, width: "100%", justifyContent: "center" }, onClick: () => saveIdea(idea) }, "\u{1F4BE} Save Idea")
        )
      )
    ) : !loading ? EmptyState({ icon: "\u{1F4A1}", title: "Enter a topic", text: "Get AI-powered video ideas with SEO keywords and thumbnail concepts." }) : null
  );
}
function WatchPage() {
  const { api } = useAuth();
  const [watched, setWatched] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const r = await api("/api/watched-competitors");
      if (r?.ok) setWatched(await r.json());
      setLoading(false);
    })();
  }, [api]);
  if (loading) return React.createElement(Skeleton);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Competitor Monitoring", subtitle: "Track competitors and get alerts" }),
    watched.length ? React.createElement(
      "div",
      { className: "competitor-grid" },
      watched.map((w) => React.createElement(
        "div",
        { key: w.id, className: "card", style: { padding: 16 } },
        React.createElement("div", { style: { fontWeight: 700, fontSize: ".95rem", marginBottom: 4 } }, w.channel_title || w.channel_id),
        React.createElement("div", { style: { color: "var(--text-3)", fontSize: ".82rem", marginBottom: 8 } }, `${fmtNum(w.subscriber_count)} subs`),
        React.createElement("button", { className: "btn btn-ghost btn-sm", style: { width: "100%", justifyContent: "center", borderColor: "var(--error)", color: "var(--error)" }, onClick: async () => {
          await api(`/api/watched-competitors/${w.channel_id}`, { method: "DELETE" });
          setWatched(watched.filter((x) => x.id !== w.id));
        } }, "Stop Watching")
      ))
    ) : EmptyState({ icon: "\u{1F440}", title: "No competitors watched", text: 'Find competitors from the Competitors page and click "Watch" to monitor them.' })
  );
}
function CalendarPage() {
  const { api } = useAuth();
  const now = /* @__PURE__ */ new Date();
  const [month, setMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", event_date: "", event_type: "idea", related_channel_id: "" });
  useEffect(() => {
    (async () => {
      const r = await api(`/api/calendar?month=${month}`);
      if (r?.ok) setEvents(await r.json());
      setLoading(false);
    })();
  }, [api, month]);
  const daysInMonth = new Date(parseInt(month), parseInt(month.split("-")[1]), 0).getDate();
  const firstDay = new Date(parseInt(month), parseInt(month.split("-")[1]) - 1, 1).getDay();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  if (loading) return React.createElement(Skeleton);
  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } },
      React.createElement(
        "div",
        null,
        React.createElement("h1", { style: { fontSize: "1.5rem", fontWeight: 800, marginBottom: 4, letterSpacing: "-.02em" } }, "Content Calendar"),
        React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".9rem" } }, "Plan and schedule your content")
      ),
      React.createElement("button", { className: "btn btn-primary", onClick: () => setShowForm(!showForm) }, showForm ? "Cancel" : "+ Add Event")
    ),
    showForm ? React.createElement(
      "div",
      { className: "card", style: { marginBottom: 16 } },
      React.createElement(
        "div",
        { style: { display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr" } },
        React.createElement("input", { className: "input", placeholder: "Event title", value: form.title, onChange: (e) => setForm((f) => ({ ...f, title: e.target.value })) }),
        React.createElement("input", { className: "input", type: "date", value: form.event_date, onChange: (e) => setForm((f) => ({ ...f, event_date: e.target.value })) }),
        React.createElement(
          "select",
          { className: "input", value: form.event_type, onChange: (e) => setForm((f) => ({ ...f, event_type: e.target.value })) },
          React.createElement("option", { value: "idea" }, "Content Idea"),
          React.createElement("option", { value: "upload" }, "Upload"),
          React.createElement("option", { value: "meeting" }, "Meeting")
        )
      ),
      React.createElement("button", { className: "btn btn-accent", style: { marginTop: 8 }, onClick: async () => {
        const r = await api("/api/calendar", { method: "POST", body: JSON.stringify(form) });
        if (r?.ok) {
          setShowForm(false);
          setForm({ title: "", description: "", event_date: "", event_type: "idea", related_channel_id: "" });
          const fr = await api(`/api/calendar?month=${month}`);
          if (fr?.ok) setEvents(await fr.json());
        }
      }, disabled: !form.title || !form.event_date }, "Save Event")
    ) : null,
    React.createElement(
      "div",
      { style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 16 } },
      React.createElement("button", { className: "btn btn-ghost", style: { padding: "6px 12px" }, onClick: () => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m - 2, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      } }, "\u2190"),
      React.createElement("h2", { style: { fontSize: "1.1rem", fontWeight: 600, minWidth: 160, textAlign: "center" } }, new Date(parseInt(month), parseInt(month.split("-")[1]) - 1).toLocaleString("default", { month: "long", year: "numeric" })),
      React.createElement("button", { className: "btn btn-ghost", style: { padding: "6px 12px" }, onClick: () => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
      } }, "\u2192"),
      React.createElement("button", { className: "btn btn-ghost", style: { padding: "6px 12px", fontSize: ".8rem" }, onClick: () => {
        const n = /* @__PURE__ */ new Date();
        setMonth(`${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}`);
      } }, "Today")
    ),
    React.createElement(
      "div",
      { style: { background: "var(--bg-surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)", overflow: "hidden" } },
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)", background: "var(--bg-elevated)", borderBottom: "1px solid var(--border)" } },
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => React.createElement("div", { key: d, style: { padding: "8px", textAlign: "center", fontSize: ".75rem", color: "var(--text-3)", fontWeight: 600 } }, d))
      ),
      React.createElement(
        "div",
        { style: { display: "grid", gridTemplateColumns: "repeat(7, 1fr)" } },
        Array.from({ length: firstDay }, (_, i) => React.createElement("div", { key: `e${i}`, style: { padding: "4px", minHeight: 70, background: "var(--bg-surface)" } })),
        days.map((d) => {
          const dateStr = `${month}-${String(d).padStart(2, "0")}`;
          const dayEvents = events.filter((e) => e.event_date === dateStr);
          return React.createElement(
            "div",
            { key: d, style: { padding: "4px", minHeight: 70, borderRight: "1px solid var(--border)", borderBottom: "1px solid var(--border)" } },
            React.createElement("div", { style: { fontSize: ".78rem", fontWeight: 600, color: "var(--text-2)", marginBottom: 2 } }, d),
            dayEvents.slice(0, 2).map((ev) => React.createElement("div", { key: ev.id, style: { fontSize: ".68rem", padding: "2px 4px", marginBottom: 2, background: ev.event_type === "upload" ? "rgba(255,45,85,.12)" : "rgba(59,130,246,.12)", borderRadius: 4, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, ev.title)),
            dayEvents.length > 2 ? React.createElement("div", { style: { fontSize: ".62rem", color: "var(--text-3)" } }, `+${dayEvents.length - 2} more`) : null
          );
        })
      )
    )
  );
}
function ReportsPage() {
  const { api } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState(null);
  useEffect(() => {
    (async () => {
      const r = await api("/api/reports");
      if (r?.ok) setReports(await r.json());
      setLoading(false);
    })();
  }, [api]);
  if (loading) return React.createElement(Skeleton);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Reports & Exports", subtitle: "View saved analyses and export reports" }),
    reports.length ? React.createElement(
      "div",
      { className: "card" },
      reports.map((r) => React.createElement(
        "div",
        { key: r.report_id, className: "content-item", style: { marginBottom: 4 }, onClick: () => setSelectedReport(r) },
        React.createElement(
          "div",
          null,
          React.createElement("div", { style: { fontWeight: 600, fontSize: ".9rem" } }, r.channel_title || r.channel_url),
          React.createElement("div", { style: { color: "var(--text-3)", fontSize: ".8rem" } }, r.topic || "Channel analysis", " \xB7 ", new Date(r.created_at).toLocaleDateString())
        )
      ))
    ) : EmptyState({ icon: "\u{1F4C4}", title: "No reports yet", text: "Analyze a channel to see reports here." }),
    selectedReport ? React.createElement(
      "div",
      { className: "card", style: { marginTop: 16 } },
      React.createElement("h3", null, selectedReport.channel_title || "Report"),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, marginTop: 12 } },
        React.createElement("button", { className: "btn btn-accent btn-sm", onClick: () => {
          const fn = `/api/analyze/${selectedReport.channel_id || selectedReport.report_id}/export?format=csv`;
          window.open(fn, "_blank");
        } }, "\u{1F4C4} CSV"),
        React.createElement("button", { className: "btn btn-primary btn-sm", onClick: () => {
          const fn = `/api/analyze/${selectedReport.channel_id || selectedReport.report_id}/export?format=pdf`;
          window.open(fn, "_blank");
        } }, "\u{1F4C4} PDF"),
        React.createElement("button", { className: "btn btn-ghost btn-sm", onClick: () => setSelectedReport(null) }, "Close")
      )
    ) : null
  );
}
function SavedIdeasPage() {
  const { api } = useAuth();
  const [ideas, setIdeas] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const r = await api("/api/ideas?saved_only=true");
      if (r?.ok) setIdeas(await r.json());
      setLoading(false);
    })();
  }, [api]);
  if (loading) return React.createElement(Skeleton);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Saved Ideas", subtitle: "Your saved content ideas" }),
    ideas.length ? React.createElement(
      "div",
      { className: "content-list" },
      ideas.map((idea) => React.createElement(
        "div",
        { key: idea.id, className: "card" },
        React.createElement(
          "div",
          { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
          React.createElement(
            "div",
            null,
            React.createElement("h3", { style: { fontSize: ".95rem", fontWeight: 600 } }, idea.title),
            React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".8rem" } }, "Topic: ", idea.topic)
          ),
          React.createElement("button", { className: "btn btn-ghost btn-sm", style: { borderColor: "var(--error)", color: "var(--error)" }, onClick: async () => {
            await api(`/api/ideas/${idea.id}`, { method: "DELETE" });
            setIdeas(ideas.filter((i) => i.id !== idea.id));
          } }, "Delete")
        )
      ))
    ) : EmptyState({ icon: "\u{1F4BE}", title: "No saved ideas", text: "Generate ideas from the Ideas page and save them here." })
  );
}
function RepurposePage() {
  const { api } = useAuth();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [platforms, setPlatforms] = useState({ tiktok: true, instagram: true });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const repurpose = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const target = Object.entries(platforms).filter(([, v]) => v).map(([k]) => k);
      if (!target.length) {
        setErr("Select at least one platform");
        setLoading(false);
        return;
      }
      const res = await api("/api/repurpose/generate", { method: "POST", body: JSON.stringify({ video_url: url, platforms: target }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setResult(d);
        toast("Scripts generated!", "success");
      } else {
        setErr(d.detail || "Failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const scripts = result?.scripts || result?.results || [];
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Cross-Platform Repurposing", subtitle: "Turn YouTube videos into short-form content" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
        React.createElement("input", { className: "input", style: { flex: 2, minWidth: 250 }, placeholder: "YouTube video URL...", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && repurpose() }),
        React.createElement("button", { className: "btn btn-accent", onClick: repurpose, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Repurpose")
      ),
      React.createElement(
        "div",
        { style: { display: "flex", gap: 16, marginTop: 12, fontSize: ".82rem" } },
        Object.entries(platforms).map(
          ([k, v]) => React.createElement(
            "label",
            { key: k, style: { display: "flex", alignItems: "center", gap: 4, cursor: "pointer", color: "var(--text-2)" } },
            React.createElement("input", { type: "checkbox", checked: v, onChange: () => setPlatforms((p) => ({ ...p, [k]: !p[k] })) }),
            " ",
            k.charAt(0).toUpperCase() + k.slice(1)
          )
        )
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    scripts.length ? React.createElement(
      "div",
      { className: "grid-2", style: { marginTop: 16 } },
      scripts.map((s, i) => React.createElement(
        "div",
        { key: i, className: "card" },
        React.createElement(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
          React.createElement("span", { className: "platform-badge", style: { background: getPlatformConfig(s.platform).bg, color: getPlatformConfig(s.platform).color, width: 28, height: 28, fontSize: ".7rem" } }, getPlatformConfig(s.platform).icon),
          React.createElement("h3", { style: { fontSize: ".9rem" } }, s.platform, " Script", s.duration_seconds ? ` (${s.duration_seconds}s)` : "")
        ),
        React.createElement("pre", { style: { whiteSpace: "pre-wrap", fontSize: ".82rem", color: "var(--text-2)", background: "var(--bg)", padding: 12, borderRadius: "var(--radius-sm)", marginBottom: 8, lineHeight: 1.5, maxHeight: 200, overflowY: "auto" } }, s.script),
        s.tips?.length ? s.tips.map((t, j) => React.createElement("div", { key: j, style: { fontSize: ".78rem", color: "var(--text-3)", padding: "2px 0" } }, `\u{1F4A1} ${t}`)) : null
      ))
    ) : !loading ? EmptyState({ icon: "\u{1F504}", title: "Enter a video URL", text: "Paste a YouTube video URL to generate platform-specific scripts." }) : null
  );
}
function SeoPage() {
  const { api } = useAuth();
  const [channelId, setChannelId] = useState("");
  const [scorecard, setScorecard] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const analyze = async () => {
    if (!channelId.trim()) return;
    setLoading(true);
    setErr("");
    setScorecard(null);
    try {
      const res = await api("/api/seo/score", { method: "POST", body: JSON.stringify({ channel_url: channelId }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setScorecard(d);
      } else {
        setErr(d.detail || "Failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "SEO Scorecard", subtitle: "Analyze search optimization for your channel" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, maxWidth: 500 } },
        React.createElement("input", { className: "input", placeholder: "Channel URL...", value: channelId, onChange: (e) => setChannelId(e.target.value), onKeyDown: (e) => e.key === "Enter" && analyze() }),
        React.createElement("button", { className: "btn btn-accent", onClick: analyze, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Score")
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    scorecard ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "stats", style: { gridTemplateColumns: "repeat(4, 1fr)" } },
        React.createElement(
          "div",
          { className: "stat", style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "2.2rem", fontWeight: 800, color: scoreColor(scorecard.overall_score) } }, scorecard.overall_score),
          React.createElement("div", { className: "label" }, "Overall SEO")
        ),
        ["title_score", "description_score", "tags_score"].map((f) => {
          const label = f.replace("_score", "").replace("_", " ");
          return React.createElement(
            "div",
            { key: f, className: "stat", style: { textAlign: "center" } },
            React.createElement("div", { style: { fontSize: "1.8rem", fontWeight: 700, color: scoreColor(scorecard[f]) } }, scorecard[f]),
            React.createElement("div", { className: "label" }, label)
          );
        })
      ),
      scorecard.recommendations?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)", color: "var(--accent)" } }, "\u{1F4A1}"),
          React.createElement("h3", null, "Recommendations")
        ),
        React.createElement("ul", { className: "rec-list" }, scorecard.recommendations.map((r, i) => React.createElement(
          "li",
          { key: i, style: { padding: "8px 0 8px 24px", borderBottom: "1px solid var(--border)", fontSize: ".85rem", color: "var(--text-2)", position: "relative", listStyle: "none" } },
          React.createElement("span", { style: { position: "absolute", left: 0, color: "var(--primary)" } }, "\u2192"),
          r
        )))
      ) : null
    ) : !loading ? EmptyState({ icon: "\u{1F50D}", title: "Enter a channel", text: "Get an SEO scorecard with optimization recommendations." }) : null
  );
}
function ThumbnailTestPage() {
  const { api } = useAuth();
  const [urlA, setUrlA] = useState("");
  const [urlB, setUrlB] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const test = async () => {
    if (!urlA.trim() || !urlB.trim()) {
      setErr("Both thumbnail URLs are required");
      return;
    }
    setLoading(true);
    setErr("");
    setResult(null);
    try {
      const res = await api("/api/thumbnail-test", { method: "POST", body: JSON.stringify({ thumbnail_a_url: urlA, thumbnail_b_url: urlB }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) {
        setResult(d);
      } else {
        setErr(d.detail || "Test failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "A/B Thumbnail Tester", subtitle: "AI predicts which thumbnail performs better" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "grid", gap: 8, gridTemplateColumns: "1fr 1fr", maxWidth: 600 } },
        React.createElement("input", { className: "input", placeholder: "Thumbnail A URL...", value: urlA, onChange: (e) => setUrlA(e.target.value) }),
        React.createElement("input", { className: "input", placeholder: "Thumbnail B URL...", value: urlB, onChange: (e) => setUrlB(e.target.value) })
      ),
      React.createElement("button", { className: "btn btn-accent", style: { marginTop: 8 }, onClick: test, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Compare"),
      React.createElement(ErrorBox, { message: err })
    ),
    result ? React.createElement(
      "div",
      { className: "grid-2", style: { marginTop: 16 } },
      ["a", "b"].map((side) => {
        const data = result[`thumbnail_${side}`];
        return React.createElement(
          "div",
          { key: side, className: "card", style: { border: result.winner === side.toUpperCase() ? "2px solid var(--success)" : "1px solid var(--border)", textAlign: "center" } },
          React.createElement("div", { style: { fontSize: "2.5rem", fontWeight: 800, color: scoreColor(data?.score * 10) } }, data?.score || 0),
          React.createElement("div", { className: "label", style: { fontSize: ".9rem", marginBottom: 8 } }, `Thumbnail ${side.toUpperCase()}${result.winner === side.toUpperCase() ? " \u{1F3C6}" : ""}`),
          data?.factors?.length ? data.factors.map((f, i) => React.createElement("div", { key: i, style: { fontSize: ".8rem", color: "var(--text-2)", padding: "4px 0", borderBottom: "1px solid var(--border)" } }, f)) : null
        );
      })
    ) : !loading ? EmptyState({ icon: "\u{1F5BC}", title: "Compare thumbnails", text: "Enter two thumbnail URLs to see which one performs better." }) : null
  );
}
function TrendAlertsPage() {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const check = async () => {
    setLoading(true);
    try {
      const res = await api("/api/trends/check", { method: "POST", body: JSON.stringify({}) });
      if (res?.ok) {
        const d = await res.json();
        setAlerts(d.alerts || d.results || d || []);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };
  const items = Array.isArray(alerts) ? alerts : [];
  return React.createElement(
    "div",
    null,
    PageHeader({
      title: "Trend Alerts",
      subtitle: "Discover trending topics in your niche",
      action: React.createElement("button", { className: "btn btn-accent", onClick: check, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "\u{1F514} Check Trends")
    }),
    items.length ? React.createElement(
      "div",
      { className: "content-list" },
      items.map((a, i) => React.createElement(
        "div",
        { key: i, className: "card", style: { padding: 16, borderLeft: `4px solid ${(a.strength || a.severity) === "high" ? "var(--primary)" : "var(--warning)"}` } },
        React.createElement(
          "div",
          { style: { display: "flex", gap: 8, alignItems: "flex-start" } },
          React.createElement("span", { style: { fontSize: "1.1rem" } }, "\u{1F525}"),
          React.createElement(
            "div",
            null,
            React.createElement("p", { style: { fontWeight: 600, fontSize: ".88rem" } }, a.topic || a.title),
            React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".82rem" } }, a.message || a.description),
            a.platform ? React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".75rem", marginTop: 4 } }, `Platform: ${a.platform} \xB7 Strength: ${a.strength || a.severity}`) : null
          )
        )
      ))
    ) : !loading ? EmptyState({ icon: "\u{1F4A1}", title: "Check for trends", text: 'Click "Check Trends" to discover trending topics in your niche.' }) : null
  );
}
function CommentsPage() {
  const { api } = useAuth();
  const [url, setUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const analyze = async () => {
    if (!url.trim()) return;
    setLoading(true);
    setErr("");
    setData(null);
    try {
      const res = await api("/api/comments/analyze", { method: "POST", body: JSON.stringify({ video_url: url }) });
      if (!res) return;
      const d = await res.json();
      if (res.ok) setData(d);
      else setErr(d.detail || "Failed");
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const sen = data?.sentiment_breakdown || {};
  const total = (sen.positive || 0) + (sen.neutral || 0) + (sen.negative || 0) || 1;
  const pct = (v) => Math.round(v / total * 100);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Comment Analyzer", subtitle: "Analyze audience sentiment and extract topics" }),
    React.createElement(
      "div",
      { className: "card" },
      React.createElement(
        "div",
        { style: { display: "flex", gap: 8, maxWidth: 500 } },
        React.createElement("input", { className: "input", placeholder: "https://youtube.com/watch?v=...", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && analyze() }),
        React.createElement("button", { className: "btn btn-accent", onClick: analyze, disabled: loading }, loading ? React.createElement("span", { className: "spinner" }) : "Analyze")
      ),
      React.createElement(ErrorBox, { message: err })
    ),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    data ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "card" },
        React.createElement("h3", { style: { marginBottom: 4 } }, data.video_title || "Untitled Video"),
        React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem" } }, `${data.total_comments || total} comments analyzed`)
      ),
      React.createElement(
        "div",
        { className: "stats", style: { gridTemplateColumns: "repeat(3, 1fr)" } },
        React.createElement(
          "div",
          { className: "stat", style: { borderLeft: "4px solid var(--success)" } },
          React.createElement("div", { className: "label" }, "Positive"),
          React.createElement("div", { className: "value" }, `${pct(sen.positive)}%`),
          React.createElement("div", { className: "change", style: { color: "var(--success)" } }, `${sen.positive || 0} comments`)
        ),
        React.createElement(
          "div",
          { className: "stat", style: { borderLeft: "4px solid var(--warning)" } },
          React.createElement("div", { className: "label" }, "Neutral"),
          React.createElement("div", { className: "value" }, `${pct(sen.neutral)}%`),
          React.createElement("div", { className: "change", style: { color: "var(--warning)" } }, `${sen.neutral || 0} comments`)
        ),
        React.createElement(
          "div",
          { className: "stat", style: { borderLeft: "4px solid var(--error)" } },
          React.createElement("div", { className: "label" }, "Negative"),
          React.createElement("div", { className: "value" }, `${pct(sen.negative)}%`),
          React.createElement("div", { className: "change", style: { color: "var(--error)" } }, `${sen.negative || 0} comments`)
        )
      ),
      data.topics?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)" } }, "\u{1F4DD}"),
          React.createElement("h3", null, "Topics Mentioned")
        ),
        React.createElement("div", null, data.topics.map((t, i) => React.createElement("span", { key: i, className: "tag" }, t)))
      ) : null,
      data.summary ? React.createElement(
        "div",
        { className: "card", style: { background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)" } },
        React.createElement("h3", { style: { fontSize: ".85rem", color: "var(--accent)", marginBottom: 8 } }, "\u{1F916} AI Summary"),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.6 } }, data.summary)
      ) : null
    ) : !loading ? EmptyState({ icon: "\u{1F4AC}", title: "Enter a video URL", text: "Analyze audience comments with AI sentiment and topic extraction." }) : null
  );
}
function PublishingPage() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await api("/api/publishing/analyze", { method: "POST", body: JSON.stringify({}) });
      if (r?.ok) setData(await r.json());
      setLoading(false);
    })();
  }, [api]);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Publishing Assistant", subtitle: "Optimal posting times and CTR predictions" }),
    React.createElement(ErrorBox, { message: err }),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    data ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "stats" },
        React.createElement(StatCard, { label: "Predicted CTR", value: `${data.predicted_ctr || "?"}%` }),
        React.createElement(StatCard, { label: "Niche", value: data.niche || "N/A" }),
        React.createElement(StatCard, { label: "Subscribers", value: data.subscriber_count }),
        React.createElement(StatCard, { label: "Best Day", value: data.best_day || "N/A" })
      ),
      data.best_time_slots?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)" } }, "\u23F0"),
          React.createElement("h3", null, "Best Posting Times")
        ),
        React.createElement(
          "div",
          { style: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8 } },
          data.best_time_slots.map((slot, i) => React.createElement(
            "div",
            { key: i, className: "stat", style: { borderLeft: `4px solid ${scoreColor(slot.score || 0)}`, padding: 12 } },
            React.createElement("div", { className: "label" }, `${slot.day} ${slot.time}`),
            React.createElement("div", { className: "value", style: { fontSize: "1.1rem" } }, `${slot.score || 0}/100`)
          ))
        )
      ) : null,
      data.recommendation ? React.createElement(
        "div",
        { className: "card", style: { background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)" } },
        React.createElement("h3", { style: { fontSize: ".85rem", color: "var(--accent)", marginBottom: 8 } }, "\u{1F4CC} Recommendation"),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.6 } }, data.recommendation)
      ) : null
    ) : !loading ? EmptyState({ icon: "\u{1F4E4}", title: "Loading insights", text: "Publishing insights will appear here once data is available." }) : null
  );
}
function AlgoShiftPage() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await api("/api/algo-shift/analyze", { method: "POST", body: JSON.stringify({}) });
        if (r?.ok) setData(await r.json());
        else if (r) setErr((await r.json()).detail);
      } catch {
      }
      setLoading(false);
    })();
  }, [api]);
  const shifts = data?.shifts || data?.results || [];
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Algorithm Shift Tracker", subtitle: "Detect algorithm changes and get recommendations" }),
    React.createElement(ErrorBox, { message: err }),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    shifts.length ? shifts.map(
      (ch, i) => React.createElement(
        "div",
        { key: i, className: "card", style: { marginBottom: 16 } },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)" } }, ch.shift_type === "decline" ? "\u2B07" : "\u2B06"),
          React.createElement("h3", null, ch.channel_title || "Channel"),
          React.createElement("span", { className: `badge ${ch.shift_type === "decline" ? "badge-error" : ch.shift_type === "surge" ? "badge-success" : "badge-warning"}`, style: { fontSize: ".6rem" } }, (ch.shift_type || "stable").toUpperCase())
        ),
        React.createElement(
          "div",
          { className: "stats" },
          React.createElement(StatCard, { label: "Subscribers", value: ch.current_subscribers, change: `${ch.subscriber_change_pct > 0 ? "+" : ""}${ch.subscriber_change_pct || 0}%`, changeDir: (ch.subscriber_change_pct || 0) >= 0 ? "up" : "down" }),
          React.createElement(StatCard, { label: "Views Change", value: `${ch.view_change_pct || 0}%` }),
          React.createElement(StatCard, { label: "Engagement", value: `${(ch.engagement_change || 0).toFixed(1)}%` })
        ),
        ch.anomalies?.length ? React.createElement(
          "div",
          { style: { marginBottom: 12 } },
          React.createElement("h4", { style: { fontSize: ".82rem", marginBottom: 6, color: "var(--error)" } }, "\u26A0\uFE0F Anomalies"),
          ch.anomalies.map((a, j) => React.createElement("div", { key: j, style: { padding: "6px 10px", background: "rgba(239,68,68,.08)", borderRadius: "var(--radius-sm)", marginBottom: 4, fontSize: ".82rem", color: "var(--error)" } }, a))
        ) : null,
        ch.recommendations?.length ? React.createElement(
          "div",
          null,
          React.createElement("h4", { style: { fontSize: ".82rem", marginBottom: 6, color: "var(--accent)" } }, "\u{1F4CC} Recommendations"),
          ch.recommendations.map((r, j) => React.createElement("div", { key: j, style: { padding: "6px 10px", background: "rgba(59,130,246,.08)", borderRadius: "var(--radius-sm)", marginBottom: 4, fontSize: ".82rem" } }, r))
        ) : null
      )
    ) : !loading ? EmptyState({ icon: "\u{1F4C8}", title: "No shifts detected", text: data?.message || "Analyze more channels to detect algorithm shifts." }) : null
  );
}
function EditingPage() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  useEffect(() => {
    (async () => {
      setLoading(true);
      const r = await api("/api/editing/analyze", { method: "POST", body: JSON.stringify({}) });
      if (r?.ok) setData(await r.json());
      setLoading(false);
    })();
  }, [api]);
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Editing Coach", subtitle: "AI-powered editing recommendations" }),
    React.createElement(ErrorBox, { message: err }),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    data?.needs_auth ? React.createElement(
      "div",
      { className: "card", style: { textAlign: "center", padding: 40 } },
      React.createElement("div", { style: { fontSize: "3rem", marginBottom: 12 } }, "\u{1F517}"),
      React.createElement("h3", null, "Connect YouTube Account"),
      React.createElement("p", { style: { color: "var(--text-3)", marginBottom: 16, fontSize: ".85rem" } }, data.message || "Connect your YouTube account to access editing insights"),
      React.createElement("button", { className: "btn btn-primary", onClick: async () => {
        const r = await api("/api/auth/youtube/url");
        if (r?.ok) {
          const d = await r.json();
          if (d.url) window.location.href = d.url;
        }
      } }, "Connect YouTube")
    ) : data ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "stats" },
        React.createElement(StatCard, { label: "Retention", value: `${data.avg_retention_pct?.toFixed(1) || "-"}%` }),
        React.createElement(StatCard, { label: "Views (7d)", value: fmtNum(data.total_views_7d) })
      ),
      data.editing_tips?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(59,130,246,.12)" } }, "\u2702\uFE0F"),
          React.createElement("h3", null, "Editing Tips")
        ),
        data.editing_tips.map((tip, i) => React.createElement("div", { key: i, style: { padding: "8px 0", fontSize: ".85rem", borderBottom: i < data.editing_tips.length - 1 ? "1px solid var(--border)" : "none" } }, `${i + 1}. ${tip}`))
      ) : null,
      data.recommendation ? React.createElement(
        "div",
        { className: "card", style: { background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)" } },
        React.createElement("h3", { style: { fontSize: ".85rem", color: "var(--accent)", marginBottom: 8 } }, "\u{1F4CC} Recommendation"),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.6 } }, data.recommendation)
      ) : null
    ) : !loading ? EmptyState({ icon: "\u{1F579}\uFE0F", title: "Connect to get started", text: "Connect your YouTube account to receive AI editing recommendations." }) : null
  );
}
function AgentPage() {
  const { api } = useAuth();
  const [plan, setPlan] = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("plan");
  const load = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/agent/plan", { method: "POST", body: JSON.stringify({}) });
      if (r?.ok) setPlan(await r.json());
      else if (r) setErr((await r.json()).detail);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  };
  const loadStatus = async () => {
    setLoading(true);
    setErr("");
    try {
      const r = await api("/api/agent/status");
      if (r?.ok) setStatus(await r.json());
    } catch {
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (tab === "plan") load();
    else loadStatus();
  }, [tab]);
  return React.createElement(
    "div",
    null,
    PageHeader({
      title: "Growth Agent",
      subtitle: "Autonomous AI for weekly growth plans",
      action: React.createElement(
        "div",
        { style: { display: "flex", gap: 8 } },
        React.createElement("button", { className: `btn ${tab === "plan" ? "btn-primary" : "btn-ghost"} btn-sm`, onClick: () => setTab("plan") }, "Plan"),
        React.createElement("button", { className: `btn ${tab === "status" ? "btn-primary" : "btn-ghost"} btn-sm`, onClick: () => setTab("status") }, "Status")
      )
    }),
    React.createElement(ErrorBox, { message: err }),
    loading ? React.createElement(Skeleton, { count: 2 }) : null,
    tab === "plan" && plan ? React.createElement(
      "div",
      null,
      plan.weekly_focus ? React.createElement(
        "div",
        { className: "card", style: { background: "rgba(59,130,246,.06)", border: "1px solid rgba(59,130,246,.2)", marginBottom: 16 } },
        React.createElement("h3", { style: { fontSize: ".85rem", color: "var(--accent)", marginBottom: 8 } }, "\u{1F31F} Weekly Focus"),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.6 } }, plan.weekly_focus)
      ) : null,
      plan.days?.length ? React.createElement(
        "div",
        null,
        React.createElement("h3", { style: { fontSize: "1rem", fontWeight: 700, marginBottom: 12 } }, "\u{1F4C5} 7-Day Content Plan"),
        plan.days.map((d, i) => React.createElement(
          "div",
          { key: i, className: "card", style: { marginBottom: 8, borderLeft: `4px solid ${d.publish_ready ? "var(--success)" : "var(--warning)"}` } },
          React.createElement(
            "div",
            { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
            React.createElement("h4", { style: { fontSize: ".9rem" } }, d.day),
            React.createElement("span", { className: `badge ${d.publish_ready ? "badge-success" : "badge-warning"}`, style: { fontSize: ".6rem" } }, d.publish_ready ? "PUBLISH" : "IMPROVE")
          ),
          React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".85rem" } }, d.task || d.title),
          d.suggested_title ? React.createElement("p", { style: { fontWeight: 600, fontSize: ".88rem", marginTop: 4 } }, d.suggested_title) : null,
          d.thumbnail_idea ? React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".8rem", marginTop: 4 } }, `\u{1F5BC} ${d.thumbnail_idea}`) : null
        ))
      ) : null,
      plan.competitor_insights?.length ? React.createElement(
        "div",
        { className: "card" },
        React.createElement(
          "div",
          { className: "card-header" },
          React.createElement("div", { className: "card-icon", style: { background: "rgba(245,158,11,.12)" } }, "\u{1F465}"),
          React.createElement("h3", null, "Competitor Insights")
        ),
        plan.competitor_insights.map((ci, i) => React.createElement("div", { key: i, style: { padding: "6px 0", fontSize: ".85rem", borderBottom: i < plan.competitor_insights.length - 1 ? "1px solid var(--border)" : "none" } }, ci))
      ) : null
    ) : null,
    tab === "status" && status ? React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "stats" },
        React.createElement(StatCard, { label: "Channels", value: status.channel_count || status.channels }),
        React.createElement(StatCard, { label: "Ideas", value: status.saved_ideas || status.ideas }),
        React.createElement(StatCard, { label: "Events", value: status.calendar_events || status.events }),
        React.createElement(StatCard, { label: "Competitors", value: status.watched_competitors || status.competitors })
      ),
      status.agent_summary ? React.createElement(
        "div",
        { className: "card", style: { marginTop: 16 } },
        React.createElement("h3", { style: { marginBottom: 8 } }, "\u{1F916} Agent Summary"),
        React.createElement("p", { style: { color: "var(--text-2)", fontSize: ".88rem", lineHeight: 1.6 } }, status.agent_summary)
      ) : null
    ) : null,
    !loading && !plan && !status ? EmptyState({ icon: "\u{1F916}", title: "Growth Agent", text: "Let the Growth Agent analyze your channel to generate a personalized plan." }) : null
  );
}
function PricingPage() {
  const { api, user } = useAuth();
  const [usage, setUsage] = useState(null);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const r = await api("/api/billing/usage");
      if (r?.ok) setUsage(await r.json());
    })();
  }, [api, user]);
  const plans = [
    { id: "free", name: "Free", price: "$0", desc: "Perfect for getting started", features: ["Basic channel analysis", "Competitor discovery", "Cross-platform search", "3 analyses/mo"] },
    { id: "pro", name: "Pro", price: "$9", desc: "For serious creators", features: ["Everything in Free", "50 analyses/mo", "Export CSV/PDF", "Idea generator", "Content calendar"] },
    { id: "business", name: "Business", price: "$29", desc: "For teams & agencies", features: ["Everything in Pro", "Unlimited analyses", "API access", "Team seats (5)", "Priority support"] }
  ];
  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { style: { textAlign: "center", marginBottom: 36 } },
      React.createElement("h1", { style: { fontSize: "2rem", fontWeight: 800, marginBottom: 8, letterSpacing: "-.03em" } }, "Choose Your Plan"),
      React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".95rem", maxWidth: 500, margin: "0 auto", lineHeight: 1.6 } }, "Unlock the full power of PopSearch.")
    ),
    React.createElement(
      "div",
      { className: "stats", style: { gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 } },
      plans.map((plan) => {
        const isCurrent = usage?.plan === plan.id;
        return React.createElement(
          "div",
          { key: plan.id, className: "card", style: { display: "flex", flexDirection: "column", position: "relative", overflow: "hidden", border: isCurrent ? "2px solid var(--primary)" : "1px solid var(--border)" } },
          plan.id === "pro" ? React.createElement("div", { style: { position: "absolute", top: 14, right: 14, background: "linear-gradient(135deg, var(--primary), var(--accent))", color: "#fff", padding: "4px 14px", borderRadius: 999, fontSize: ".68rem", fontWeight: 700 } }, "Most Popular") : null,
          React.createElement("h2", { style: { fontSize: "1.1rem", fontWeight: 700, marginBottom: 4 } }, plan.name),
          React.createElement("div", { style: { fontSize: "2.2rem", fontWeight: 800, marginBottom: 4 } }, plan.price, React.createElement("span", { style: { fontSize: ".9rem", fontWeight: 400, color: "var(--text-3)" } }, "/mo")),
          React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".82rem", marginBottom: 16 } }, plan.desc),
          React.createElement(
            "div",
            { style: { flex: 1 } },
            plan.features.map((f, i) => React.createElement(
              "div",
              { key: i, style: { padding: "6px 0", fontSize: ".83rem", color: "var(--text-2)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 } },
              React.createElement("span", { style: { color: "var(--success)" } }, "\u2713"),
              f
            ))
          ),
          React.createElement(
            "div",
            { style: { marginTop: 16 } },
            isCurrent ? React.createElement("button", { className: "btn btn-ghost", style: { width: "100%", justifyContent: "center" }, disabled: true }, "Current Plan") : plan.id === "free" ? React.createElement("button", { className: "btn btn-ghost", style: { width: "100%", justifyContent: "center" }, onClick: () => window.location.hash = "login" }, "Get Started") : React.createElement("button", { className: plan.id === "pro" ? "btn btn-primary" : "btn btn-accent", style: { width: "100%", justifyContent: "center" }, onClick: async () => {
              const r = await api("/api/billing/checkout", { method: "POST", body: JSON.stringify({ plan: plan.id }) });
              if (r?.ok) {
                const d = await r.json();
                if (d.url) window.location.href = d.url;
              }
            } }, "Subscribe")
          )
        );
      })
    )
  );
}
function BillingPage() {
  const { api } = useAuth();
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const r = await api("/api/billing/usage");
      if (r?.ok) setUsage(await r.json());
      setLoading(false);
    })();
  }, [api]);
  if (loading) return React.createElement(Skeleton, { count: 2 });
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Billing & Usage", subtitle: "Manage your subscription" }),
    usage ? React.createElement(
      "div",
      { className: "stats" },
      React.createElement(StatCard, { label: "Plan", value: usage.plan }),
      React.createElement(StatCard, { label: "Used", value: usage.analyses_this_month || 0 }),
      React.createElement(StatCard, { label: "Limit", value: usage.limit === -1 ? "\u221E" : usage.limit || 3 }),
      React.createElement(StatCard, { label: "Remaining", value: usage.remaining === -1 ? "\u221E" : usage.remaining || 0 })
    ) : null,
    React.createElement(
      "div",
      { className: "card" },
      React.createElement("h3", { style: { marginBottom: 12 } }, "Manage Subscription"),
      usage?.plan !== "free" ? React.createElement("button", { className: "btn btn-ghost", onClick: async () => {
        const r = await api("/api/billing/portal", { method: "POST" });
        if (r?.ok) {
          const d = await r.json();
          if (d.url) window.location.href = d.url;
        }
      } }, "Open Stripe Portal") : null,
      React.createElement("button", { className: "btn btn-primary", style: { marginLeft: 8 }, onClick: () => window.location.hash = "pricing" }, "View Plans")
    )
  );
}
function SettingsPage() {
  const { api, user, logout } = useAuth();
  const toast = useToast();
  const [usage, setUsage] = useState(null);
  const [activeTab, setActiveTab] = useState("profile");
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => {
    (async () => {
      const r = await api("/api/billing/usage");
      if (r?.ok) setUsage(await r.json());
    })();
  }, [api]);
  const tabs = ["profile", "api-keys", "channels"];
  const tabLabels = { profile: "Profile & Usage", "api-keys": "API Keys", channels: "Channels" };
  return React.createElement(
    "div",
    null,
    PageHeader({ title: "Settings", subtitle: "Manage your account and preferences" }),
    React.createElement(
      "div",
      { className: "tabs" },
      tabs.map((t) => React.createElement("button", { key: t, className: `tab${activeTab === t ? " active" : ""}`, onClick: () => setActiveTab(t) }, tabLabels[t]))
    ),
    React.createElement(
      "div",
      { style: { display: activeTab === "profile" ? "block" : "none" } },
      React.createElement(
        "div",
        { className: "card" },
        React.createElement("h3", { style: { marginBottom: 12 } }, "Account Information"),
        React.createElement(
          "div",
          { style: { display: "grid", gap: 10, gridTemplateColumns: "140px 1fr", fontSize: ".88rem" } },
          React.createElement("span", { style: { color: "var(--text-3)" } }, "Email:"),
          React.createElement("span", null, user?.email),
          React.createElement("span", { style: { color: "var(--text-3)" } }, "Plan:"),
          React.createElement("span", { style: { color: "var(--primary)", fontWeight: 600 } }, usage?.plan || "free"),
          React.createElement("span", { style: { color: "var(--text-3)" } }, "Analyses:"),
          React.createElement("span", null, `${usage?.analyses_this_month || 0} / ${usage?.limit === -1 ? "\u221E" : usage?.limit || 3}`)
        ),
        React.createElement("button", { className: "btn btn-ghost", style: { marginTop: 12 }, onClick: () => window.location.hash = "pricing" }, "Upgrade Plan")
      ),
      React.createElement(
        "div",
        { className: "card", style: { borderColor: "rgba(239,68,68,.3)" } },
        React.createElement("h3", { style: { color: "var(--error)", marginBottom: 8 } }, "Danger Zone"),
        React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem", marginBottom: 12 } }, "Permanently delete your account and all data."),
        confirmDelete ? React.createElement(
          "div",
          { style: { display: "flex", gap: 8 } },
          React.createElement("button", { className: "btn", style: { background: "var(--error)", color: "#fff" }, onClick: async () => {
            await api("/api/account", { method: "DELETE" });
            logout();
          } }, "Confirm Delete"),
          React.createElement("button", { className: "btn btn-ghost", onClick: () => setConfirmDelete(false) }, "Cancel")
        ) : React.createElement("button", { className: "btn btn-ghost", style: { borderColor: "var(--error)", color: "var(--error)" }, onClick: () => setConfirmDelete(true) }, "Delete Account")
      )
    ),
    React.createElement(
      "div",
      { style: { display: activeTab === "api-keys" ? "block" : "none" } },
      React.createElement(
        "div",
        { className: "card" },
        React.createElement("h3", { style: { marginBottom: 4 } }, "API Keys"),
        React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem", marginBottom: 12 } }, "API keys are available on Business plan.")
      )
    ),
    React.createElement(
      "div",
      { style: { display: activeTab === "channels" ? "block" : "none" } },
      React.createElement(
        "div",
        { className: "card" },
        React.createElement("h3", { style: { marginBottom: 12 } }, "Your Channels"),
        React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".85rem" } }, "Manage your YouTube channels from one account.")
      )
    )
  );
}
function OnboardingPage() {
  const { api } = useAuth();
  const [step, setStep] = useState(0);
  const [url, setUrl] = useState("");
  const steps = [
    { title: "Welcome!", icon: "\u{1F44B}", desc: "PopSearch helps you analyze YouTube channels, discover competitors, and find content ideas across 9+ platforms." },
    { title: "Analyze Your Channel", icon: "\u{1F4FA}", desc: "Paste your YouTube channel URL or @handle to get started." },
    { title: "Discover & Grow", icon: "\u{1F4C8}", desc: "Get competitor analysis, cross-platform content ideas, SEO recommendations, and more." }
  ];
  return React.createElement(
    "div",
    { className: "auth-page" },
    React.createElement(
      "div",
      { className: "auth-card", style: { maxWidth: 500, textAlign: "center" } },
      React.createElement("div", { style: { fontSize: "3rem", marginBottom: 12 } }, steps[step].icon),
      React.createElement("h1", null, steps[step].title),
      React.createElement("p", { style: { color: "var(--text-3)", fontSize: ".88rem", marginBottom: 24, lineHeight: 1.6 } }, steps[step].desc),
      step === 0 ? React.createElement("button", { className: "btn btn-primary", style: { padding: "12px 32px" }, onClick: () => setStep(1) }, "Get Started") : null,
      step === 1 ? React.createElement(
        "div",
        null,
        React.createElement("input", { className: "input", style: { marginBottom: 12 }, placeholder: "YouTube URL or @handle...", value: url, onChange: (e) => setUrl(e.target.value), onKeyDown: (e) => e.key === "Enter" && (() => {
          if (url.trim()) localStorage.setItem("ccr_last_url", url);
          setStep(2);
        })() }),
        React.createElement(
          "div",
          { style: { display: "flex", gap: 8, justifyContent: "center" } },
          React.createElement("button", { className: "btn btn-primary", onClick: () => {
            if (url.trim()) localStorage.setItem("ccr_last_url", url);
            setStep(2);
          } }, "Continue"),
          React.createElement("button", { className: "btn btn-ghost", onClick: () => setStep(2) }, "Skip")
        )
      ) : null,
      step === 2 ? React.createElement(
        "div",
        null,
        React.createElement("button", { className: "btn btn-primary", style: { marginBottom: 8, padding: "12px 32px" }, onClick: () => window.location.hash = "dashboard" }, "Go to Dashboard"),
        React.createElement(
          "div",
          null,
          React.createElement("a", { href: "#ideas", style: { color: "var(--accent)", textDecoration: "none", fontSize: ".85rem" } }, "Ideas"),
          " \xB7 ",
          React.createElement("a", { href: "#pricing", style: { color: "var(--primary)", textDecoration: "none", fontSize: ".85rem" } }, "Pricing")
        )
      ) : null,
      React.createElement(
        "div",
        { style: { marginTop: 24, display: "flex", gap: 8, justifyContent: "center" } },
        steps.map((_, i) => React.createElement("div", { key: i, style: { width: 10, height: 10, borderRadius: "50%", background: i === step ? "var(--primary)" : "var(--bg-elevated)", transition: "all .2s" } }))
      )
    )
  );
}
function AppShell({ page, setPage }) {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(isDark());
  const toggleTheme = () => {
    const next = !isDarkTheme;
    setIsDarkTheme(next);
    document.documentElement.setAttribute("data-theme", next ? "" : "light");
    localStorage.setItem("ccr_theme", next ? "dark" : "light");
    Object.keys(chartInstances).forEach((k) => {
      if (chartInstances[k]) chartInstances[k].destroy();
    });
  };
  useEffect(() => {
    const saved = localStorage.getItem("ccr_theme");
    if (saved) {
      document.documentElement.setAttribute("data-theme", saved === "dark" ? "" : "light");
      setIsDarkTheme(saved === "dark");
    }
  }, []);
  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}", section: "Main" },
    { id: "analyze", label: "Channel Analysis", icon: "\u{1F4FA}", section: "Main" },
    { id: "competitors", label: "Competitors", icon: "\u{1F465}", section: "Main" },
    { id: "discover", label: "Content Discovery", icon: "\u{1F50D}", section: "Main" },
    { id: "ideas", label: "Idea Generator", icon: "\u{1F4A1}", section: "Content" },
    { id: "watch", label: "Monitored", icon: "\u{1F440}", section: "Content" },
    { id: "calendar", label: "Calendar", icon: "\u{1F4C5}", section: "Content" },
    { id: "repurpose", label: "Repurpose", icon: "\u{1F504}", section: "Content" },
    { id: "seo", label: "SEO Score", icon: "\u{1F50D}", section: "Content" },
    { id: "thumbnail-test", label: "A/B Thumbnails", icon: "\u{1F5BC}", section: "Content" },
    { id: "trends", label: "Trend Alerts", icon: "\u{1F525}", section: "Content" },
    { id: "comments", label: "Comments", icon: "\u{1F4AC}", section: "Content" },
    { id: "publishing", label: "Publishing", icon: "\u{1F4E4}", section: "Content" },
    { id: "algo-shift", label: "Algo Shifts", icon: "\u{1F4C8}", section: "Content" },
    { id: "editing", label: "Editing Coach", icon: "\u{1F579}", section: "Content" },
    { id: "agent", label: "Growth Agent", icon: "\u{1F916}", section: "Content" },
    { id: "reports", label: "Reports", icon: "\u{1F4C4}", section: "Content" },
    { id: "saved-ideas", label: "Saved Ideas", icon: "\u{1F4BE}", section: "Content" },
    { id: "pricing", label: "Pricing", icon: "\u{1F4B0}", section: "Settings" },
    { id: "billing", label: "Billing", icon: "\u{1F4B0}", section: "Settings" },
    { id: "settings", label: "Settings", icon: "\u2699\uFE0F", section: "Settings" }
  ];
  const renderPage = () => {
    switch (page) {
      case "dashboard":
        return React.createElement(DashboardPage);
      case "analyze":
        return React.createElement(AnalyzePage);
      case "competitors":
        return React.createElement(CompetitorsPage);
      case "discover":
        return React.createElement(DiscoverPage);
      case "ideas":
        return React.createElement(IdeasPage);
      case "watch":
        return React.createElement(WatchPage);
      case "calendar":
        return React.createElement(CalendarPage);
      case "reports":
        return React.createElement(ReportsPage);
      case "saved-ideas":
        return React.createElement(SavedIdeasPage);
      case "repurpose":
        return React.createElement(RepurposePage);
      case "seo":
        return React.createElement(SeoPage);
      case "thumbnail-test":
        return React.createElement(ThumbnailTestPage);
      case "trends":
        return React.createElement(TrendAlertsPage);
      case "comments":
        return React.createElement(CommentsPage);
      case "publishing":
        return React.createElement(PublishingPage);
      case "algo-shift":
        return React.createElement(AlgoShiftPage);
      case "editing":
        return React.createElement(EditingPage);
      case "agent":
        return React.createElement(AgentPage);
      case "pricing":
        return React.createElement(PricingPage);
      case "billing":
        return React.createElement(BillingPage);
      case "settings":
        return React.createElement(SettingsPage);
      case "onboarding":
        return React.createElement(OnboardingPage);
      default:
        return React.createElement(DashboardPage);
    }
  };
  return React.createElement(
    "div",
    { className: "app-layout" },
    React.createElement(
      "aside",
      { className: `sidebar${sidebarOpen ? " open" : ""}` },
      React.createElement(
        "div",
        { className: "sidebar-logo" },
        React.createElement(
          "svg",
          { viewBox: "0 0 24 24", fill: "currentColor" },
          React.createElement("path", { d: "M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" })
        ),
        React.createElement("span", null, "PopSearch")
      ),
      React.createElement(
        "nav",
        { className: "sidebar-nav" },
        ...["Main", "Content", "Settings"].map(
          (section) => React.createElement(
            React.Fragment,
            { key: section },
            React.createElement("div", { className: "nav-section" }, section),
            ...navItems.filter((n) => n.section === section).map(
              (item) => React.createElement(
                "button",
                {
                  key: item.id,
                  className: `nav-item${page === item.id ? " active" : ""}`,
                  onClick: () => {
                    setPage(item.id);
                    setSidebarOpen(false);
                    window.location.hash = item.id;
                  }
                },
                item.icon,
                " ",
                item.label
              )
            )
          )
        )
      ),
      React.createElement(
        "div",
        { className: "sidebar-footer" },
        React.createElement(
          "div",
          { className: "plan-badge" },
          React.createElement("span", { className: "plan-name" }, (user?.plan || "free").toUpperCase()),
          React.createElement("span", { className: "upgrade", onClick: () => {
            setPage("pricing");
            window.location.hash = "pricing";
          } }, "Upgrade")
        )
      )
    ),
    React.createElement(
      "div",
      { className: "main-area" },
      React.createElement(
        "header",
        { className: "topbar" },
        React.createElement(
          "button",
          { className: "icon-btn menu-toggle", onClick: () => setSidebarOpen(!sidebarOpen) },
          React.createElement(
            "svg",
            { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, width: 22, height: 22 },
            React.createElement("line", { x1: 3, y1: 6, x2: 21, y2: 6 }),
            React.createElement("line", { x1: 3, y1: 12, x2: 21, y2: 12 }),
            React.createElement("line", { x1: 3, y1: 18, x2: 21, y2: 18 })
          )
        ),
        React.createElement(
          "div",
          { className: "topbar-search" },
          React.createElement("span", { style: { color: "var(--text-3)", fontSize: ".9rem" } }, "\u{1F50D}"),
          React.createElement("input", { placeholder: "Search pages...", onKeyDown: (e) => {
            if (e.key === "Enter") {
              const q = e.target.value.toLowerCase().trim();
              const found = navItems.find((n) => n.label.toLowerCase().includes(q) || n.id.toLowerCase().includes(q));
              if (found) {
                setPage(found.id);
                window.location.hash = found.id;
              }
            }
          } })
        ),
        React.createElement(
          "div",
          { className: "topbar-actions" },
          React.createElement("button", { className: "icon-btn", onClick: toggleTheme, title: "Toggle theme" }, isDarkTheme ? "\u{1F319}" : "\u2600\uFE0F"),
          React.createElement("button", { className: "icon-btn", onClick: logout, title: "Sign out" }, "\u{1F6AA}")
        )
      ),
      React.createElement("main", { className: "page-content" }, renderPage())
    ),
    sidebarOpen ? React.createElement("div", { className: "sidebar-overlay", style: { position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 99 }, onClick: () => setSidebarOpen(false) }) : null
  );
}
function App() {
  const { user } = useAuth();
  const [page, setPage] = useState("dashboard");
  useEffect(() => {
    const onHash = () => {
      const hash = window.location.hash.replace("#", "") || "dashboard";
      const valid = ["dashboard", "analyze", "competitors", "discover", "ideas", "watch", "calendar", "reports", "saved-ideas", "repurpose", "seo", "thumbnail-test", "trends", "comments", "publishing", "algo-shift", "editing", "agent", "pricing", "billing", "settings", "onboarding", "login", "register"];
      if (valid.includes(hash)) setPage(hash);
    };
    window.addEventListener("hashchange", onHash);
    onHash();
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  useEffect(() => {
    if (user && !localStorage.getItem("ccr_onboarding_done") && page !== "onboarding") {
      localStorage.setItem("ccr_onboarding_done", "1");
      window.location.hash = "onboarding";
      setPage("onboarding");
    }
  }, [user, page]);
  if (!user) {
    if (page === "register") return React.createElement(RegisterPage);
    return React.createElement(LoginPage);
  }
  return React.createElement(AppShell, { page, setPage });
}
var root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  React.createElement(
    AuthProvider,
    null,
    React.createElement(
      ToastProvider,
      null,
      React.createElement(App)
    )
  )
);
