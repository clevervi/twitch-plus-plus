/** Resalta los mensajes que te mencionan. */
import { defineFeature } from '../core/registry.js';
import { chatContainer, chatLines, currentUsername, messageText } from '../core/twitch.js';

const seen = new WeakSet();
let username = null;
let pattern = null;

function detectUsername() {
  if (username) return username;
  username = currentUsername();
  if (!username) return null;
  pattern = new RegExp(`@?${username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i');
  return username;
}

function sweep() {
  if (!detectUsername()) return;
  const container = chatContainer();
  if (!container) return;
  for (const line of chatLines(container)) {
    if (seen.has(line)) continue;
    seen.add(line);
    if (pattern.test(messageText(line))) line.classList.add('twpp-mention');
  }
}

function clear() {
  for (const line of document.querySelectorAll('.twpp-mention')) line.classList.remove('twpp-mention');
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
