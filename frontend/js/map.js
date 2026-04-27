// frontend/js/map.js
// Leaflet map initialisation — OpenStreetMap tiles for Ifrane, Morocco

const IFRANE_CENTER = [33.5333, -5.1067];
const IFRANE_ZOOM   = 14;

let _map = null;
let _reportLayer  = null;
let _labelLayer   = null;
let _locationCircle = null;
let _pinPlacementMode = false;
let _draftPin = null;

// Custom DivIcon factory
function makeIcon(type, severity) {
  const cls  = type === 'fire' ? 'fire' : 'wildlife';
  const emoji = type === 'fire'
    ? (severity === 'high' ? '🔥' : severity === 'medium' ? '🔶' : '🔸')
    : '🦌';
  return L.divIcon({
    className: '',
    html: `<div class="eco-marker ${cls}">${emoji}</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -20],
  });
}

function makeLabelIcon(icon) {
  return L.divIcon({
    className: '',
    html: `<div class="eco-marker label">${icon || '📍'}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
    popupAnchor: [0, -16],
  });
}

function makeDraftPinIcon() {
  return L.divIcon({
    className: '',
    html: `<div class="eco-marker draft">&#128205;</div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 34],
    popupAnchor: [0, -34],
  });
}

// Build popup HTML for a report
function buildReportPopup(r, isAuthority) {
  const sev = r.severity ? `<span class="sevbadge sev-${r.severity}" style="margin-bottom:8px;display:inline-block">${r.severity} severity</span><br>` : '';
  const species = r.species ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:4px">🐾 ${r.species}</div>` : '';
  const authBtns = isAuthority ? `
    <button class="mp-btn primary"  onclick="window.EcoMap.updateStatus('${r.report_code}','verified')">✓ Verify</button>
    <button class="mp-btn"          onclick="window.EcoMap.updateStatus('${r.report_code}','resolved')">Resolve</button>
    <button class="mp-btn danger"   onclick="window.EcoMap.updateStatus('${r.report_code}','false')">✗ False</button>
  ` : `<button class="mp-btn primary" onclick="EcoMap.closePopup()">Close</button>`;

  return `<div class="map-popup-inner">
    <div class="mp-title">${r.type==='fire'?'🔥':'🦌'} ${r.description}</div>
    <div class="mp-meta">${r.report_code} · ${timeAgo(r.created_at)} · ${r.reporter_name||'Anonymous'}</div>
    ${sev}${species}
    <div style="font-size:0.75rem;color:var(--text-muted);font-family:var(--font-mono)">
      ${r.latitude.toFixed(5)}° N, ${Math.abs(r.longitude).toFixed(5)}° W
    </div>
    <div class="mp-actions">${authBtns}</div>
  </div>`;
}

// Build popup for map label
function buildLabelPopup(l) {
  return `<div class="map-popup-inner">
    <div class="mp-title">${l.icon} ${l.name}</div>
    <div class="mp-meta" style="text-transform:capitalize">${l.category}</div>
    ${l.description ? `<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px">${l.description}</div>` : ''}
    <div style="font-size:0.72rem;color:var(--text-dim);font-family:var(--font-mono);margin-top:6px">
      ${l.latitude.toFixed(5)}° N, ${Math.abs(l.longitude).toFixed(5)}° W
    </div>
    <div class="mp-actions">
      <button class="mp-btn danger" onclick="window.EcoMap.deleteLabel(${l.id})">Delete label</button>
    </div>
  </div>`;
}

const EcoMap = {
  init() {
    console.log('EcoMap.init() called');
    _map = L.map('map', {
      center: IFRANE_CENTER,
      zoom: IFRANE_ZOOM,
      zoomControl: false,
      attributionControl: true,
    });

    // OpenStreetMap tiles — open source, free
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright" style="color:var(--text-dim)">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(_map);

    // Layer groups
    _reportLayer = L.layerGroup().addTo(_map);
    _labelLayer  = L.layerGroup().addTo(_map);

    // Layer control
    L.control.zoom({ position: 'bottomright' }).addTo(_map);

    // Click to add label (authority mode) or place a report
    _map.on('click', e => {
      if (window._labelPickMode) {
        window._onLabelPick && window._onLabelPick(e.latlng);
      } else if (_pinPlacementMode) {
        window.App?.onMapClick(e.latlng.lat, e.latlng.lng);
        EcoMap.setPinPlacementMode(false);
      }
    });

    // Cursor style for label pick mode and pin placement mode
    _map.on('mousemove', () => {
      _map.getContainer().style.cursor = window._labelPickMode ? 'crosshair' : (_pinPlacementMode ? 'crosshair' : '');
    });

    console.log('EcoMap.init() completed');
    return this;
  },

  renderReports(reports, isAuthority) {
    _reportLayer.clearLayers();
    reports.forEach(r => {
      const marker = L.marker([r.latitude, r.longitude], { icon: makeIcon(r.type, r.severity) });
      marker.bindPopup(buildReportPopup(r, isAuthority), { maxWidth: 260, className: 'eco-popup' });
      marker.on('click', () => window.App?.selectReport(r.report_code));
      _reportLayer.addLayer(marker);
      r._marker = marker; // cache for programmatic open
    });
  },

  renderLabels(labels) {
    _labelLayer.clearLayers();
    labels.forEach(l => {
      const marker = L.marker([l.latitude, l.longitude], { icon: makeLabelIcon(l.icon) });
      marker.bindPopup(buildLabelPopup(l), { maxWidth: 240, className: 'eco-popup' });
      _labelLayer.addLayer(marker);
    });
  },

  flyTo(lat, lon, zoom = 16) {
    _map.flyTo([lat, lon], zoom, { duration: 1.2 });
  },

  showLocation(lat, lon) {
    if (_locationCircle) _map.removeLayer(_locationCircle);
    _locationCircle = L.circle([lat, lon], {
      radius: 50,
      color: '#4ade80',
      fillColor: '#4ade80',
      fillOpacity: 0.2,
      weight: 2,
    }).addTo(_map);
    // 5km ring
    L.circle([lat, lon], {
      radius: 5000,
      color: '#4ade80',
      fill: false,
      weight: 1,
      dashArray: '5 8',
      opacity: 0.3,
    }).addTo(_map);
    this.flyTo(lat, lon, 14);
  },

  openMarker(reportCode, reports) {
    const r = reports.find(x => x.report_code === reportCode);
    if (r?._marker) r._marker.openPopup();
  },

  updateStatus(reportCode, status) {
    window.App?.updateStatus(reportCode, status);
  },

  deleteLabel(id) {
    window.App?.deleteLabel(id);
  },

  closePopup() {
    _map.closePopup();
  },

  setPinPlacementMode(enabled) {
    _pinPlacementMode = enabled;
    if (_map) _map.getContainer().style.cursor = enabled ? 'crosshair' : '';
    const pinBtn = document.getElementById('pinPlacementBtn');
    if (pinBtn) {
      pinBtn.classList.toggle('active', enabled);
    }
  },

  placeDraftPin(lat, lon) {
    this.clearDraftPin();
    _draftPin = L.marker([lat, lon], {
      icon: makeDraftPinIcon(),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(_map);
  },

  clearDraftPin() {
    if (_draftPin && _map) {
      _map.removeLayer(_draftPin);
    }
    _draftPin = null;
  },

  getPinPlacementMode() {
    return _pinPlacementMode;
  },

  invalidate() {
    setTimeout(() => _map?.invalidateSize(), 100);
  },

  getMap() { return _map; },
};

window.EcoMap = EcoMap;
