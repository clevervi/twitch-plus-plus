/** Utilidades específicas de Twitch: nombres de canal, miniaturas, tooltips, contadores. */
import { qs, qsAll, isVisible } from './dom.js';
import { select, selectAll } from './selectors.js';

const CDN = 'https://static-cdn.jtvnw.net/previews-ttv';
const RESERVED = new Set([
  'directory', 'settings', 'subscriptions', 'inventory', 'wallet', 'drops', 'u', 'downloads',
  'friends', 'search', 'turbo', 'subscriptions', 'p', 'store', 'prime', 'signup', 'login',
]);

export function channelFromHref(href) {
  if (!href || !href.startsWith('/') || href.startsWith('//')) return null;
  const first = href.split(/[/?#]/).filter(Boolean)[0];
  if (!first || RESERVED.has(first.toLowerCase())) return null;
  return decodeURIComponent(first).toLowerCase();
}

export function channelFromCard(card) {
  const link = card && (qs('a[href^="/"]', card) || qs('[data-a-target="side-nav-link"]', card));
  return channelFromHref(link ? link.getAttribute('href') : null);
}

export function visibleChannels(limit = 8) {
  const out = [];
  const seen = new Set();
  for (const link of qsAll('nav a[href^="/"]')) {
    const channel = channelFromHref(link.getAttribute('href'));
    if (!channel || seen.has(channel)) continue;
    seen.add(channel);
    out.push(channel);
    if (out.length >= limit) break;
  }
  return out;
}

export function thumbnailUrl(channel, width = 440) {
  const size = width <= 220 ? '220x248' : width >= 720 ? '720x405' : '440x248';
  return `${CDN}/live_user_${channel}-${size}.jpg`;
}

export function currentChannel() {
  return (location.pathname.match(/^\/([^/]+)/) || [])[1] || '';
}

/** Diálogo de hover que Twitch abre al pasar por una card de la sidebar. */
export function hoverDialog() {
  const layers = qsAll('.tw-dialog-layer, [role="dialog"]');
  for (const layer of layers) {
    if (layer.offsetParent === null && layer !== document.body) continue;
    if (isVisible(layer)) return layer;
  }
  return null;
}

export async function waitForHoverDialog(timeout = 1200) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const dialog = hoverDialog();
    if (dialog) return dialog;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  return null;
}

/** Nombre de usuario del usuario conectado (para menciones). */
export function currentUsername() {
  const toggle = select('userMenu');
  if (!toggle) return null;
  const img = qs('img', toggle);
  if (img && img.alt) return img.alt.trim();
  const label = toggle.getAttribute('aria-label') || '';
  const match = label.match(/^(.+?)['’]s\s+user\s+menu/i) || label.match(/^User menu\s*[-–]\s*(.+)/i);
  return match ? match[1].trim() : null;
}

export function usernameOf(message) {
  const node = qs('.chat-line__username, [data-a-target="chat-message-username"]', message);
  const text = node ? (node.textContent || '').trim() : '';
  return text ? text.toLowerCase() : null;
}

export function chatLines(root = document) {
  return selectAll('chat.line', root);
}

export function chatContainer() {
  return select('chat.container');
}

export function messageText(message) {
  const body = qs('.chat-line__message, [data-a-target="chat-line-message-body"]', message);
  return (body ? body.textContent : message.textContent) || '';
}

/** Contador de viewers parseado a número (soporta 1,2 K / 12,3 mil). */
export function viewerCount() {
  const node = select('viewerCount');
  if (!node) return null;
  const text = (node.textContent || '').trim();
  const mil = /k|mil|\sK\b/i.test(text);
  const digits = text.replace(/[^\d]/g, '');
  if (!digits) return null;
  const value = parseInt(digits, 10);
  return mil ? value * 1000 : value;
}
