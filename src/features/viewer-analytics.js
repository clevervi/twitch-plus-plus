/** Contador real de viewers + chatters activos por ventana deslizante. */
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { chatContainer, chatLines, usernameOf, messageText, viewerCount } from '../core/twitch.js';

const chatters = new Map();
let badge = null;
let lastUpdate = 0;

const UPDATE_EVERY = 4000;
const COUNTED_ATTR = 'data-twpp-counted';

function windowMs() {
  const seconds = Number(storeGet('viewerWindow'));
  return (Number.isFinite(seconds) && seconds > 0 ? seconds : 60) * 1000;
}

function warnAt() {
  return Number(storeGet('viewerRatioWarn')) || 80;
}

function dangerAt() {
  const value = Number(storeGet('viewerRatioDanger'));
  return Number.isFinite(value) && value > 0 ? value : 200;
}

function sweep() {
  const container = chatContainer();
  if (!container) return;
  const now = Date.now();
  for (const line of chatLines(container)) {
    if (line.hasAttribute(COUNTED_ATTR)) continue;
    line.setAttribute(COUNTED_ATTR, '1');
    const user = usernameOf(line);
    if (user) chatters.set(user, now);
  }
  const cutoff = now - windowMs();
  for (const [user, ts] of chatters) {
    if (ts < cutoff) chatters.delete(user);
  }
}

function ensureBadge() {
  if (badge && badge.isConnected) return badge;
  const target = document.querySelector(
    'strong[data-a-target="animated-channel-viewers-count"], [data-test-selector="viewer-count"], .channel-info-bar__viewers, span[data-a-target="animated-channel-viewers-count"]',
  );
  if (!target || !target.parentElement) return null;

  const node = document.createElement('span');
  node.className = 'twpp-viewer-badge';
  node.innerHTML =
    '<span class="twpp-viewer-total" title="Viewers según Twitch">—</span>' +
    '<span class="twpp-viewer-chatters" title="Chatters activos">—</span>' +
    '<span class="twpp-viewer-ratio" title="Ratio viewers / chatters">—</span>';
  target.parentElement.insertBefore(node, target.nextSibling);
  badge = node;
  return badge;
}

function format(value) {
  return value === null ? '—' : value.toLocaleString('es-ES');
}

function update() {
  const node = ensureBadge();
  if (!node) return;
  const viewers = viewerCount();
  const active = chatters.size;

  node.querySelector('.twpp-viewer-total').textContent = format(viewers);
  node.querySelector('.twpp-viewer-chatters').textContent = format(active);

  const ratio = node.querySelector('.twpp-viewer-ratio');
  if (viewers && active) {
    const value = viewers / active;
    ratio.textContent = `1:${value.toFixed(1)}`;
    node.classList.toggle('warn', value > warnAt() && value <= dangerAt());
    node.classList.toggle('danger', value > dangerAt());
  } else {
    ratio.textContent = '—';
    node.classList.remove('warn', 'danger');
  }
}

function teardown() {
  badge?.remove();
  badge = null;
  chatters.clear();
}

defineFeature({
  id: 'viewerAnalytics',
  label: 'Contador real + chatters',
  section: 'chat',
  default: false,
  interval: 1500,
  settings: [
    { key: 'viewerWindow', label: 'Ventana de chatters (s)', type: 'number', default: 60, min: 5, max: 600 },
    { key: 'viewerRatioWarn', label: 'Ratio aviso', type: 'number', default: 80, min: 1, max: 10000 },
    { key: 'viewerRatioDanger', label: 'Ratio crítico', type: 'number', default: 200, min: 1, max: 10000 },
  ],
  css: `
    %SCOPE% .twpp-viewer-badge {
      display: inline-flex; align-items: center; gap: 6px;
      margin-left: 8px; padding: 2px 8px;
      background: rgba(145, 71, 255, .15);
      border: 1px solid rgba(145, 71, 255, .4);
      border-radius: 4px; font-size: 11px; font-weight: 600;
      color: #dedee3; vertical-align: middle; line-height: 1.4; white-space: nowrap;
    }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-total { color: #efeff1; }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-chatters { color: #00d4aa; }
    %SCOPE% .twpp-viewer-badge .twpp-viewer-ratio { color: #adadb8; font-weight: 400; }
    %SCOPE% .twpp-viewer-badge.warn .twpp-viewer-ratio { color: #ffb020; }
    %SCOPE% .twpp-viewer-badge.danger .twpp-viewer-ratio { color: #ff5c5c; }
  `,
  tick(now) {
    sweep();
    if (now - lastUpdate < UPDATE_EVERY) return;
    lastUpdate = now;
    update();
  },
  onEnable() {
    chatters.clear();
    lastUpdate = 0;
    setTimeout(update, 400);
  },
  onDisable: teardown,
  onRoute() {
    chatters.clear();
    lastUpdate = 0;
    badge = null;
    document.querySelectorAll(`[${COUNTED_ATTR}]`).forEach(el => {
      el.removeAttribute(COUNTED_ATTR);
    });
  },
});
