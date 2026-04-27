// frontend/js/app.js
// EcoWatch — Main application controller
// Orchestrates API, Map, UI state, and panels

const App = (() => {
  // ── State ─────────────────────────────────────────────────────
  let state = {
    reports:       [],
    labels:        [],
    stats:         {},
    alerts:        [],
    role:          'civilian',   // 'civilian' | 'authority'
    filterType:    'all',
    filterTime:    '24h',
    filterStatus:  'all',
    dashFilterType:'all',
    dashFilterStatus:'all',
    selectedReport: null,
    panelMode:     null,         // 'report' | 'label'
    reportType:    'wildlife',
    severity:      null,
    labelCategory: null,
    labelCoords:   null,
    view:          'map',        // 'map' | 'dashboard'
    userLat:       null,
    userLon:       null,
    imageBase64:   null,         // NEW: Store base64 image
  };

  // ── Init ──────────────────────────────────────────────────────
  async function init() {
    await window._detectBackend();
    bindEvents();
    EcoMap.init();
    await refresh();
    hideLoading();
    updateConnStatus();
    setInterval(refresh, 30000); // poll every 30s
  }

  async function refresh() {
    await Promise.all([loadReports(), loadLabels(), loadStats(), loadAlerts()]);
    renderSidebar();
    renderDash();
    updateAlertBadge();
  }

  // ── Map click handler: place pin and open report form ─────────
  function onMapClick(lat, lon) {
    console.log('onMapClick called with:', lat, lon);
    state.severity = null;
    state.userLat = lat;
    state.userLon = lon;
    document.getElementById('locInput').value = `${lat.toFixed(5)}° N, ${Math.abs(lon).toFixed(5)}° W`;
    openReportPanel();
    setReportLocation(lat, lon);
    EcoMap.placeDraftPin(lat, lon);
    showToast('Report pin placed. Choose a type and submit the report.', 'ok');
  }

  function setReportLocation(lat, lon) {
    const degree = String.fromCharCode(176);
    state.userLat = lat;
    state.userLon = lon;
    document.getElementById('locInput').value = `${lat.toFixed(5)}${degree} N, ${Math.abs(lon).toFixed(5)}${degree} W`;
  }

  async function loadReports() {
    const params = { type: state.filterType, range: state.filterTime };
    const res = await EcoAPI.getReports(params);
    state.reports = res.data;
    EcoMap.renderReports(state.reports, state.role === 'authority');
    updateStatPills();
  }

  async function loadLabels() {
    const res = await EcoAPI.getLabels();
    state.labels = res.data;
    EcoMap.renderLabels(state.labels);
  }

  async function loadStats() {
    const res = await EcoAPI.getStats();
    state.stats = res.data;
  }

  async function loadAlerts() {
    const res = await EcoAPI.getAlerts();
    state.alerts = res.data;
  }

  // ── Render: Sidebar ───────────────────────────────────────────
  function renderSidebar() {
    const list = document.getElementById('reportList');
    let reports = [...state.reports];

    // Apply status filter if set
    if (state.filterStatus !== 'all') reports = reports.filter(r => r.status === state.filterStatus);
    reports.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (!reports.length) {
      list.innerHTML = `<div class="empty"><div class="ei">🔍</div><p>No reports match filters.</p></div>`;
      return;
    }

    list.innerHTML = reports.map(r => `
      <div class="rcard ${r.type} ${state.selectedReport === r.report_code ? 'selected' : ''}"
           onclick="App.selectReport('${r.report_code}')">
        <div class="rcard-top">
          <div class="rcard-type">
            ${r.type === 'fire' ? '🔥' : '🦌'}
            <span>${r.type === 'fire' ? 'Fire' : 'Wildlife'}</span>
            ${r.severity ? `<span class="sevbadge ${sevClass(r.severity)}">${r.severity}</span>` : ''}
          </div>
          <span class="sbadge ${statusClass(r.status)}">${r.status}</span>
        </div>
        <div class="rcard-desc">${r.description}</div>
        <div class="rcard-meta">
          <span>${r.report_code}</span>
          <span>⏱ ${timeAgo(r.created_at)}</span>
        </div>
      </div>
    `).join('');
  }

  // ── Render: Dashboard ─────────────────────────────────────────
  function renderDash() {
    const s = state.stats;
    document.getElementById('dashKPIs').innerHTML = `
      <div class="kpi">
        <div class="kpi-icon" style="background:rgba(74,222,128,0.1)">📋</div>
        <div><div class="kpi-num">${s.total||0}</div><div class="kpi-label">Total Reports</div></div>
      </div>
      <div class="kpi">
        <div class="kpi-icon" style="background:rgba(251,146,60,0.1)">🔥</div>
        <div><div class="kpi-num" style="color:var(--orange)">${s.fire||0}</div><div class="kpi-label">Fire Incidents</div></div>
      </div>
      <div class="kpi">
        <div class="kpi-icon" style="background:rgba(74,222,128,0.1)">🦌</div>
        <div><div class="kpi-num" style="color:var(--green)">${s.wildlife||0}</div><div class="kpi-label">Wildlife Sightings</div></div>
      </div>
      <div class="kpi">
        <div class="kpi-icon" style="background:rgba(248,113,113,0.1)">⚠️</div>
        <div><div class="kpi-num" style="color:var(--red)">${s.high||0}</div><div class="kpi-label">High Severity Active</div></div>
      </div>
    `;

    let rows = [...state.reports];
    if (state.dashFilterType !== 'all')   rows = rows.filter(r => r.type   === state.dashFilterType);
    if (state.dashFilterStatus !== 'all') rows = rows.filter(r => r.status === state.dashFilterStatus);
    rows.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('dashTableBody');
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty"><div class="ei">📭</div><p>No reports.</p></td></tr>`;
      return;
    }

    tbody.innerHTML = rows.map(r => `
      <tr>
        <td><span class="id-code" style="cursor:pointer" title="Click to view details" onclick="App.viewReportDetail('${r.report_code}')">${r.report_code}</span></td>
        <td style="display:flex;align-items:center;gap:6px;padding-top:12px">${r.type==='fire'?'🔥':'🦌'} <span style="font-weight:500">${r.type}</span></td>
        <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.description}">${r.description}</td>
        <td><span class="loc-text">${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}</span></td>
        <td>${r.severity ? `<span class="sevbadge ${sevClass(r.severity)}">${r.severity}</span>` : '<span style="color:var(--text-dim)">—</span>'}</td>
        <td><span class="sbadge ${statusClass(r.status)}">${r.status}</span></td>
        <td><span class="ts-text">${timeAgo(r.created_at)}</span></td>
        <td style="display:flex;gap:6px">
          <select class="act-select" onchange="App.updateStatus('${r.report_code}', this.value); this.value='${r.status}'" style="flex:1">
            <option value="${r.status}" selected>${r.status}</option>
            ${['new','verified','resolved','false'].filter(s=>s!==r.status).map(s=>`<option value="${s}">${s}</option>`).join('')}
          </select>
          <button class="act-btn del" onclick="App.deleteReport('${r.report_code}', event)" title="Delete report" style="padding:4px 8px;background:#f87171;color:#fff;border:none;border-radius:3px;font-size:0.75rem;cursor:pointer;white-space:nowrap">🗑 Delete</button>
        </td>
      </tr>
    `).join('');
  }

  // ── UI Updates ────────────────────────────────────────────────
  function updateStatPills() {
    const fire = state.reports.filter(r => r.type === 'fire').length;
    const wild = state.reports.filter(r => r.type === 'wildlife').length;
    document.getElementById('fireCount').textContent = fire;
    document.getElementById('wildCount').textContent = wild;
  }

  function updateAlertBadge() {
    const unack = state.alerts.filter(a => !a.acknowledged).length;
    const badge = document.getElementById('alertBadge');
    const strip = document.getElementById('alertStrip');
    badge.textContent = unack;
    badge.style.display = unack ? 'flex' : 'none';
    if (unack && state.view === 'map') {
      strip.classList.add('visible');
      const a = state.alerts.find(x => !x.acknowledged);
      if (a) {
        document.getElementById('alertText').textContent = a.description || a.message || 'Active high-severity incident';
      }
    } else {
      strip.classList.remove('visible');
    }
  }

  function updateConnStatus() {
    const dot  = document.getElementById('connDot');
    const text = document.getElementById('connText');
    const demo = window._isDemo();
    dot.className  = `conn-dot ${demo ? 'err' : 'ok'}`;
    text.textContent = demo ? 'Demo mode — backend offline' : 'Live — connected to backend';
  }

  function hideLoading() {
    const el = document.getElementById('loadingOverlay');
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 500);
  }

  // ── Actions ───────────────────────────────────────────────────
  function selectReport(code) {
    state.selectedReport = code;
    const r = state.reports.find(x => x.report_code === code);
    if (r) {
      EcoMap.flyTo(r.latitude, r.longitude, 16);
      EcoMap.openMarker(code, state.reports);
    }
    renderSidebar();
  }

  async function updateStatus(code, status) {
    try {
      await EcoAPI.updateStatus(code, status);
      showToast(`${code} marked as ${status}`, 'ok');
      await refresh();
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  async function deleteLabel(id) {
    try {
      await EcoAPI.deleteLabel(id);
      showToast('Map label removed', 'ok');
      EcoMap.getMap().closePopup();
      await loadLabels();
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  async function deleteReport(code, event) {
    event?.stopPropagation();
    if (!confirm(`Delete report ${code}? This action cannot be undone.`)) return;
    try {
      await EcoAPI.deleteReport(code);
      showToast(`${code} deleted`, 'ok');
      await refresh();
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  function viewReportDetail(code) {
    const r = state.reports.find(x => x.report_code === code);
    if (!r) return;
    const modal = document.getElementById('detailModal') || createDetailModal();
    const img = r.image_url ? `<img src="${r.image_url}" style="max-width:100%;max-height:300px;border-radius:var(--r-sm);margin:12px 0">` : '';
    modal.querySelector('.detail-content').innerHTML = `
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:16px">
          <div>
            <h3 style="margin:0 0 4px 0;font-size:1.2rem">${r.type==='fire'?'🔥':'🦌'} ${r.description}</h3>
            <div style="color:var(--text-muted);font-size:0.85rem">${r.report_code} · ${timeAgo(r.created_at)}</div>
          </div>
          <button onclick="App.closeDetail()" style="background:none;border:none;font-size:1.5rem;cursor:pointer">✕</button>
        </div>
        ${img}
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px">
          <div><span style="color:var(--text-muted);font-size:0.8rem">Location</span><br>${r.latitude.toFixed(5)}° N, ${Math.abs(r.longitude).toFixed(5)}° W</div>
          <div><span style="color:var(--text-muted);font-size:0.8rem">Status</span><br><span class="sbadge ${statusClass(r.status)}">${r.status}</span></div>
          ${r.severity ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Severity</span><br><span class="sevbadge sev-${r.severity}">${r.severity}</span></div>` : ''}
          ${r.species ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Species</span><br>${r.species}</div>` : ''}
          <div><span style="color:var(--text-muted);font-size:0.8rem">Reporter</span><br>${r.reporter_name || 'Anonymous'}</div>
          ${r.verified_at ? `<div><span style="color:var(--text-muted);font-size:0.8rem">Verified</span><br>${r.verifier_name || 'Admin'}<br><span style="font-size:0.75rem">${timeAgo(r.verified_at)}</span></div>` : ''}
        </div>
        ${r.status_comment ? `<div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:var(--r-sm)"><span style="color:var(--text-muted);font-size:0.8rem">Comment</span><br>${r.status_comment}</div>` : ''}
      </div>
    `;
    modal.classList.add('visible');
  }

  function closeDetail() {
    const modal = document.getElementById('detailModal');
    if (modal) modal.classList.remove('visible');
  }

  function createDetailModal() {
    const modal = document.createElement('div');
    modal.id = 'detailModal';
    modal.className = 'detail-modal';
    modal.innerHTML = `
      <div class="detail-content" style="max-height:80vh;overflow-y:auto;background:#fff;border-radius:var(--r);box-shadow:0 20px 60px rgba(0,0,0,0.2)"></div>
    `;
    modal.onclick = (e) => { if (e.target === modal) closeDetail(); };
    document.body.appendChild(modal);
    const style = document.createElement('style');
    style.textContent = `
      .detail-modal { display:none; position:fixed; inset:0; background:rgba(0,0,0,0.5); z-index:9999; align-items:center; justify-content:center; padding:20px; }
      .detail-modal.visible { display:flex; }
    `;
    document.head.appendChild(style);
    return modal;
  }

  // ── Panel ─────────────────────────────────────────────────────
  function openReportPanel(type = null) {
    console.log('openReportPanel called with type:', type);
    state.panelMode = 'report';
    state.reportType = type;
    state.severity = null;
    document.getElementById('panelTitle').textContent = 'Submit Report';
    if (type) {
      selectType(type);
    } else {
      // Don't pre-select, let user choose
      document.getElementById('typeWild').className = 'type-card';
      document.getElementById('typeFire').className = 'type-card';
      document.getElementById('speciesRow').style.display = 'none';
      document.getElementById('severityRow').style.display = 'none';
      const btn = document.getElementById('submitReportBtn');
      btn.className = 'submit-btn';
      btn.textContent = 'Submit Report';
    }
    resetForm();
    openPanel();
  }

  function openLabelPanel() {
    state.panelMode = 'label';
    document.getElementById('panelTitle').textContent = '📍 Add Map Label';
    document.getElementById('reportPanelBody').style.display  = 'none';
    document.getElementById('labelPanelBody').style.display   = 'block';
    resetLabelForm();
    openPanel();
  }

  function openPanel() {
    document.getElementById('backdrop').classList.add('open');
    document.getElementById('sidePanel').classList.add('open');
    if (state.panelMode === 'report') {
      document.getElementById('reportPanelBody').style.display = 'block';
      document.getElementById('labelPanelBody').style.display  = 'none';
    }
  }

  function closePanel() {
    document.getElementById('backdrop').classList.remove('open');
    document.getElementById('sidePanel').classList.remove('open');
    window._labelPickMode = false;
    state.labelCoords = null;
    EcoMap.clearDraftPin();
  }

  // ── Report form ───────────────────────────────────────────────
  function selectType(type) {
    state.reportType = type;
    const wc = document.getElementById('typeWild');
    const fc = document.getElementById('typeFire');
    wc.className = 'type-card' + (type === 'wildlife' ? ' sel-wild' : '');
    fc.className = 'type-card' + (type === 'fire'     ? ' sel-fire' : '');
    document.getElementById('speciesRow').style.display  = type === 'wildlife' ? 'block' : 'none';
    document.getElementById('severityRow').style.display = type === 'fire'     ? 'block' : 'none';
    const btn = document.getElementById('submitReportBtn');
    btn.className = 'submit-btn ' + (type === 'fire' ? 'fire' : 'wild');
    btn.textContent = type === 'fire' ? '🔥 Submit Fire Report' : '🦌 Submit Wildlife Report';
    state.severity = null;
    document.querySelectorAll('.sev-btn').forEach(b => b.className = 'sev-btn');
  }

  function setSeverity(sev, el) {
    state.severity = sev;
    document.querySelectorAll('.sev-btn').forEach(b => b.className = 'sev-btn');
    el.className = `sev-btn on-${sev}`;
  }

  function resetForm() {
    document.getElementById('locInput').value = '';
    document.getElementById('descInput').value = '';
    document.getElementById('speciesInput').value = '';
    document.getElementById('uploadText').textContent = 'Tap to upload photo';
    document.getElementById('uploadIcon').textContent = '📷';
    document.getElementById('fileInput').value = '';
    state.userLat = null;
    state.userLon = null;
    state.imageBase64 = null;
  }

  async function getLocation() {
    if (!navigator.geolocation) { showToast('Geolocation not supported', 'err'); return; }
    // Simulate Ifrane coords with small noise (demo)
    const lat = 33.5333 + (Math.random() - 0.5) * 0.04;
    const lon = -5.1067 + (Math.random() - 0.5) * 0.06;
    state.userLat = lat;
    state.userLon = lon;
    document.getElementById('locInput').value = `${lat.toFixed(5)}° N, ${Math.abs(lon).toFixed(5)}° W`;
    setReportLocation(lat, lon);
    EcoMap.showLocation(lat, lon);
    showToast('📍 GPS location detected', 'ok');
  }

  async function submitReport() {
    const desc    = document.getElementById('descInput').value.trim();
    const locRaw  = document.getElementById('locInput').value;
    const species = document.getElementById('speciesInput')?.value || null;

    if (!state.reportType) { showToast('Please select a report type', 'err'); return; }
    if (!locRaw || state.userLat == null || state.userLon == null)  { showToast('Please detect GPS location or place a map pin first', 'err'); return; }
    if (!desc || desc.length < 5) { showToast('Description too short', 'err'); return; }
    if (state.reportType === 'fire' && !state.severity) { showToast('Select a severity level', 'err'); return; }

    // Parse coords from string like "33.54221° N, 5.12345° W"
    const latMatch = locRaw.match(/([\d.]+)°\s*N/);
    const lonMatch = locRaw.match(/([\d.]+)°\s*W/);
    if (!latMatch || !lonMatch) { /* location state remains the source of truth */ }
    const lat = state.userLat;
    const lon = state.userLon;

    const btn = document.getElementById('submitReportBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Submitting…';

    try {
      const res = await EcoAPI.createReport({
        type:        state.reportType,
        description: desc,
        latitude:    lat,
        longitude:   lon,
        severity:    state.severity,
        species:     species || null,
        image_url:   state.imageBase64 || null,
        reporter_id: 1,
      });

      if (state.reportType === 'fire' && state.severity === 'high') {
        showToast('🚨 HIGH SEVERITY — Authorities alerted!', 'warn');
      } else {
        showToast('✅ Report submitted successfully!', 'ok');
      }
      closePanel();
      await refresh();
    } catch (e) {
      showToast(e.message, 'err');
    } finally {
      btn.disabled = false;
      selectType(state.reportType);
    }
  }

  // ── Image handling ────────────────────────────────────────────
  function startReportPinPlacement() {
    const enabled = !EcoMap.getPinPlacementMode();
    EcoMap.setPinPlacementMode(enabled);
    if (enabled) {
      showToast('Click the map to place a report pin', 'ok');
    } else {
      EcoMap.clearDraftPin();
      showToast('Report pin placement cancelled', 'warn');
    }
  }

  function handleImageUpload(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'err');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast('Image too large (max 5MB)', 'err');
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.imageBase64 = e.target.result;
      document.getElementById('uploadIcon').textContent = '✅';
      document.getElementById('uploadText').textContent = file.name;
    };
    reader.readAsDataURL(file);
  }

  // ── Label form ────────────────────────────────────────────────
  function resetLabelForm() {
    document.getElementById('labelName').value = '';
    document.getElementById('labelDesc').value = '';
    document.getElementById('labelCoordDisplay').textContent = '— click map to pick location —';
    state.labelCategory = null;
    state.labelCoords   = null;
    document.querySelectorAll('.lcat-btn').forEach(b => b.classList.remove('on'));
  }

  function setLabelCategory(cat, el) {
    state.labelCategory = cat;
    document.querySelectorAll('.lcat-btn').forEach(b => b.classList.remove('on'));
    el.classList.add('on');
  }

  function pickLabelLocation() {
    window._labelPickMode = true;
    window._onLabelPick = (latlng) => {
      state.labelCoords = latlng;
      document.getElementById('labelCoordDisplay').textContent = `${latlng.lat.toFixed(5)}° N, ${Math.abs(latlng.lng).toFixed(5)}° W`;
      window._labelPickMode = false;
      showToast('Location picked on map', 'ok');
    };
    closePanel();
    showToast('Click on the map to pick label location', 'ok');
  }

  async function submitLabel() {
    const name = document.getElementById('labelName').value.trim();
    const desc = document.getElementById('labelDesc').value.trim();
    const icons = { city:'🏙', forest:'🌲', lake:'💧', road:'🛣', landmark:'📌', zone:'🚫' };

    if (!name) { showToast('Enter a label name', 'err'); return; }
    if (!state.labelCategory) { showToast('Select a category', 'err'); return; }
    if (!state.labelCoords) { showToast('Pick a location on the map', 'err'); return; }

    try {
      await EcoAPI.createLabel({
        name,
        category:  state.labelCategory,
        latitude:  state.labelCoords.lat,
        longitude: state.labelCoords.lng,
        description: desc,
        icon:      icons[state.labelCategory] || '📍',
      });
      showToast(`Label "${name}" added`, 'ok');
      closePanel();
      await loadLabels();
    } catch (e) {
      showToast(e.message, 'err');
    }
  }

  // ── View switching ────────────────────────────────────────────
  function switchView(view) {
    state.view = view;
    document.querySelectorAll('.top-nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelector(`[data-view="${view}"]`).classList.add('active');
    document.getElementById('mapViewEl').classList.toggle('active', view === 'map');
    document.getElementById('dashViewEl').classList.toggle('active', view === 'dashboard');
    if (view === 'map') EcoMap.invalidate();
    updateAlertBadge();
  }

  // ── Role toggle ───────────────────────────────────────────────
  function toggleRole() {
    state.role = state.role === 'civilian' ? 'authority' : 'civilian';
    const btn = document.getElementById('roleToggle');
    btn.className = `role-toggle ${state.role}`;
    btn.innerHTML = `<span class="role-dot ${state.role}"></span>${state.role === 'authority' ? '🛡 Authority' : '👤 Civilian'}`;
    const addLabel = document.getElementById('addLabelBtn');
    if (addLabel) addLabel.style.display = state.role === 'authority' ? 'flex' : 'none';
    showToast(`Switched to ${state.role} mode`, 'ok');
    EcoMap.renderReports(state.reports, state.role === 'authority');
  }

  // ── Filters ───────────────────────────────────────────────────
  function setTypeFilter(type, el) {
    state.filterType = type;
    document.querySelectorAll('.fchip').forEach(c => c.className = 'fchip');
    el.className = `fchip on-${type}`;
    loadReports().then(renderSidebar);
  }

  function setTimeFilter(time, el) {
    state.filterTime = time;
    document.querySelectorAll('.tchip').forEach(c => c.classList.remove('on'));
    el.classList.add('on');
    loadReports().then(renderSidebar);
  }

  function setDashFilter(type) {
    state.dashFilterType = type;
    renderDash();
  }

  function setDashStatusFilter(status) {
    state.dashFilterStatus = status;
    renderDash();
  }

  // ── Nearby ────────────────────────────────────────────────────
  async function showNearby() {
    const lat = state.userLat || 33.5333;
    const lon = state.userLon || -5.1067;
    const nearby = state.reports.filter(r => distanceKm(lat, lon, r.latitude, r.longitude) <= 5);
    showToast(`📍 ${nearby.length} reports within 5km`, 'ok');
    EcoMap.showLocation(lat, lon);
  }

  // ── Event binding ─────────────────────────────────────────────
  function bindEvents() {
    // Exposed to HTML onclick
    window.App = {
      selectReport, updateStatus, deleteLabel, deleteReport,
      openReportPanel, openLabelPanel, closePanel,
      selectType, setSeverity, getLocation, submitReport, handleImageUpload,
      setLabelCategory, pickLabelLocation, submitLabel,
      switchView, toggleRole,
      setTypeFilter, setTimeFilter, setDashFilter, setDashStatusFilter,
      showNearby,
      viewReportDetail, closeDetail,
      onMapClick, startReportPinPlacement,
    };

    const pinButton = document.getElementById('pinPlacementBtn');
    if (pinButton) pinButton.onclick = startReportPinPlacement;
  }

  return {
    init,
    selectReport, updateStatus, deleteLabel, deleteReport,
    openReportPanel, openLabelPanel, closePanel,
    selectType, setSeverity, getLocation, submitReport, handleImageUpload,
    setLabelCategory, pickLabelLocation, submitLabel,
    switchView, toggleRole,
    setTypeFilter, setTimeFilter, setDashFilter, setDashStatusFilter,
    showNearby, startReportPinPlacement,
    viewReportDetail, closeDetail,
    onMapClick,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());
