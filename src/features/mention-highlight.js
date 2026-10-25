/** Resalta los mensajes que te mencionan. */
import { defineFeature } from '../core/registry.js';
import { chatContainer, chatLines, currentUsername, messageText } from '../core/twitch.js';

const CLASS = 'twpp-mention';
const ATTR = 'data-twpp-mention';
let username = null;
let pattern = null;

/**
 * Patrón de mención para un nombre concreto. Es puro para poder reutilizarlo
 * desde el modo concentración sin depender de que esta feature esté activa.
 */
export function buildMentionPattern(name) {
  const value = String(name || '').trim();
  if (!value) return null;
  const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-zA-Z0-9_])@?${escaped}(?:[^a-zA-Z0-9_]|$)`, 'i');
}

function detectUsername() {
  if (username) return username;
  username = currentUsername();
  if (!username) return null;
  pattern = buildMentionPattern(username);
  return username;
}

// La clase ES el estado: si el usuario se detecta tarde o cambia de cuenta,
// los mensajes ya marcados se reevalúan solos.
function sweep() {
  if (!detectUsername()) return;
  const container = chatContainer();
  if (!container) return;
  for (const line of chatLines(container)) {
    if (line.hasAttribute(ATTR)) continue;
    line.setAttribute(ATTR, '1');
    if (pattern.test(messageText(line))) line.classList.add(CLASS);
  }
}

// Se buscan los DOS marcadores, no solo los que tienen la clase. Con
// `.twpp-mention` como único criterio, los nodos que ya tenían el atributo
// puesto pero no llegaron a resaltarse se quedaban marcados para siempre: en el
// siguiente sweep() la línea se saltaba por tener el atributo y no se reevaluaba
// nunca más.
function clear() {
  for (const line of document.querySelectorAll(`.${CLASS}, [${ATTR}]`)) {
    line.classList.remove(CLASS);
    line.removeAttribute(ATTR);
  }
}

defineFeature({
  id: 'mentionHighlight',
  label: 'Resaltar menciones',
  section: 'chat',
  default: false,
  interval: 700,
  css: `
    %SCOPE% .twpp-mention {
      background: rgba(145, 71, 255, .18) !important;
      border-left: 3px solid #9147ff !important;
      padding-left: 6px !important;
    }
  `,
  tick: sweep,
  onEnable() {
    username = null;
    pattern = null;
    sweep();
  },
  onDisable: clear,
  onRoute() {
    username = null;
    pattern = null;
    clear();
  },
});
