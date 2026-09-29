/** Resalta mensajes que contienen palabras clave (por defecto o regex). */
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { chatContainer, chatLines, messageText } from '../core/twitch.js';

const seen = new WeakSet();
let cache = { key: '', matcher: null };

function keywords() {
  return String(storeGet('chatKeywords') || '')
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function buildMatcher() {
  const key = keywords().join('\u0000');
  if (key === cache.key) return cache.matcher;
  cache = { key, matcher: null };
  if (!key) return null;

  if (storeGet('chatKeywordRegex')) {
    try {
      cache.matcher = new RegExp(key.replace(/[\\]/g, '\\\\').replace(/[|\n]/g, '|'), 'i');
    } catch {
      cache.matcher = null;
    }
    return cache.matcher;
  }

  const needles = keywords().map((word) => word.toLowerCase());
  cache.matcher = (text) => {
    const lower = text.toLowerCase();
    return needles.some((needle) => lower.includes(needle));
  };
  return cache.matcher;
}

function clear() {
  for (const line of document.querySelectorAll('.twpp-keyword')) line.classList.remove('twpp-keyword');
}

function sweep() {
  const match = buildMatcher();
  if (!match) {
    clear();
    return;
  }
  const container = chatContainer();
  if (!container) return;

  for (const line of chatLines(container)) {
    if (seen.has(line)) continue;
    seen.add(line);
    const text = messageText(line);
    const hit = match instanceof RegExp ? match.test(text) : match(text);
    if (hit) line.classList.add('twpp-keyword');
  }
}

defineFeature({
  id: 'chatKeywordHighlight',
  label: 'Resaltar palabras clave',
  section: 'chat',
  default: false,
  interval: 600,
  settings: [
    { key: 'chatKeywords', label: 'Palabras (separadas por coma)', type: 'text', placeholder: 'hola, clip, raid' },
    { key: 'chatKeywordRegex', label: 'Tratar como regex', type: 'bool', default: false },
  ],
  css: `
    %SCOPE% .twpp-keyword {
      background: rgba(255, 176, 32, .14) !important;
      border-left: 2px solid #ffb020 !important;
      padding-left: 4px !important;
    }
  `,
  tick: sweep,
  onEnable() {
    cache = { key: '', matcher: null };
    sweep();
  },
  onDisable: clear,
  onRoute() {
    cache = { key: '', matcher: null };
    clear();
  },
});
