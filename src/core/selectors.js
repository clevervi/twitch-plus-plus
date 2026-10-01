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
  'sideNav.group': ['[data-a-target="side-nav-bar"] .tw-transition-group', '.side-nav .tw-transition-group', '.side-nav__section'],
  'sideNav.more': [
    '[data-a-target="side-nav-more"]',
    'button[data-a-target="side-nav-show-more-button"]',
    'button[data-a-target="side-nav-more-toggle"]',
    '[data-test-selector="ShowMore"] button',
    'button[data-test-selector="ShowMore"]',
    '.side-nav__more',
    'button.side-nav-show-more',
    'button[aria-label*="más" i]',
    'button[aria-label*="more" i]',
  ],
  'sideNav.link': [
    '[data-a-target="side-nav-link"]',
    '[data-a-target="side-nav-card-link"]',
    'a[data-test-selector="followed-channel"]',
    'a[data-test-selector="recommended-channel"]',
    'a.side-nav-card__link',
    '.side-nav-card a',
    '.side-nav a[href^="/"]',
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
    'button:has([data-test-selector="claimable-bonus-icon"])',
    'button:has(.claimable-bonus__icon)',
    '[data-a-target="community-points-summary"] button[aria-label*="Bonus" i]',
    '[data-test-selector="community-points-summary"] button[aria-label*="Bonus" i]',
    '[data-a-target="community-points-summary"] button[aria-label*="bonificación" i]',
    '[data-test-selector="community-points-summary"] button[aria-label*="bonificación" i]',
    '.claimable-bonus__icon',
    '[data-test-selector="claimable-bonus-icon"]',
  ],
  'pauseChat': [
    'button[data-a-target="chat-pause-button"]',
    '[data-test-selector="chat-pause-button"]',
    'button[aria-label*="pause chat" i]',
    'button[aria-label*="pausar chat" i]',
    'button[aria-label*="reanudar chat" i]',
    'button[aria-label*="resume chat" i]',
    '[data-a-target="chat-pause-indicator"] button',
    '.chat-paused-footer button',
  ],
  'upNext': ['[data-a-target="up-next-queue"]', '.up-next-queue', '[data-test-selector="up-next-queue"]', '[class*="up-next-queue"]'],
  'stories': ['[data-a-target="stories-tray"]', '.stories-tray', '[data-test-selector="stories-tray"]', '[class*="stories-tray"]'],
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

export function select(key, root = document, { track = true } = {}) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelector(selector);
      if (found) {
        if (track) note(key, selector);
        return found;
      }
    } catch {
      /* candidato inválido: se ignora */
    }
  }
  if (track) note(key, null);
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

const TOO_BROAD = [
  /^\*$/,                          // universal
  /^[a-z]+$/i,                     // solo un tag: button, div, span, a
  /^\[[a-z-]+\]$/i,                // solo un atributo: [class], [id], [href]
  /^\.\w+$/,                       // una sola clase sin contexto: .foo
  /^#\w+$/,                        // un solo id sin contexto: #bar
  /^[a-z]+\s*>\s*\*$/i,            // button > * , div > *
  /^[a-z]+\s+\*$/i,                // button * , div *
];

function isTooBroad(selector) {
  const s = selector.trim();
  if (s.length < 6) return true;   // demasiado corto para ser específico
  for (const re of TOO_BROAD) if (re.test(s)) return true;
  return false;
}

export function isValidSelector(selector) {
  if (typeof selector !== 'string') return false;
  const s = selector.trim();
  if (!s || s.length > MAX_LENGTH) return false;
  if (FORBIDDEN.test(s)) return false;
  if (isTooBroad(s)) return false;
  return true;
}

/** Aplica selectores remotos. Devuelve cuántos se aceptaron y cuáles se rechazaron. */
export function applyRemote(map) {
  const applied = [];
  const rejected = [];
  const rejectedBroad = [];
  if (!map || typeof map !== 'object') return { applied, rejected, rejectedBroad };

  for (const [key, raw] of Object.entries(map)) {
    const entry = state.get(key);
    if (!entry) {
      rejected.push(key);
      continue;
    }
    const items = Array.isArray(raw) ? raw : [raw];
    const incoming = items.filter(isValidSelector);
    const broad = items.filter((s) => typeof s === 'string' && !FORBIDDEN.test(s) && isTooBroad(s));

    if (!incoming.length) {
      rejected.push(key);
      if (broad.length) rejectedBroad.push(`${key}: ${broad.join(', ')}`);
      continue;
    }
    entry.remote = incoming.slice(0, MAX_CANDIDATES);
    applied.push(key);
  }

  if (applied.length) log('selectores remotos aplicados:', applied.join(', '));
  if (rejected.length) warn('selectores remotos rechazados:', rejected.join(', '));
  if (rejectedBroad.length) warn('selectores remotos demasiado amplios:', rejectedBroad.join(' | '));
  return { applied, rejected, rejectedBroad };
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
    const matched = select(key, root, { track: false });
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
