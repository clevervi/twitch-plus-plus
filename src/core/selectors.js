/**
 * Registro central de selectores.
 *
 * Cada clave tiene una lista de candidatos: se prueban en orden hasta que uno
 * funciona. El catálogo remoto del repo puede anteponer candidatos nuevos
 * (los fixes de la comunidad entran sin publicar una release del script) y el
 * fallback local sigue funcionando si el repo no responde o algo se rompe.
 */
import { log, warn } from './log.js';

const BASE = {
  'chat.container': [
    '[data-test-selector="chat-scrollable-area__message-container"]',
    '.chat-scrollable-area__message-container',
  ],
  'chat.line': ['[data-a-target="chat-line-message"]', '.chat-line__message'],
  'chat.username': ['.chat-line__username', '[data-a-target="chat-message-username"]'],
  'chat.input': [
    '[data-a-target="chat-input"]',
    'div[contenteditable="true"][data-a-target="chat-input"]',
    '.chat-input__textarea-container textarea',
    '.chat-input textarea',
    '.chat-input__textarea [contenteditable="true"]',
    '[data-a-target="chat-input"] textarea',
  ],
  'sideNav.root': ['[data-a-target="side-nav-bar"]', '.side-nav', '[data-test-selector="side-nav"]'],
  'sideNav.card': ['[data-a-target="side-nav-card"]', '.side-nav-card'],
  'sideNav.group': ['nav .tw-transition-group', '.side-nav__section'],
  'sideNav.more': [
    '[data-a-target="side-nav-more"]',
    'button[data-a-target="side-nav-show-more-button"]',
    '[data-test-selector="ShowMore"] button',
    '.side-nav__more',
    'button.side-nav-show-more',
  ],
  'sideNav.link': [
    '[data-a-target="side-nav-link"]',
    'a[data-test-selector="followed-channel"]',
    'a[data-test-selector="recommended-channel"]',
    'a.side-nav-card__link',
  ],
  'player': ['[data-a-target="video-player"]', '.video-player', '.persistent-player'],
  'topNav': ['[data-a-target="top-nav-container"]', '.top-nav'],
  'viewerCount': [
    'strong[data-a-target="animated-channel-viewers-count"]',
    '[data-test-selector="viewer-count"]',
    '.channel-info-bar__viewers',
  ],
  'channelPoints': [
    '[data-test-selector="community-points-summary"]',
    '.community-points-summary',
    '[data-a-target="community-points-summary"]',
  ],
  'claimBonus': [
    'button[aria-label="Claim Bonus"]',
    'button[aria-label="Reclamar bonificación"]',
    '.claimable-bonus__icon',
    '[data-test-selector="claimable-bonus-icon"]',
  ],
  'pauseChat': [
    'button[data-a-target="chat-pause-button"]',
    '[data-test-selector="chat-pause-button"]',
    'button[aria-label="Pause Chat"]',
    'button[aria-label="Pausar chat"]',
  ],
  'upNext': ['[data-a-target="up-next-queue"]', '.up-next-queue', '[data-test-selector="up-next-queue"]'],
  'stories': ['[data-a-target="stories-tray"]', '.stories-tray', '[data-test-selector="stories-tray"]'],
  'userMenu': ['[data-a-target="user-menu-toggle"]', '[data-a-target="user-menu-button"]'],
};

const MAX_CANDIDATES = 8;
const MAX_LENGTH = 300;
const FORBIDDEN = /[{};@]|url\(|expression\(|javascript:|\\|\/\*/i;

const state = new Map();
for (const [key, list] of Object.entries(BASE)) state.set(key, { local: list, remote: [] });

/** Salud por clave: cuál candidato sigue funcionando y cuánto falla. */
const health = new Map();

function list(key) {
  const entry = state.get(key);
  if (!entry) return [];
  return entry.remote.concat(entry.local);
}

function note(key, matched) {
  let entry = health.get(key);
  if (!entry) {
    entry = { hits: 0, misses: 0, ok: null, matched: null, lastHitAt: 0, lastMissAt: 0 };
    health.set(key, entry);
  }
  const hit = !!matched;
  if (entry.ok === hit) {
    if (hit) entry.matched = matched;
    return;
  }
  const now = Date.now();
  if (hit) {
    entry.hits += 1;
    entry.lastHitAt = now;
    entry.matched = matched;
  } else {
    entry.misses += 1;
    entry.lastMissAt = now;
  }
  entry.ok = hit;
}

export function candidates(key) {
  return list(key);
}

export function select(key, root = document) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelector(selector);
      if (found) {
        note(key, selector);
        return found;
      }
    } catch {
      /* candidato inválido: se ignora */
    }
  }
  note(key, null);
  return null;
}

export function selectAll(key, root = document) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelectorAll(selector);
      if (found && found.length) {
        note(key, selector);
        return Array.from(found);
      }
    } catch {
      /* ignorar */
    }
  }
  note(key, null);
  return [];
}

export function isValidSelector(selector) {
  return (
    typeof selector === 'string' &&
    selector.trim().length > 0 &&
    selector.length <= MAX_LENGTH &&
    !FORBIDDEN.test(selector)
  );
}

/** Aplica selectores remotos. Devuelve cuántos se aceptaron y cuáles se rechazaron. */
export function applyRemote(map) {
  const applied = [];
  const rejected = [];
  if (!map || typeof map !== 'object') return { applied, rejected };

  for (const [key, raw] of Object.entries(map)) {
    const entry = state.get(key);
    if (!entry) {
      rejected.push(key);
      continue;
    }
    const incoming = (Array.isArray(raw) ? raw : [raw]).filter(isValidSelector);
    if (!incoming.length) {
      rejected.push(key);
      continue;
    }
    entry.remote = incoming.slice(0, MAX_CANDIDATES);
    applied.push(key);
  }

  if (applied.length) log('selectores remotos aplicados:', applied.join(', '));
  if (rejected.length) warn('selectores remotos rechazados:', rejected.join(', '));
  return { applied, rejected };
}

export function clearRemote() {
  for (const entry of state.values()) entry.remote = [];
}

export function snapshot() {
  const out = {};
  for (const [key, entry] of state) out[key] = list(key);
  return out;
}

/**
 * Estado de todas las claves: qué selector sigue funcionando y cuáles han
 * dejado de existir. Es el dato que dice "qué se rompió" sin adivinar.
 */
export function selectorReport(root = document) {
  return [...state.keys()].map((key) => {
    const matched = select(key, root);
    const stats = health.get(key) || { hits: 0, misses: 0 };
    return {
      key,
      ok: !!matched,
      matched: stats.matched,
      total: list(key).length,
      remote: state.get(key).remote.length,
      misses: stats.misses,
    };
  });
}

export function brokenSelectors(root = document) {
  return selectorReport(root).filter((row) => !row.ok);
}

export function resetHealth() {
  health.clear();
}
