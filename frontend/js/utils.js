// frontend/js/utils.js
// Shared helpers used across the app

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr);
  if (diff < 60000)    return 'Just now';
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function statusClass(s) {
  return { new: 's-new', verified: 's-verified', resolved: 's-resolved', false: 's-false' }[s] || 's-new';
}

function sevClass(s) {
  return { high: 'sev-high', medium: 'sev-medium', low: 'sev-low' }[s] || '';
}

function showToast(msg, type = 'ok') {
  const c = document.getElementById('toastWrap');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { ok: '✅', err: '❌', warn: '🚨' };
  t.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => {
    t.style.opacity = '0';
    t.style.transition = 'opacity 0.3s';
    setTimeout(() => t.remove(), 300);
  }, 3500);
}

function formatCoords(lat, lon) {
  return `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? 'E' : 'W'}`;
}

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

window.timeAgo = timeAgo;
window.statusClass = statusClass;
window.sevClass = sevClass;
window.showToast = showToast;
window.formatCoords = formatCoords;
window.distanceKm = distanceKm;
