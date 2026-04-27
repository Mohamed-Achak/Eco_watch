// frontend/js/api.js
// Centralised API client for EcoWatch backend
// All fetch calls go through here — easy to swap base URL

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? `${window.location.protocol}//${window.location.host}/api`
  : `/api`;

const api = {
  // ─── REPORTS ──────────────────────────────────────────────────
  async getReports(params = {}) {
    const qs = new URLSearchParams(params).toString();
    return _fetch(`/reports${qs ? '?' + qs : ''}`);
  },
  async getReport(id) {
    return _fetch(`/reports/${id}`);
  },
  async createReport(data) {
    return _fetch('/reports', { method: 'POST', body: JSON.stringify(data) });
  },
  async updateStatus(id, status, comment = '', verifiedBy = null) {
    return _fetch(`/reports/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, status_comment: comment, verified_by: verifiedBy }),
    });
  },
  async deleteReport(id) {
    return _fetch(`/reports/${id}`, { method: 'DELETE' });
  },
  async getStats() {
    return _fetch('/reports/meta/stats');
  },

  // ─── ALERTS ───────────────────────────────────────────────────
  async getAlerts() {
    return _fetch('/alerts');
  },
  async acknowledgeAlert(id) {
    return _fetch(`/alerts/${id}/acknowledge`, { method: 'PATCH' });
  },

  // ─── MAP LABELS ───────────────────────────────────────────────
  async getLabels(category = null) {
    const qs = category ? `?category=${category}` : '';
    return _fetch(`/labels${qs}`);
  },
  async createLabel(data) {
    return _fetch('/labels', { method: 'POST', body: JSON.stringify(data) });
  },
  async deleteLabel(id) {
    return _fetch(`/labels/${id}`, { method: 'DELETE' });
  },

  // ─── USERS ────────────────────────────────────────────────────
  async getUsers() {
    return _fetch('/users');
  },
};

async function _fetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.error || `HTTP ${res.status}`);
  return json;
}

// In-memory demo fallback when backend is not running
const DEMO_REPORTS = [];

const DEMO_LABELS = [
  { id:1,  name:'Ifrane City Centre',     category:'city',     latitude:33.5333, longitude:-5.1067, icon:'🏙', description:'Main urban area' },
  { id:2,  name:'Lac Ifrane',             category:'lake',     latitude:33.5270, longitude:-5.1050, icon:'💧', description:'Natural lake' },
  { id:3,  name:'Cèdre Gouraud Forest',   category:'forest',   latitude:33.4800, longitude:-5.2000, icon:'🌲', description:'Ancient Cedar reserve' },
  { id:4,  name:'Jbel Hebri',             category:'landmark', latitude:33.5100, longitude:-5.0500, icon:'⛰', description:'Mountain peak east of Ifrane' },
  { id:5,  name:'National Park Entry',    category:'landmark', latitude:33.5500, longitude:-5.0800, icon:'🏕', description:'Ifrane National Park gate' },
  { id:6,  name:'Al Akhawayn University', category:'landmark', latitude:33.5230, longitude:-5.1060, icon:'🎓', description:'University campus' },
  { id:7,  name:'Avenue Mohammed V',      category:'road',     latitude:33.5300, longitude:-5.1100, icon:'🛣', description:'Main boulevard' },
  { id:8,  name:'Zone Rouge Forêt Nord',  category:'zone',     latitude:33.5600, longitude:-5.0900, icon:'🚫', description:'High fire-risk zone' },
  { id:9,  name:'Zone Faune Protégée',    category:'zone',     latitude:33.5100, longitude:-5.1400, icon:'🦌', description:'Protected wildlife corridor' },
  { id:10, name:'Hôpital Ifrane',         category:'landmark', latitude:33.5340, longitude:-5.1020, icon:'🏥', description:'Regional hospital' },
  { id:11, name:'Oued Tizguit',           category:'lake',     latitude:33.5150, longitude:-5.1200, icon:'🌊', description:'River south of Ifrane' },
  { id:12, name:'Camping Les Cèdres',     category:'landmark', latitude:33.4950, longitude:-5.1500, icon:'⛺', description:'Forest campsite' },
];

let _nextDemoId = 1;
let _demoReports = [...DEMO_REPORTS];
let _demoLabels  = [...DEMO_LABELS];

// Demo fallback wrapper — used when backend is offline
const demoApi = {
  getReports(params = {}) {
    let r = [..._demoReports];
    if (params.type && params.type !== 'all') r = r.filter(x => x.type === params.type);
    if (params.status && params.status !== 'all') r = r.filter(x => x.status === params.status);
    if (params.range === '24h') r = r.filter(x => Date.now() - new Date(x.created_at) < 86400000);
    if (params.range === '7d')  r = r.filter(x => Date.now() - new Date(x.created_at) < 604800000);
    r.sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    return Promise.resolve({ success:true, count:r.length, data:r });
  },
  getStats() {
    const r = _demoReports;
    return Promise.resolve({ success:true, data:{
      total:r.length, fire:r.filter(x=>x.type==='fire').length,
      wildlife:r.filter(x=>x.type==='wildlife').length,
      high:r.filter(x=>x.severity==='high'&&x.status!=='resolved').length,
      pending:r.filter(x=>x.status==='new').length,
      verified:r.filter(x=>x.status==='verified').length,
      resolved:r.filter(x=>x.status==='resolved').length,
      today:r.filter(x=>Date.now()-new Date(x.created_at)<86400000).length,
    }});
  },
  createReport(data) {
    const r = { id:_nextDemoId, report_code:`RPT-${String(_nextDemoId).padStart(4,'0')}`, ...data, status:'new', created_at:new Date().toISOString(), reporter_name:'You' };
    _nextDemoId++;
    _demoReports.unshift(r);
    if (data.type==='fire'&&data.severity==='high') window._highAlertPending = true;
    return Promise.resolve({ success:true, data:r, message:'Report submitted.' });
  },
  updateStatus(id, status) {
    const r = _demoReports.find(x=>x.id===id||x.report_code===id);
    if (r) { r.status = status; r.updated_at = new Date().toISOString(); }
    return Promise.resolve({ success:true, data:r });
  },
  deleteReport(id) {
    _demoReports = _demoReports.filter(x=>x.id!==id&&x.report_code!==id);
    return Promise.resolve({ success:true });
  },
  getAlerts() {
    return Promise.resolve({ success:true, data:_demoReports.filter(x=>x.severity==='high'&&x.status!=='resolved').map(x=>({id:x.id,report_code:x.report_code,type:x.type,description:x.description,latitude:x.latitude,longitude:x.longitude,message:`HIGH SEVERITY: ${x.description}`,acknowledged:0})) });
  },
  acknowledgeAlert(id) { return Promise.resolve({success:true}); },
  getLabels()  { return Promise.resolve({ success:true, data:_demoLabels }); },
  createLabel(data) {
    const l = { id: Date.now(), ...data };
    _demoLabels.push(l);
    return Promise.resolve({ success:true, data:l });
  },
  deleteLabel(id) {
    _demoLabels = _demoLabels.filter(x=>x.id!==id);
    return Promise.resolve({success:true});
  },
  getUsers() {
    return Promise.resolve({ success:true, data:[
      {id:1,username:'civilian1',email:'civilian@ecowatch.ma',role:'civilian'},
      {id:2,username:'authority1',email:'authority@ecowatch.ma',role:'authority'},
    ]});
  },
};

// Auto-detect backend availability
let _usingDemo = false;
async function detectBackend() {
  try {
    await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    _usingDemo = false;
    console.log('✅ Backend connected');
  } catch {
    _usingDemo = true;
    console.warn('⚠️ Backend offline — running in demo mode');
  }
}

// Exported: transparently uses live or demo
const EcoAPI = new Proxy({}, {
  get(_, key) {
    return (...args) => (_usingDemo ? demoApi : api)[key]?.(...args);
  }
});

window.EcoAPI = EcoAPI;
window._detectBackend = detectBackend;
window._isDemo = () => _usingDemo;
