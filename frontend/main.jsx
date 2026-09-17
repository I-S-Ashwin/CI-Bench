import React, { useEffect, useState, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity, ArrowDown, ArrowDownToLine, ArrowRight, ArrowUpRight, BarChart3,
  Bell, BookOpen, Bookmark, Check, CheckCircle2, ChevronDown, ChevronLeft,
  ChevronRight, ClipboardCheck, Clock3, Copy, ExternalLink, FileText, Filter,
  FolderOpen, GitBranch, Info, LayoutDashboard, LayoutGrid, List, Loader2,
  Menu, MoreHorizontal, Plus, QrCode, Search, Settings2, ShieldCheck,
  Sparkles, Target, TrendingUp, Users, Wrench, X
} from 'lucide-react';
import './theme.css';
import './accessibility.css';
import './reference.css';

const navigation = [
  ['Overview', LayoutDashboard],
  ['Kaizen repository', BookOpen],
  ['Recommendations', Sparkles],
  ['Horizontal deployment', GitBranch],
  ['KPI benchmarking', BarChart3],
  ['Audit trail', ShieldCheck],
  ['Work hub', FolderOpen],
  ['Equipment library', Wrench]
];

let session = sessionStorage.getItem('ci-token');
async function request(path, options = {}) {
  const r = await fetch('/api/v1/' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + session,
      ...options.headers
    }
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Unable to load this information');
  return data;
}
async function post(path, data) {
  return request(path, { method: 'POST', body: JSON.stringify(data) });
}
function csv(name, rows) {
  const content = rows.map(row => row.map(v => '"' + String(v ?? '').replaceAll('"', '""') + '"').join(',')).join('\n');
  download(name, new Blob([content], { type: 'text/csv' }));
}
function download(name, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function Badge({ children, tone }) {
  const value = String(children);
  const t = tone || (
    ['Approved', 'Validated', 'Verified', 'Closed', 'Done', 'On track'].includes(value) ? 'success' :
    ['Submitted', 'Reviewed', 'Planned', 'Feasibility', 'In progress', 'Pending', 'Due soon', 'In Review'].includes(value) ? 'amber' :
    ['Rejected', 'Blocked', 'Needs rework', 'Overdue'].includes(value) ? 'danger' : 'neutral'
  );
  return <span className={'badge ' + t}><span />{children}</span>;
}

function Button({ children, primary = false, outline = false, icon: Icon, onClick, ...props }) {
  const cls = 'btn ' + (primary ? 'btn-primary ' : outline ? 'btn-outline ' : '');
  return <button className={cls} onClick={onClick} {...props}>{Icon && <Icon size={15} />}<span>{children}</span></button>;
}

function Empty({ title = 'Nothing here yet', text = 'Try another filter or add a record to begin.', action }) {
  return <div className="empty-state"><FolderOpen size={32} /><h3>{title}</h3><p>{text}</p>{action}</div>;
}

function Heading({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      <div className="heading-actions">{children}</div>
    </div>
  );
}

function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={'surface ' + className}>
      <div className="surface-header">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <label className="select-wrap">
      <span>{label}</span>
      <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
        {children}
      </select>
      <ChevronDown size={14} />
    </label>
  );
}

function SearchField({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="search-field">
      <Search size={16} />
      <input type="search" aria-label={placeholder} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton-view" aria-label="Loading workspace">
      <div />
      <section>{[1, 2, 3, 4].map(i => <div key={i} />)}</section>
      <article />
    </div>
  );
}

function useRemote(path) {
  const [state, set] = useState({ loading: true, data: null, error: null });
  useEffect(() => {
    let active = true;
    set({ loading: true, data: null, error: null });
    request(path)
      .then(data => active && set({ loading: false, data, error: null }))
      .catch(e => active && set({ loading: false, data: null, error: e.message }));
    return () => { active = false; };
  }, [path]);
  return state;
}

function RemoteError({ message }) {
  return (
    <div className="notice danger">
      <ShieldCheck size={20} />
      <div>
        <strong>Unable to show this information</strong>
        <p>{message}</p>
      </div>
    </div>
  );
}

function Hint({ children }) {
  return <div className="hint"><ShieldCheck size={14} />{children}</div>;
}

function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(new URLSearchParams(location.search).has('equipment') ? 'Equipment library' : sessionStorage.getItem('ci-page') || 'Overview');
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState('');
  const [recommendId, setRecommendId] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [topPlant, setTopPlant] = useState('Plant B (Demo)');

  const tell = message => {
    setToast(message);
    setTimeout(() => setToast(''), 4500);
  };

  async function load() {
    try {
      const users = await request('demo-users');
      let meta;
      try {
        meta = await request('meta');
      } catch {
        const auth = await post('session', { user_id: 5 });
        session = auth.token;
        sessionStorage.setItem('ci-token', session);
        meta = await request('meta');
      }
      const [kaizens, hd, workspace, notifications] = await Promise.all([
        request('kaizens'),
        request('hd'),
        request('collab/workspace'),
        request('collab/notifications')
      ]);
      const next = { meta, users, kaizens, hd, workspace, notifications };
      setData(next);
      window.CIBridge.sync(next, session);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  useEffect(() => {
    load();
    const change = () => { load(); setRefreshKey(x => x + 1); };
    const navigate = e => { if (e.detail?.page) setPage(e.detail.page); };
    window.addEventListener('ci-data-changed', change);
    window.addEventListener('ci-navigate', navigate);
    return () => {
      window.removeEventListener('ci-data-changed', change);
      window.removeEventListener('ci-navigate', navigate);
    };
  }, []);

  function go(next) {
    setPage(next);
    sessionStorage.setItem('ci-page', next);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function persona(id) {
    try {
      const auth = await post('session', { user_id: Number(id) });
      session = auth.token;
      sessionStorage.setItem('ci-token', session);
      await load();
      setRefreshKey(k => k + 1);
      tell('Signed in as ' + auth.user.name);
    } catch (e) {
      tell(e.message);
    }
  }

  async function open(kind, id, tab) {
    try {
      await window.CIBridge.open(kind, id, tab);
    } catch (e) {
      tell(e.message);
    }
  }

  function opportunities(id) {
    setRecommendId(id);
    go('Recommendations');
  }

  const ui = { data, go, open, tell, opportunities, newKaizen: () => window.CIBridge.create(), refreshKey };
  const approved = data?.kaizens.filter(k => k.status === 'Approved') || [];

  return (
    <div className="react-workspace">
      <a className="skip-link" href="#workspace-main">Skip to content</a>
      {mobile && <button className="nav-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      
      <aside className={'app-sidebar ' + (mobile ? 'is-open' : '')}>
        <a href="/" className="brand-lockup">
          <span className="brand-symbol"><BarChart3 size={24} /></span>
          <div>
            CI<span className="brand-dash">—</span>BENCH
            <small>Manufacturing Progress Together</small>
          </div>
        </a>

        <nav aria-label="Main navigation">
          {navigation.map(([name, Icon]) => (
            <button
              key={name}
              onClick={() => go(name)}
              className={page === name ? 'selected' : ''}
              aria-current={page === name ? 'page' : undefined}
            >
              <Icon size={18} />
              <span>{name}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="demo-box">
            <div className="demo-box-label">Demo Persona</div>
            {data && (
              <label className="persona-label">
                <select aria-label="Demo persona" value={data.meta.user.id} onChange={e => persona(e.target.value)}>
                  {data.users.map(u => (
                    <option key={u.id} value={u.id}>{u.name}</option>
                  ))}
                </select>
              </label>
            )}
            <div className="demo-box-note">Explore the platform with sample data.</div>
          </div>
        </div>
      </aside>

      <div className="app-content">
        <header className="app-topbar">
          <div className="breadcrumbs">
            <button className="icon-btn mobile-menu" onClick={() => setMobile(!mobile)} aria-label="Open navigation">
              <Menu size={20} />
            </button>
            <span>Home</span>
            <ChevronRight size={14} />
            <strong>{page}</strong>
          </div>

          <div className="topbar-tools">
            <select
              className="topbar-plant-select"
              value={topPlant}
              onChange={e => setTopPlant(e.target.value)}
              aria-label="Filter active plant"
            >
              <option>All Plants</option>
              <option>Plant A</option>
              <option>Plant B (Demo)</option>
              <option>Plant C</option>
            </select>

            <span className="demo-label">
              <span />Demo data
            </span>

            <button className="icon-btn notification-button" onClick={() => window.CIBridge.inbox()} aria-label="Open notifications">
              <Bell size={18} />
              {data?.notifications.some(n => !n.read) && <i />}
            </button>

            <div className="topbar-user">
              <span className="user-avatar">JD</span>
              <div className="user-info">
                <strong>Jordan Diaz</strong>
                <small>{data?.meta.user.role || 'Plant Manager'}</small>
              </div>
            </div>
          </div>
        </header>

        <main id="workspace-main" tabIndex="-1">
          {error ? <RemoteError message={error} /> : !data ? <Skeleton /> : (
            <div key={page} className="page-enter">
              {page === 'Overview' && <Overview {...ui} approved={approved} topPlant={topPlant} />}
              {page === 'Kaizen repository' && <Repository {...ui} />}
              {page === 'Recommendations' && <Recommendations {...ui} approved={approved} selectedId={recommendId} setId={setRecommendId} />}
              {page === 'Horizontal deployment' && <Deployments {...ui} />}
              {page === 'KPI benchmarking' && <Benchmarks {...ui} />}
              {page === 'Audit trail' && <Audit {...ui} />}
              {page === 'Work hub' && <WorkHub {...ui} />}
              {page === 'Equipment library' && <Equipment {...ui} />}
            </div>
          )}
        </main>

        <footer className="app-footer">
          <span>CI-BENCH · Continual improvement, shared across plants</span>
          <span><span className="status-dot" />All measurements are synthetic</span>
        </footer>
      </div>

      {toast && <div role="status" className="react-toast"><CheckCircle2 size={18} />{toast}</div>}
    </div>
  );
}

function Overview({ data, approved, go, open, newKaizen }) {
  const stats = [
    { label: 'Approved Kaizens', value: 120, delta: '+12%', tone: 'indigo', icon: FileText },
    { label: 'Active Deployments', value: 28, delta: '+27%', tone: 'blue', icon: Settings2 },
    { label: 'Validated Outcomes', value: 86, delta: '+18%', tone: 'teal', icon: BarChart3 },
    { label: 'Pending Decisions', value: 14, delta: '+7%', tone: 'violet', icon: Clock3 }
  ];

  const chartData = [
    { name: 'Plant A', val: 2.1, color: '#008b87' },
    { name: 'Plant B', val: 3.6, color: '#2563eb', sample: true },
    { name: 'Plant C', val: 4.8, color: '#334155' }
  ];

  const lifecycleStages = [
    { name: 'Planned', count: 25, color: '#60a5fa' },
    { name: 'In Review', count: 18, color: '#f59e0b' },
    { name: 'Piloting', count: 12, color: '#14b8a6' },
    { name: 'Scaling', count: 8, color: '#8b5cf6' },
    { name: 'Verified', count: 21, color: '#22c55e' }
  ];

  const recentRows = [
    { id: 1042, code: 'KZN-1042', title: 'Optimize weld fixture setup', shop: 'Body Shop', status: 'Approved', date: 'Apr 12, 2024' },
    { id: 1037, code: 'KZN-1037', title: 'Reduce rework in bracket welds', shop: 'Welding', status: 'Pending', date: 'Apr 8, 2024' },
    { id: 1031, code: 'KZN-1031', title: 'Standardize torch cleaning', shop: 'Welding', status: 'Approved', date: 'Apr 5, 2024' },
    { id: 1029, code: 'KZN-1029', title: 'Improve material staging', shop: 'Assembly', status: 'Blocked', date: 'Apr 2, 2024' },
    { id: 1021, code: 'KZN-1021', title: 'Update work instructions', shop: 'Paint Shop', status: 'Approved', date: 'Mar 28, 2024' }
  ];

  const attentionTasks = [
    { id: 1, task: 'Review deployment plan', owner: 'A. Kim', due: 'Apr 18, 2024', status: 'Overdue', tone: 'danger' },
    { id: 2, task: 'Validate pilot results', owner: 'M. Chen', due: 'Apr 20, 2024', status: 'Due soon', tone: 'amber' },
    { id: 3, task: 'Provide decision on KZN-1037', owner: 'S. Patel', due: 'Apr 22, 2024', status: 'Due soon', tone: 'amber' },
    { id: 4, task: 'Complete audit checklist', owner: 'L. Garcia', due: 'Apr 24, 2024', status: 'On track', tone: 'success' },
    { id: 5, task: 'Update training materials', owner: 'R. Wilson', due: 'Apr 26, 2024', status: 'On track', tone: 'success' }
  ];

  return (
    <>
      <Heading
        title="Turn proven improvements into measurable impact."
        subtitle="Capture knowledge. Deploy confidently. Verify outcomes."
      />

      <div className="metric-grid">
        {stats.map(({ label, value, delta, icon: Icon, tone }) => (
          <article className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <span className={'metric-icon ' + tone}><Icon size={17} /></span>
            </div>
            <div className="metric-value">{value}</div>
            <div className="metric-delta positive">
              ▲ {delta} <small>vs. previous period</small>
            </div>
          </article>
        ))}
      </div>

      <div className="dashboard-grid">
        <Panel
          title="Welding scrap comparison"
          subtitle="Synthetic 30-day observations"
          action={<Info size={15} style={{ color: '#94a3b8', cursor: 'pointer' }} />}
        >
          <div className="overview-chart-panel">
            <div className="custom-chart-container">
              <div className="chart-bars-wrap">
                {[5, 4, 3, 2, 1, 0].map(v => (
                  <div key={v} className="chart-grid-line" style={{ bottom: `${(v / 6) * 100}%` }} />
                ))}
                {chartData.map(d => (
                  <div key={d.name} className="chart-bar-item column-group">
                    <div
                      className="chart-bar-rect primary-bar"
                      style={{ height: `${(d.val / 6) * 100}%`, background: d.color }}
                    >
                      <span>{d.val}%</span>
                      {d.sample && (
                        <div className="bar-tooltip-popup">
                          Sample data
                          <b>{d.val}%</b>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chart-x-labels">
                {chartData.map(d => (
                  <span key={d.name}>{d.name}</span>
                ))}
              </div>
            </div>
            <div className="chart-legend-strip">
              <span className="legend-item"><span className="legend-dot" style={{ background: '#008b87' }} /> Plant A</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#2563eb' }} /> Plant B (Sample data)</span>
              <span className="legend-item"><span className="legend-dot" style={{ background: '#334155' }} /> Plant C</span>
            </div>
          </div>
        </Panel>

        <Panel
          title="Deployments by lifecycle stage"
          subtitle="Current assignments · selected plant"
          action={<Info size={15} style={{ color: '#94a3b8', cursor: 'pointer' }} />}
        >
          <div className="overview-chart-panel">
            <div className="custom-chart-container">
              <div className="lifecycle-bars">
                {lifecycleStages.map(s => (
                  <div key={s.name} className="stage-bar-group">
                    <div
                      className="stage-bar-rect"
                      style={{ height: `${(s.count / 30) * 100}%`, background: s.color }}
                    >
                      {s.count}
                    </div>
                  </div>
                ))}
              </div>
              <div className="chart-x-labels">
                {lifecycleStages.map(s => (
                  <span key={s.name}>{s.name}</span>
                ))}
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="dashboard-grid">
        <Panel
          title="Recent improvements"
          action={<button className="text-action" onClick={() => go('Kaizen repository')}>View all</button>}
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Title</th>
                  <th>Shop</th>
                  <th>Status</th>
                  <th>Approved</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recentRows.map(r => (
                  <tr key={r.id}>
                    <td><strong>{r.code}</strong></td>
                    <td>{r.title}</td>
                    <td>{r.shop}</td>
                    <td><Badge tone={r.status === 'Approved' ? 'success' : r.status === 'Pending' ? 'amber' : 'danger'}>{r.status}</Badge></td>
                    <td>{r.date}</td>
                    <td>
                      <button className="action-btn-outline" onClick={() => open('kaizens', 1)}>
                        Open improvement
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Assignments needing attention"
          action={<button className="text-action" onClick={() => go('Horizontal deployment')}>View all</button>}
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Owner</th>
                  <th>Due</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attentionTasks.map(t => (
                  <tr key={t.id}>
                    <td>{t.task}</td>
                    <td>{t.owner}</td>
                    <td>{t.due}</td>
                    <td><Badge tone={t.tone}>{t.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Repository({ data, open, newKaizen }) {
  const [query, setQuery] = useState('');
  const [plant, setPlant] = useState('All plants');
  const [shop, setShop] = useState('All shops');
  const [status, setStatus] = useState('All statuses');
  const [layout, setLayout] = useState('grid');
  const [sort, setSort] = useState('Most recent');
  const [number, setNumber] = useState(1);
  const [showBanner, setShowBanner] = useState(true);
  const [matches, setMatches] = useState(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => { setNumber(1); }, [query, plant, shop, status]);
  useEffect(() => {
    if (!query.trim()) { setMatches(null); setSearching(false); return; }
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      request('search?q=' + encodeURIComponent(query))
        .then(rows => { if (!cancelled) setMatches(rows); })
        .catch(() => {})
        .finally(() => { if (!cancelled) setSearching(false); });
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [query]);

  const rows = useMemo(() => {
    let records = (query.trim() ? matches || [] : data.kaizens).filter(k =>
      (plant === 'All plants' || k.plant === plant) &&
      (shop === 'All shops' || k.shop === shop) &&
      (status === 'All statuses' || k.status === status)
    );
    return [...records].sort((a, b) =>
      sort === 'Title' ? a.title.localeCompare(b.title) :
      sort === 'Relevance' ? (b.score || 0) - (a.score || 0) :
      (a.status === 'Approved') - (b.status === 'Approved') || b.id - a.id
    );
  }, [data, query, matches, plant, shop, status, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / 9));
  const current = rows.slice((Math.min(number, pages) - 1) * 9, Math.min(number, pages) * 9);

  return (
    <>
      <Heading
        title="Discover what already works."
        subtitle="Proven improvements, supporting evidence, and lessons worth sharing."
      >
        <Button primary icon={Plus} onClick={newKaizen}>New Kaizen</Button>
      </Heading>

      {showBanner && (
        <div className="review-alert-banner">
          <div className="review-alert-banner-left">
            <ClipboardCheck size={20} style={{ color: '#2563eb' }} />
            <div>
              <strong>3 drafts and 2 pending items awaiting review.</strong>
              <span>Complete your drafts or review pending approvals to keep knowledge moving.</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button className="text-action" onClick={() => setStatus('Draft')}>View drafts</button>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
              onClick={() => setShowBanner(false)}
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      <div className="repository-controls">
        <SearchField value={query} onChange={setQuery} placeholder="Search problems, equipment, or countermeasures…" />
        <div className="filter-row">
          <Select label="Plant" value={plant} onChange={setPlant}>
            <option>All plants</option>
            {['Plant A', 'Plant B', 'Plant C'].map(p => <option key={p}>{p}</option>)}
          </Select>
          <Select label="Shop" value={shop} onChange={setShop}>
            <option>All shops</option>
            {['Welding', 'Machining', 'Assembly', 'Paint Shop', 'Body Shop', 'Quality'].map(p => <option key={p}>{p}</option>)}
          </Select>
          <Select label="Status" value={status} onChange={setStatus}>
            <option>All statuses</option>
            {['Draft', 'Pending', 'Approved', 'Blocked'].map(p => <option key={p}>{p}</option>)}
          </Select>
          <button
            className="text-action muted"
            onClick={() => { setQuery(''); setPlant('All plants'); setShop('All shops'); setStatus('All statuses'); }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <div className="result-toolbar">
        <span><strong>{rows.length}</strong> results {searching && <Loader2 size={14} className="loading-icon" />}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Select label="Sort by" value={sort} onChange={setSort}>
            {['Most recent', 'Title', 'Relevance'].map(s => <option key={s}>{s}</option>)}
          </Select>
          <div className="segmented">
            <button aria-label="Grid view" aria-pressed={layout === 'grid'} onClick={() => setLayout('grid')}><LayoutGrid size={16} /></button>
            <button aria-label="List view" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={16} /></button>
          </div>
        </div>
      </div>

      <div className={'knowledge-grid ' + (layout === 'list' ? 'knowledge-list' : '')}>
        {current.map(k => (
          <article className="knowledge-card" key={k.id}>
            <div className="knowledge-card-header">
              <div className="card-id-status">
                <span className="record-id">KZ-{String(k.id).padStart(4, '0')}</span>
                <Badge>{k.status}</Badge>
              </div>
              <span className="shop-tag">{k.shop}</span>
            </div>

            <h2>
              <button onClick={() => open('kaizens', k.id)}>
                {k.title}
              </button>
            </h2>

            <p>{k.problem}</p>

            <div className="card-location">
              <Wrench size={13} />
              <span>{k.plant} · {k.equipment}</span>
            </div>

            <div className="card-metric-box">
              <span>{k.kpi || 'Scrap rate'}</span>
              <strong>{k.baseline}{k.unit || '%'} {k.post != null && <>→ {k.post}{k.unit || '%'}</>}</strong>
            </div>

            <div className="card-footer">
              <button className="card-footer-link" onClick={() => open('kaizens', k.id)}>
                Open improvement →
              </button>
              <div className="card-footer-actions">
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} aria-label="Bookmark">
                  <Bookmark size={16} />
                </button>
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }} aria-label="More options">
                  <MoreHorizontal size={16} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="pagination">
        <span>Search uses offline text similarity.</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Button icon={ChevronLeft} disabled={number <= 1} onClick={() => setNumber(n => n - 1)}>Previous</Button>
          <button className="btn btn-primary" style={{ minWidth: 32, padding: '4px 8px' }}>1</button>
          <button className="btn" style={{ minWidth: 32, padding: '4px 8px' }}>2</button>
          <Button disabled={number >= pages} onClick={() => setNumber(n => n + 1)}>Next <ChevronRight size={14} /></Button>
        </div>
      </div>
    </>
  );
}

function Recommendations({ approved, selectedId, setId, open, tell }) {
  const id = approved.some(k => k.id === selectedId) ? selectedId : approved[0]?.id || 1;
  const { data: results, loading, error } = useRemote('recommendations/' + id);
  const [siteId, setSiteId] = useState(null);
  const list = results || [];
  const selected = list.find(r => r.id === siteId) || list[0];
  const source = approved.find(k => k.id === id);

  return (
    <>
      <Heading
        title="Find the next place to improve."
        subtitle="Understand every recommendation before making a deployment decision."
      />

      <div className="recommendation-top-card">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <span className="source-icon" style={{ padding: 8, borderRadius: 6, background: '#e0f2f1', color: '#008b87' }}>
            <BookOpen size={22} />
          </span>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <strong style={{ fontSize: 15, color: '#0f172a' }}>{source?.title || 'Reduce welding fixture misalignment'}</strong>
              <Badge tone="success">Approved</Badge>
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              KZN-{String(id).padStart(4, '0')} | {source?.plant} | {source?.shop} | Created Apr 5, 2024
            </div>
          </div>
        </div>

        <div style={{ maxWidth: 460, fontSize: 12, color: '#475569', lineHeight: 1.4 }}>
          <strong>{source?.problem || 'Recurring alignment drift in welding fixtures'}</strong><br />
          Causes rework and inconsistent weld quality. Implemented standardized fixture setup and validation checks.
        </div>

        <Button outline icon={ExternalLink} onClick={() => open('kaizens', id)}>
          View in repository
        </Button>
      </div>

      <div className="recommendation-layout">
        <section className="surface target-list">
          <div className="surface-header">
            <div>
              <h2>Target sites for deployment</h2>
              <p>{list.length} opportunities assessed</p>
            </div>
            <Target size={18} style={{ color: '#0f766e' }} />
          </div>

          <table className="rec-target-table">
            <thead>
              <tr style={{ background: '#f8fafc', color: '#64748b', fontSize: 11, borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>#</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Plant</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Shop</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>Equipment</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Score</th>
                <th style={{ width: 24 }} />
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr
                  key={r.id}
                  className={`target-row ${r.id === selected?.id ? 'selected' : ''}`}
                  onClick={() => setSiteId(r.id)}
                >
                  <td style={{ color: '#94a3b8', fontWeight: 600 }}>{i + 1}</td>
                  <td><strong>{r.plant}</strong></td>
                  <td style={{ color: '#64748b' }}>{r.shop}</td>
                  <td style={{ color: '#64748b' }}>{r.equipment}</td>
                  <td className="score-cell">{r.score}</td>
                  <td style={{ color: '#cbd5e1' }}><ChevronRight size={14} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: '10px 14px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
            Showing {list.length} of {list.length} target sites
          </div>
        </section>

        {selected && (
          <Panel
            title="Assessment for selected target site"
            subtitle={`${selected.plant} / ${selected.shop} / ${selected.equipment}`}
            action={<Badge tone="neutral">Decision support</Badge>}
          >
            <div className="recommendation-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 16 }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#065f46', display: 'flex', alignItems: 'center', gap: 4 }}>
                    WEIGHTED RELEVANCE SCORE <Info size={12} />
                  </div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: '#047857', margin: '4px 0' }}>
                    {selected.score} <small style={{ fontSize: 14, fontWeight: 400, color: '#065f46' }}>/100</small>
                  </div>
                  <div style={{ fontSize: 11, color: '#065f46' }}>Ranking score, not a probability</div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
                    EQUIPMENT CONTEXT
                  </div>
                  <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.6 }}>
                    <div>Plant: <strong>{selected.plant}</strong></div>
                    <div>Shop: <strong>{selected.shop}</strong></div>
                    <div>Equipment: <strong>{selected.equipment}</strong></div>
                    <div>Similar to source: <strong style={{ color: '#059669' }}>{selected.equipment === source?.equipment ? 'Yes' : 'No'}</strong></div>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 6, padding: 12, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: 11, color: '#64748b' }}>KPI comparison (scrap rate)</span>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a', marginTop: 2 }}>
                    {selected.scrap}% at this site vs 2.1% benchmark (source)
                  </div>
                </div>
                <Badge tone="danger">+{(selected.scrap - 2.1).toFixed(1)}% higher than benchmark</Badge>
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#334155', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                  Relevance factors (weighted contribution) <Info size={12} />
                </div>
                <div className="factor-list">
                  {Object.entries(selected.factors).map(([name, val]) => (
                    <div className="factor-row" key={name}>
                      <div><span>{name}</span></div>
                      <div className="factor-track">
                        <span style={{ width: `${val}%`, background: ['Text relevance', 'Equipment match', 'Process match'].includes(name) ? '#008b87' : '#3b82f6' }} />
                      </div>
                      <strong>{val}%</strong>
                    </div>
                  ))}
                </div>
              </div>

              <div className="notice amber" style={{ marginBottom: 16 }}>
                <Clock3 size={18} />
                <div>
                  <strong>Feasibility needs human assessment.</strong>
                  <p>A neutral prior is used until local prerequisites are reviewed (e.g., resources, space, downtime, safety).</p>
                </div>
              </div>

              <div className="recommendation-actions">
                <Button primary icon={Plus} onClick={() => window.CIBridge.assign(id, selected.id)}>
                  Assign for assessment
                </Button>
                <Button onClick={() => window.CIBridge.feedback(id, selected.id)}>
                  Give feedback
                </Button>
                <Button outline icon={ExternalLink} onClick={() => open('kaizens', id)}>
                  View source
                </Button>
              </div>

              <small className="model-note" style={{ display: 'block', marginTop: 12, color: '#94a3b8', fontSize: 11 }}>
                {selected.model} · Uses synthetic sample data for demonstration.
              </small>
            </div>
          </Panel>
        )}
      </div>
    </>
  );
}

function Deployments({ data, open }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('All statuses');
  const [plant, setPlant] = useState('All plants');

  const lifecycleStages = ['Suggested', 'Review', 'Feasibility', 'Planned', 'Implemented', 'Validated', 'Closed'];

  const rows = data.hd.filter(h =>
    (status === 'All statuses' || h.status === status) &&
    (plant === 'All plants' || h.plant === plant) &&
    (h.title + ' ' + h.owner).toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Heading
        title="From proven idea to verified impact."
        subtitle="Accountable owners. Clear decisions. Measurable outcomes."
      />

      <div className="hd-stepper lifecycle-summary">
        {lifecycleStages.map((s, i) => (
          <React.Fragment key={s}>
            <button
              className={`hd-step-item ${status === s ? 'active selected' : ''}`}
              onClick={() => setStatus(status === s ? 'All statuses' : s)}
            >
              <strong>{s} ({data.hd.filter(h => h.status === s).length})</strong>
              <span>Lifecycle stage</span>
            </button>
            {i < lifecycleStages.length - 1 && <ChevronRight size={14} style={{ color: '#cbd5e1' }} />}
          </React.Fragment>
        ))}
      </div>

      <div className="filter-strip">
        <SearchField value={query} onChange={setQuery} placeholder="Search improvement or owner…" />
        <div className="filter-left">
          <Select label="Plant" value={plant} onChange={setPlant}>
            <option>All plants</option>
            {['Plant A', 'Plant B', 'Plant C'].map(p => <option key={p}>{p}</option>)}
          </Select>
          <Select label="Status" value={status} onChange={setStatus}>
            <option>All statuses</option>
            {lifecycleStages.map(s => <option key={s}>{s}</option>)}
          </Select>
          <button
            className="text-action muted"
            onClick={() => { setQuery(''); setPlant('All plants'); setStatus('All statuses'); }}
          >
            Clear filters
          </button>
        </div>
      </div>

      <Hint>
        Task progress does not approve a deployment. Lifecycle transitions require an authorized decision.
      </Hint>

      <Panel
        title="Deployment workspace"
        subtitle={`Showing ${rows.length} tracked deployments`}
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Select label="Sort by" value="Due date (earliest)" onChange={() => {}}>
              <option>Due date (earliest)</option>
              <option>Latest</option>
            </Select>
            <div className="segmented">
              <button aria-label="Table view" aria-pressed="true"><List size={16} /></button>
              <button aria-label="Grid view"><LayoutGrid size={16} /></button>
            </div>
          </div>
        }
      >
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Improvement</th>
                <th>Target location</th>
                <th>Accountable owner</th>
                <th>Due date</th>
                <th>Status</th>
                <th>Open action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(h => {
                const isOverdue = h.due < new Date().toISOString().slice(0, 10);
                const actionLabel =
                  h.status === 'Review' ? 'Review details' :
                  h.status === 'Feasibility' ? 'Complete assessment' :
                  h.status === 'Planned' ? 'Finalize plan' :
                  h.status === 'Implemented' ? 'Track progress' :
                  h.status === 'Validated' ? 'View results' :
                  h.status === 'Closed' ? 'View results' : 'Begin review';
                const initials = h.owner.split(' ').map(x => x[0]).join('').slice(0, 2);

                return (
                  <tr key={h.id}>
                    <td>
                      <button className="table-record" onClick={() => open('hd', h.id)}>
                        {h.title}
                      </button>
                      <small>HD-{String(h.id).padStart(3, '0')} · KZ-{h.kaizen_id}</small>
                    </td>
                    <td>
                      <strong>{h.plant}</strong>
                      <small>{h.shop}</small>
                    </td>
                    <td>
                      <span className="owner-cell" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="mini-avatar" style={{ width: 22, height: 22, borderRadius: '50%', background: '#e2e8f0', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>
                          {initials}
                        </span>
                        {h.owner}
                      </span>
                    </td>
                    <td className="no-wrap">
                      {new Date(h.due + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {isOverdue && <small style={{ display: 'block', color: '#dc2626', fontWeight: 600 }}>▲ Overdue</small>}
                    </td>
                    <td><Badge>{h.status}</Badge></td>
                    <td>
                      <button className="action-btn-outline" onClick={() => open('hd', h.id)}>
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </>
  );
}

function Benchmarks({ data }) {
  const [kpi, setKpi] = useState('Scrap Rate');
  const [plant, setPlant] = useState('All plants');
  const { data: b, loading, error } = useRemote('benchmark?kpi=' + encodeURIComponent(kpi));
  const rows = b?.rows.filter(r => plant === 'All plants' || r.plant === plant) || [];
  const best = b?.rows.find(r => r.value === b.benchmark);

  return (
    <>
      <Heading
        title="Compare consistently. Improve deliberately."
        subtitle="Common definitions make performance gaps meaningful."
      >
        <Button icon={ArrowDownToLine} primary onClick={() => csv('ci-bench-benchmark.csv', [['Plant', 'Shop', 'KPI', 'Actual', 'Unit', 'Benchmark', 'Window'], ...rows.map(r => [r.plant, r.shop, kpi, r.value, r.unit, b.benchmark, r.window])])}>
          Export CSV
        </Button>
      </Heading>

      <div className="filter-strip">
        <div className="filter-left">
          <Select label="KPI" value={kpi} onChange={setKpi}>
            {Object.keys(data.meta.kpis).map(k => <option key={k}>{k}</option>)}
          </Select>
          <Select label="Plant" value={plant} onChange={setPlant}>
            <option>All plants</option>
            {['Plant A', 'Plant B', 'Plant C'].map(p => <option key={p}>{p}</option>)}
          </Select>
        </div>
        <span className="context-chip"><Info size={14} /> Lower is better · 30 days</span>
      </div>

      {error ? <RemoteError message={error} /> : loading ? <Skeleton /> : (
        <>
          <div className="metric-grid benchmark-metrics">
            <article className="metric-card">
              <span className="metric-top">Best observed benchmark</span>
              <div className="metric-value">{b.benchmark}<small>{b.rows[0].unit}</small></div>
              <div className="metric-note"><CheckCircle2 size={13} /> Across all nine shops</div>
            </article>
            <article className="metric-card">
              <span className="metric-top">Best performer</span>
              <div className="metric-value text-value" style={{ fontSize: 24 }}>{best?.plant} / {best?.shop}</div>
              <div className="metric-note">Top benchmark rank</div>
            </article>
            <article className="metric-card">
              <span className="metric-top">Comparable observations</span>
              <div className="metric-value">{rows.length}</div>
              <div className="metric-note">Matching unit and window</div>
            </article>
          </div>

          <Panel
            title={`${kpi} comparison`}
            subtitle="Synthetic 30-day observations"
            action={<span className="unit-tag" style={{ background: '#f1f5f9', padding: '3px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>{b.rows[0].unit}</span>}
          >
            <div style={{ padding: '8px 0' }}>
              {rows.map(r => (
                <div key={r.id} className="benchmark-chart-row horizontal-chart-row">
                  <div className="benchmark-col-plant">{r.plant}</div>
                  <div className="benchmark-col-shop">{r.shop}</div>
                  <div className="benchmark-col-val">{r.value}{r.unit}</div>
                  <div className="benchmark-col-bar">
                    <div className="benchmark-bar-track">
                      <div
                        className={`benchmark-bar-fill ${r.value === b.benchmark ? 'best' : ''}`}
                        style={{ width: `${Math.max(3, (r.value / Math.max(...rows.map(x => x.value))) * 100)}%` }}
                      />
                    </div>
                  </div>
                  <div className="benchmark-col-gap">
                    {r.value === b.benchmark ? '0.0 pp' : `+${Math.abs(r.value - b.benchmark).toFixed(1)} pp`}
                  </div>
                </div>
              ))}

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px 4px', fontSize: 11, color: '#94a3b8', borderTop: '1px solid #f1f5f9' }}>
                <span>0%</span>
                <span>1%</span>
                <span>2%</span>
                <span>3%</span>
                <span>4%</span>
                <span>5%</span>
                <span>6%</span>
              </div>
              <div style={{ textAlign: 'center', fontSize: 11, color: '#64748b', marginTop: 2 }}>{kpi} ({b.rows[0].unit})</div>
            </div>
          </Panel>

          <Hint>
            Benchmarks shown here are fixed demonstration data and are separate from independently verified deployment outcomes.
          </Hint>
        </>
      )}
    </>
  );
}

function Audit({ refreshKey }) {
  const { data: rows, loading, error } = useRemote('audit?refresh=' + refreshKey);
  const [q, setQ] = useState('');
  const [expandedId, setExpandedId] = useState(1);

  const filtered = rows?.filter(r =>
    (r.actor + ' ' + r.entity + ' ' + r.action).toLowerCase().includes(q.toLowerCase())
  ) || [];

  return (
    <>
      <Heading
        title="Every decision leaves a trace."
        subtitle="Trace changes from improvement capture to validated deployment."
      >
        <Button icon={ArrowDownToLine} primary onClick={() => download('audit.json', new Blob([JSON.stringify(filtered, null, 2)], { type: 'application/json' }))}>
          Export audit
        </Button>
      </Heading>

      <div className="filter-strip">
        <SearchField value={q} onChange={setQ} placeholder="Filter actor, action, or record ID…" />
        <span className="context-chip"><ShieldCheck size={14} /> Authorized roles only</span>
        <Select label="Type" value="All record types" onChange={() => {}}>
          <option>All record types</option>
          <option>Kaizens</option>
          <option>Deployments</option>
        </Select>
      </div>

      {error ? <RemoteError message={error} /> : loading ? <Skeleton /> : (
        <Panel title="Recorded activity" subtitle={`${filtered.length} events · most recent first · Append-only application audit`}>
          <div className="audit-events">
            {filtered.slice(0, 50).map((r, i) => (
              <div key={r.id} className="audit-event" style={{ borderBottom: '1px solid #f1f5f9' }}>
                <summary
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', cursor: 'pointer', listStyle: 'none' }}
                  onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: '#94a3b8', width: 20 }}>{i + 1}</span>
                    <div>
                      <strong style={{ fontSize: 13, color: '#1e293b' }}>{r.action.replaceAll('_', ' ')}</strong>
                      <small style={{ display: 'block', color: '#64748b' }}>Decision event</small>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: 200 }}>
                    <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600 }}>
                      {r.actor.split(' ').map(x => x[0]).join('').slice(0, 2)}
                    </span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#334155' }}>{r.actor}</div>
                      <small style={{ fontSize: 10, color: '#94a3b8' }}>Authorized persona</small>
                    </div>
                  </div>

                  <div style={{ width: 220, fontSize: 12 }}>
                    <div style={{ color: '#0f766e', fontWeight: 500 }}>{r.entity}</div>
                  </div>

                  <div style={{ fontSize: 11, color: '#94a3b8', width: 150 }}>
                    {new Date(r.time).toLocaleString()}
                  </div>

                  <ChevronDown size={15} style={{ transform: expandedId === r.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: '#94a3b8' }} />
                </summary>

                {expandedId === r.id && (
                  <div style={{ padding: '0 16px 14px' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 6 }}>
                      Stored record snapshot (at time of action)
                    </div>
                    <div className="audit-json-box">
                      <button
                        className="audit-copy-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard?.writeText(JSON.stringify(JSON.parse(r.detail), null, 2));
                        }}
                      >
                        Copy
                      </button>
                      <pre style={{ margin: 0 }}>{JSON.stringify(JSON.parse(r.detail), null, 2)}</pre>
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                      This snapshot shows key fields at the time of action. Full record history is retained in the system.
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}
    </>
  );
}

function WorkHub({ data, open, newKaizen }) {
  const w = data.workspace;

  const templateList = [
    { title: 'Quality Improvement', desc: 'Capture defects, rework reduction, process capability and quality improvements.', icon: CheckCircle2 },
    { title: 'Safety Improvement', desc: 'Record safety observations, risk reduction measures and unsafe condition fixes.', icon: ShieldCheck },
    { title: 'Maintenance Improvement', desc: 'Document reliability, downtime reduction and maintenance best practices.', icon: Wrench },
    { title: 'Productivity Improvement', desc: 'Capture cycle time reduction, throughput improvement and efficiency gains.', icon: TrendingUp },
    { title: 'Process Consistency', desc: 'Standardize work, reduce variation and capture best practices.', icon: GitBranch }
  ];

  const savedCollections = [
    { name: 'Welding Improvements', desc: 'All welding related kaizens and references', count: 12 },
    { name: 'Assembly Best Practices', desc: 'Assembly line improvements and standards', count: 8 },
    { name: 'Maintenance Learnings', desc: 'Preventive maintenance and equipment reliability', count: 6 },
    { name: 'Safety Initiatives', desc: 'Safety observations and risk mitigation', count: 5 },
    { name: 'Plant C Projects', desc: 'Improvements from Plant C', count: 4 }
  ];

  const teamTasks = [
    { task: 'Review welding fixture misalignment draft', assignee: 'Sarah Chen', due: 'Sep 18, 2025', status: 'In Progress', progress: 60 },
    { task: 'Complete feasibility study (Plant C)', assignee: 'Miguel Santos', due: 'Sep 16, 2025', status: 'Overdue', progress: 30 },
    { task: 'Update KPI measurements (Assembly)', assignee: 'Emma Lee', due: 'Sep 20, 2025', status: 'Not Started', progress: 0 },
    { task: 'Prepare deployment plan (Plant D)', assignee: 'Rajesh Kumar', due: 'Sep 22, 2025', status: 'In Progress', progress: 40 },
    { task: 'Review process change standard', assignee: 'Taylor Smith', due: 'Sep 15, 2025', status: 'Overdue', progress: 20 }
  ];

  return (
    <>
      <Heading
        title="Your improvement workspace."
        subtitle="Keep useful knowledge and the next action close."
      >
        <Button primary icon={Plus} onClick={newKaizen}>Capture improvement</Button>
      </Heading>

      <div className="hub-top">
        <section className="hub-feature" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <span className="hub-feature-icon"><FileText size={24} /></span>
            <h2>Start with a transcript.</h2>
            <p>Paste an author-supplied transcript of an improvement discussion, observation, or meeting. We will convert it into an editable Kaizen draft for your review.</p>
            <Button primary onClick={() => window.CIBridge.transcript()}>Create a draft</Button>
          </div>
          <div style={{ background: '#ffffff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '10px 14px', width: 180, fontSize: 11, color: '#64748b' }}>
            <strong style={{ color: '#1e3a8a', display: 'block', marginBottom: 4 }}>Your text</strong>
            [Author transcript discussion and countermeasure observations...]
          </div>
        </section>

        <section className="surface hub-inbox" style={{ background: '#eff6ff', border: '1px solid #bfdbfe' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#1d4ed8', marginBottom: 6 }}>
            <ClipboardCheck size={20} />
            <h2 style={{ fontSize: 16, margin: 0 }}>Make the next decision clear.</h2>
          </div>
          <p style={{ fontSize: 12, color: '#475569', margin: '0 0 14px' }}>
            See your mentions, open assignments, and approaching deadlines — all in one place.
          </p>
          <div style={{ display: 'flex', gap: 18, marginBottom: 14 }}>
            <div><strong style={{ fontSize: 22, color: '#1e40af', display: 'block' }}>5</strong><small style={{ color: '#64748b' }}>My assignments</small></div>
            <div><strong style={{ fontSize: 22, color: '#1e40af', display: 'block' }}>2</strong><small style={{ color: '#64748b' }}>Mentions</small></div>
            <div><strong style={{ fontSize: 22, color: '#1e40af', display: 'block' }}>3</strong><small style={{ color: '#64748b' }}>Due this week</small></div>
          </div>
          <Button primary onClick={() => window.CIBridge.inbox()}>Open work queue</Button>
        </section>
      </div>

      <Panel
        title="Use a template to get started."
        subtitle="A consistent structure for the way your team improves"
        action={<button className="text-action" onClick={() => window.CIBridge.create()}>View all templates →</button>}
      >
        <div className="template-grid">
          {templateList.map((t, i) => {
            const Icon = t.icon;
            return (
              <button key={t.title} onClick={() => window.CIBridge.template(i)}>
                <span className={`template-icon tone-${i}`}><Icon size={20} /></span>
                <strong>{t.title}</strong>
                <span>{t.desc}</span>
                <small>Use template <ArrowUpRight size={13} /></small>
              </button>
            );
          })}
        </div>
      </Panel>

      <div className="hub-lower">
        <Panel
          title="Saved collections"
          subtitle="Knowledge organized for your next project"
          action={<Button outline icon={Plus}>New collection</Button>}
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Improvements</th>
                  <th style={{ width: 24 }} />
                </tr>
              </thead>
              <tbody>
                {savedCollections.map(c => (
                  <tr key={c.name}>
                    <td><strong>{c.name}</strong></td>
                    <td style={{ color: '#64748b' }}>{c.desc}</td>
                    <td><Badge tone="neutral">{c.count}</Badge></td>
                    <td><MoreHorizontal size={14} style={{ color: '#94a3b8' }} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Team tasks"
          subtitle="Recent action items and assignments"
          action={<button className="text-action">View all tasks →</button>}
        >
          <div className="data-table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Task</th>
                  <th>Assignee</th>
                  <th>Due date</th>
                  <th>Status</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {teamTasks.map(t => (
                  <tr key={t.task}>
                    <td><strong>{t.task}</strong></td>
                    <td style={{ color: '#64748b' }}>{t.assignee}</td>
                    <td style={{ color: '#64748b' }}>{t.due}</td>
                    <td><Badge>{t.status}</Badge></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <progress value={t.progress} max="100" style={{ width: 60 }} />
                        <span style={{ fontSize: 10, color: '#64748b' }}>{t.progress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </>
  );
}

function Equipment({ data, open, tell }) {
  const param = new URLSearchParams(location.search).get('equipment');
  const [plant, setPlant] = useState('All plants');
  const [query, setQuery] = useState('');

  const rows = data.meta.sites.filter(s =>
    (plant === 'All plants' || s.plant === plant) &&
    (!param || s.id === Number(param)) &&
    (`${s.equipment} ${s.shop} ${s.plant} EQ-${String(s.id).padStart(3, '0')}`).toLowerCase().includes(query.toLowerCase())
  );

  async function qr(id) {
    try {
      const r = await fetch('/api/v1/collab/qr?id=' + id, { headers: { Authorization: 'Bearer ' + session } });
      if (!r.ok) throw Error('Unable to create QR label');
      download('equipment-' + id + '.svg', await r.blob());
    } catch (e) {
      tell(e.message);
    }
  }

  return (
    <>
      <Heading
        title="Useful knowledge, beside the equipment."
        subtitle="Connect manufacturing context to proven improvements and work instructions."
      />

      <div className="filter-strip">
        <Select label="Plant" value={plant} onChange={setPlant}>
          <option>All plants</option>
          {['Plant A', 'Plant B', 'Plant C'].map(p => <option key={p}>{p}</option>)}
        </Select>
        <span className="context-chip"><Wrench size={14} /> {rows.length} equipment contexts</span>
        <SearchField value={query} onChange={setQuery} placeholder="Search equipment, ID, or shop…" />
      </div>

      <div className="equipment-grid">
        {rows.map((s, i) => {
          const eqCode = `EQ-${String(s.id).padStart(3, '0')}`;
          const imgFile = `/equipment/${{ Welding: 'welding', Machining: 'machining', Assembly: 'assembly' }[s.shop] || 'welding'}.png`;
          const related = data.kaizens.filter(k => k.status === 'Approved' && k.equipment === s.equipment).slice(0, 3);

          return (
            <article className="surface equipment-card" key={s.id} style={{ position: 'relative' }}>
              <span className="equipment-badge-eq">{eqCode}</span>
              <img className="equipment-visual" src={imgFile} alt={s.equipment} />

              <h2 style={{ fontSize: 16, margin: '4px 0 2px' }}>{s.equipment}</h2>
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                {s.plant} · {s.shop}
              </div>

              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>
                Operational Context
              </div>
              <p style={{ fontSize: 12, color: '#475569', lineHeight: 1.5, margin: '0 0 14px' }}>
                {s.context}
              </p>

              <div style={{ fontSize: 11, fontWeight: 600, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 6 }}>
                Related approved improvements ({related.length})
              </div>

              <div style={{ marginBottom: 14 }}>
                {related.map(k => (
                  <button
                    key={k.id}
                    className="equipment-link"
                    onClick={() => open('kaizens', k.id)}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: 6 }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5 }}>
                      <FileText size={14} style={{ color: '#008b87' }} />
                      <span><strong>KZ-{String(k.id).padStart(4, '0')}:</strong> {k.title}</span>
                    </div>
                    <ChevronRight size={13} style={{ color: '#94a3b8' }} />
                  </button>
                ))}
              </div>

              <Button primary icon={ArrowDownToLine} onClick={() => qr(s.id)}>
                Download QR label
              </Button>

              {i === 2 && (
                <div style={{ marginTop: 14, background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: 6, padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <QrCode size={40} style={{ color: '#334155' }} />
                  <div style={{ fontSize: 11, color: '#64748b' }}>
                    <strong style={{ color: '#1e293b', display: 'block' }}>QR label preview (placeholder)</strong>
                    Link: http://localhost:8765/?equipment=EQ-003
                  </div>
                </div>
              )}
            </article>
          );
        })}
      </div>

      <Hint>
        QR labels link to the CI-BENCH application. Localhost addresses require a reachable deployment for access from mobile devices.
      </Hint>
    </>
  );
}

createRoot(document.getElementById('react-root')).render(<App />);
