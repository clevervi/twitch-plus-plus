/** Modo concentración: deja solo las menciones y las palabras clave. */
import { anotarMotivo, defineFeature, limpiarMotivo } from '../core/registry.js';
import { get as storeGet, onChange } from '../core/store.js';
import {
  chatContainer,
  chatLines,
  currentUsername,
  messageText,
  usernameOf,
} from '../core/twitch.js';
import { buildMatcher } from './chat-keywords.js';
import { buildMentionPattern } from './mention-highlight.js';

const ID = 'chatFocus';
const HIDE = 'twpp-focus-hidden';
const DIM = 'twpp-focus-dim';
const ATTR = 'data-twpp-focus';

let username = null;
let mention = null;
let stop = null;

/**
 * Una línea se queda si te menciona o si contiene alguna palabra clave. Sin
 * ningún criterio se queda todo: ocultar el chat entero por no haber
 * configurado nada sería peor que no hacer nada.
 */
export function isRelevant(text, mention, matcher) {
  if (!mention && !matcher) return true;
  if (mention?.test(text)) return true;
  if (matcher instanceof RegExp ? matcher.test(text) : matcher?.(text)) return true;
  return false;
}

function clear() {
  for (const line of document.querySelectorAll(`.${HIDE}, .${DIM}, [${ATTR}]`)) {
    line.classList.remove(HIDE, DIM);
    line.removeAttribute(ATTR);
  }
}

function sweep() {
  const actual = currentUsername();
  if (actual !== username) {
    username = actual;
    mention = buildMentionPattern(actual);
    clear();
  }

  const matcher = buildMatcher();
  if (!mention && !matcher) {
    anotarMotivo(ID, 'sin menciones ni palabras clave que buscar');
    clear();
    return;
  }

  const container = chatContainer();
  if (!container) {
    anotarMotivo(ID, 'chat no disponible en esta pagina');
    return;
  }
  limpiarMotivo(ID);

  const mode = storeGet('chatFocusMode') === 'dim' ? 'dim' : 'hide';
  const mark = mode === 'dim' ? DIM : HIDE;
  const other = mode === 'dim' ? HIDE : DIM;
  for (const line of chatLines(container)) {
    if (line.hasAttribute(ATTR)) continue;
    line.setAttribute(ATTR, '1');
    // Tus propios mensajes se quedan: ocultarlos haría dudar de si se enviaron.
    if (username && usernameOf(line) === username.toLowerCase()) continue;
    if (isRelevant(messageText(line), mention, matcher)) continue;
    line.classList.remove(other);
    line.classList.add(mark);
  }
}

defineFeature({
  id: ID,
  label: 'Modo concentración',
  section: 'chat',
  default: false,
  interval: 700,
  settings: [
    {
      key: 'chatFocusMode',
      label: 'Qué hacer con el resto',
      type: 'select',
      options: [['hide', 'Ocultar'], ['dim', 'Atenuar']],
      default: 'hide',
    },
    {
      key: 'chatKeywords',
      label: 'Palabras clave (separadas por coma)',
      type: 'text',
      placeholder: 'hola, clip, raid',
    },
    { key: 'chatKeywordRegex', label: 'Tratar como regex', type: 'bool', default: false },
  ],
  css: `
    %SCOPE% .twpp-focus-hidden {
      display: none !important;
    }
    %SCOPE% .twpp-focus-dim {
      opacity: .2 !important;
    }
  `,
  tick: sweep,
  onEnable() {
    username = null;
    mention = null;
    clear();
    stop = onChange((key) => {
      if (key !== 'chatKeywords' && key !== 'chatKeywordRegex' && key !== 'chatFocusMode') return;
      clear();
      sweep();
    });
    sweep();
  },
  onDisable() {
    stop?.();
    stop = null;
    username = null;
    mention = null;
    limpiarMotivo(ID);
    clear();
  },
  onRoute() {
    username = null;
    mention = null;
    clear();
  },
});
