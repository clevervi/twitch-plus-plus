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
  const first = href.split(/[\/?​#]/).filter(Boolean)[0];
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

export function thumbnailUrl(channel, width = 320) {
  const user = String(channel || '').trim().toLowerCase();
  const w = Math.max(160, Math.min(1280, Math.round(Number(width) || 320)));
  const h = Math.round((w * 9) / 16);
  return `${CDN}/live_user_${user}-${w}x${h}.jpg`;
}

export function currentChannel() {
  return (location.pathname.match(/^\/([^\/]+)/) || [])[1] || '';
}

/**
 * ¿Twitch está en tema oscuro? Primero la clase que Twitch usa y, si no está,
 * se deduce del color de fondo real (sirve para cuando cambian el marcado).
 */
export function isDarkTheme() {
  if (document.documentElement.classList.contains('tw-root--theme-dark')) return true;
  if (document.body?.classList.contains('tw-root--theme-dark')) return true;
  if (qs('.tw-root--theme-dark')) return true;

  const style = getComputedStyle(document.body || document.documentElement);
  const color = style?.backgroundColor || style?.color || '';
  const [r, g, b] = (String(color).match(/[\d.]+/g) || []).map(Number);
  if ([r, g, b].length < 3 || [r, g, b].some(Number.isNaN)) return true;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

export function hoverDialog() {
  // 1. Selector directo para el tooltip moderno de la sidebar de Twitch
  const tooltipBody = qs('.online-side-nav-channel-tooltip__body, [class*="online-side-nav-channel-tooltip"]');
  if (tooltipBody && tooltipBody.isConnected) {
    return tooltipBody.closest('[tabindex="0"], .tw-dialog-layer, [role="dialog"], [role="tooltip"]') || tooltipBody.parentElement || tooltipBody;
  }

  // 2. Globos y capas de diálogo estándar
  const layers = qsAll('.tw-balloon, [data-a-target="tw-balloon"], [role="tooltip"], .tw-dialog-layer, [role="dialog"]');
  for (const layer of layers) {
    if (layer.offsetParent === null && layer !== document.body) continue;
    if (isVisible(layer)) return layer;
  }
  return null;
}

export async function waitForHoverDialog(timeout = 800) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const dialog = hoverDialog();
    if (dialog) return dialog;
    await new Promise((resolve) => setTimeout(resolve, 30));
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
  const match = label.match(/^(.+?)[''\u2019]s\s+user\s+menu/i) || label.match(/^User menu\s*[-–]\s*(.+)/i);
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

/**
 * Contador de viewers parseado a número.
 * Soporta: "1.2K", "12.3K", "1.2M", "1,2 mil", "1.234", etc.
 */
export function viewerCount() {
  const node = select('viewerCount');
  if (!node) return null;
  const text = (node.textContent || '').trim();
  return parseViewerText(text);
}

/**
 * Parsea texto de viewers con multiplicadores (K, M, mil).
 * Maneja separadores decimales y de miles correctamente.
 */
export function parseViewerText(txt) {
  if (!txt) return null;

  const t = txt.toLowerCase().replace(/\s+/g, '');
  const m = t.match(/^([\d.,]+)\s*(mil|k|m|b)?$/);
  if (!m) return null;

  let num = m[1];
  const suf = m[2] || '';

  // Decidir si coma/punto es decimal o miles
  const lastComma = num.lastIndexOf(',');
  const lastDot = num.lastIndexOf('.');

  if (lastComma > -1 && lastDot > -1) {
    // Ambos presentes: la última ocurrencia es el decimal
    if (lastComma > lastDot) {
      num = num.replace(/\./g, '').replace(',', '.');
    } else {
      num = num.replace(/,/g, '');
    }
  } else if (lastComma > -1) {
    // Solo coma: si son 3 dígitos después, es miles; si no, es decimal
    const after = num.length - lastComma - 1;
    if (after === 3) num = num.replace(/,/g, '');
    else num = num.replace(',', '.');
  } else if (lastDot > -1) {
    // Solo punto: si son 3 dígitos después y hay más números, es miles
    const after = num.length - lastDot - 1;
    if (after === 3 && num.length > 4) num = num.replace(/\./g, '');
  }

  const base = parseFloat(num);
  if (!isFinite(base)) return null;

  const mult = { mil: 1e3, k: 1e3, m: 1e6, b: 1e9 }[suf] || 1;
  return Math.round(base * mult);
}
