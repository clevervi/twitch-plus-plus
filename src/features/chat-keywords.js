/** Resalta mensajes que contienen palabras clave (por defecto o regex). */
import { defineFeature } from '../core/registry.js';
import { warn } from '../core/log.js';
import { compilarSeguro } from '../core/regex.js';
import { get as storeGet, onChange } from '../core/store.js';
import { chatContainer, chatLines, messageText } from '../core/twitch.js';

const CLASS = 'twpp-keyword';
let cache = { key: '', matcher: null };
let stop = null;

function keywords() {
  return String(storeGet('chatKeywords') || '')
    .split(/[,\n]/)
    .map((word) => word.trim())
    .filter(Boolean);
}

export function buildMatcher() {
  const list = keywords();
  // Separador escapado, no un NUL literal: un byte 0 en el fuente hace que
  // herramientas como grep o los visores traten el archivo como binario.
  const key = `${list.join('\u0000')}|${storeGet('chatKeywordRegex') ? 're' : 'plain'}`;
  if (key === cache.key) return cache.matcher;
  cache = { key, matcher: null };
  if (!list.length) return null;

  if (storeGet('chatKeywordRegex')) {
    // Las palabras se unen con `|`, así que un usuario que escriba `(a+)+$`
    // construye un patrón catastrófico sin querer. Pasa por el mismo
    // comprobador que el buscador: el corte va antes de compilar.
    const unido = list.map((word) => word.replace(/[\\|]/g, (char) => `\\${char}`)).join('|');
    const { regex, rechazado } = compilarSeguro(unido);
    if (rechazado) warn('palabras clave rechazadas:', rechazado);
    cache.matcher = regex;
    return cache.matcher;
  }

  const needles = list.map((word) => word.toLowerCase());
  cache.matcher = (text) => {
    const lower = text.toLowerCase();
    return needles.some((needle) => lower.includes(needle));
  };
  return cache.matcher;
}

const ATTR = 'data-twpp-kw';

function clear() {
  for (const line of document.querySelectorAll(`.${CLASS}, [${ATTR}]`)) {
    line.classList.remove(CLASS);
    line.removeAttribute(ATTR);
  }
}

// La clase y atributo ES el estado, y la caché de keywords se invalida al cambiarlas:
// editar la lista reevalúa los mensajes que ya están en pantalla.
function sweep() {
  const match = buildMatcher();
  if (!match) {
    clear();
    return;
  }
  const container = chatContainer();
  if (!container) return;

  for (const line of chatLines(container)) {
    if (line.classList.contains(CLASS) || line.hasAttribute(ATTR)) continue;
    line.setAttribute(ATTR, '1');
    const text = messageText(line);
    const hit = match instanceof RegExp ? match.test(text) : match(text);
    if (hit) line.classList.add(CLASS);
  }
}

defineFeature({
  id: 'chatKeywordHighlight',
  label: 'Resaltar palabras clave',
  section: 'chat',
  default: false,
  interval: 1000,
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
    clear();
    stop = onChange((key) => {
      if (key !== 'chatKeywords' && key !== 'chatKeywordRegex') return;
      cache = { key: '', matcher: null };
      clear();
      sweep();
    });
    sweep();
  },
  onDisable() {
    stop?.();
    stop = null;
    cache = { key: '', matcher: null };
    clear();
  },
  onRoute() {
    cache = { key: '', matcher: null };
  },
});
