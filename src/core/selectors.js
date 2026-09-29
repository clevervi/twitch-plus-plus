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
  'chat.input': ['.chat-input__textarea-container textarea', '.chat-input textarea', '[data-a-target="chat-input"] textarea'],
  'sideNav.root': ['[data-a-target="side-nav-bar"]', '.side-nav', '[data-test-selector="side-nav"]'],
  'sideNav.card': ['[data-a-target="side-nav-card"]', '.side-nav-card'],
  'sideNav.group': ['nav .tw-transition-group', '.side-nav__section'],
  'sideNav.more': ['[data-a-target="side-nav-more"]', '.side-nav__more'],
  'sideNav.link': ['[data-a-target="side-nav-link"]', '.side-nav-card__link'],
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
    '.claimable-bonus__icon',
    '[data-test-selector="claimable-bonus-icon"]',
  ],
  'pauseChat': [
    'button[aria-label="Pause Chat"]',
    'button[aria-label="Pausar chat"]',
    '[data-test-selector="chat-pause-button"]',
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

function list(key) {
  const entry = state.get(key);
  if (!entry) return [];
  return entry.remote.concat(entry.local);
}

export function candidates(key) {
  return list(key);
}

export function select(key, root = document) {
  for (const selector of list(key)) {
    try {
      const found = root.querySelector(selector);
      if (found) return found;
    } catch {
      /* candidato inválido: se ignora */
    }
  }
  return null;
}

export function selectAll(key, root = document) {
  const out = [];
  for (const selector of list(key)) {
    try {
      const found = root.querySelectorAll(selector);
      if (found && found.length) return Array.from(found);
    } catch {
      /* ignorar */
    }
  }
  return out;
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
