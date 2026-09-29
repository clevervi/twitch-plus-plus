/** Resalta los mensajes que te mencionan. */
import { defineFeature } from '../core/registry.js';
import { chatContainer, chatLines, currentUsername, messageText } from '../core/twitch.js';

const CLASS = 'twpp-mention';
let username = null;
let pattern = null;

function detectUsername() {
  if (username) return username;
  username = currentUsername();
  if (!username) return null;
  pattern = new RegExp(`@?${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  return username;
}

// La clase ES el estado: si el usuario se detecta tarde o cambia de cuenta,
// los mensajes ya marcados se reevalúan solos.
function sweep() {
  if (!detectUsername()) return;
  const container = chatContainer();
  if (!container) return;
  for (const line of chatLines(container)) {
    if (line.classList.contains(CLASS)) continue;
    if (pattern.test(messageText(line))) line.classList.add(CLASS);
  }
}

function clear() {
  for (const line of document.querySelectorAll(`.${CLASS}`)) line.classList.remove(CLASS);
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
  },
});
