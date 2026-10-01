/** Buscador dentro del chat: filtra, cuenta y permite saltar entre coincidencias. */
import { qs } from '../core/dom.js';
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { chatContainer, chatLines, messageText } from '../core/twitch.js';

let bar = null;
let matches = [];
let cursor = -1;

function clearMarks() {
  for (const line of document.querySelectorAll('.twpp-chat-hidden, .twpp-chat-dim, .twpp-chat-match, .twpp-chat-current')) {
    line.classList.remove('twpp-chat-hidden', 'twpp-chat-dim', 'twpp-chat-match', 'twpp-chat-current');
  }
  matches = [];
  cursor = -1;
  updateCounter();
}

function updateCounter() {
  if (!bar) return;
  const counter = qs('.twpp-search-count', bar);
  if (!counter) return;
  const total = matches.length;
  counter.textContent = total ? `${cursor + 1}/${total}` : '';
}

function jump(step) {
  if (!matches.length) return;
  cursor = (cursor + step + matches.length) % matches.length;
  for (const line of matches) line.classList.remove('twpp-chat-current');
  const target = matches[cursor];
  target.classList.add('twpp-chat-current');
  target.scrollIntoView({ block: 'center' });
  updateCounter();
}

function buildMatcher(query) {
  if (storeGet('chatSearchRegex')) {
    try {
      return new RegExp(query, 'i');
    } catch {
      return query.toLowerCase();
    }
  }
  return query.toLowerCase();
}

function apply() {
  const input = qs('.twpp-search-input', bar);
  if (!input) return;
  const raw = input.value.trim();
  clearMarks();
  if (!raw) return;

  const container = chatContainer();
  if (!container) return;

  const mode = storeGet('chatSearchMode') === 'dim' ? 'dim' : 'hide';
  const match = buildMatcher(raw);
  const lines = chatLines(container);

  for (const line of lines) {
    const hit = match instanceof RegExp ? match.test(messageText(line)) : messageText(line).toLowerCase().includes(match);
    if (!hit) {
      line.classList.add(mode === 'dim' ? 'twpp-chat-dim' : 'twpp-chat-hidden');
      continue;
    }
    line.classList.add('twpp-chat-match');
    matches.push(line);
  }
  updateCounter();
  if (matches.length) jump(0);
}

function ensureUI() {
  if (bar && bar.isConnected) return bar;
  const container = chatContainer();
  const parent = container?.parentElement;
  if (!parent) return null;

  const node = document.createElement('div');
  node.className = 'twpp-search';
  node.innerHTML =
    '<input class="twpp-search-input" type="text" placeholder="Buscar en el chat…" spellcheck="false" autocomplete="off">' +
    '<span class="twpp-search-count"></span>' +
    '<button class="twpp-search-prev" title="Anterior">↑</button>' +
    '<button class="twpp-search-next" title="Siguiente">↓</button>' +
    '<button class="twpp-search-clear" title="Limpiar">✕</button>';

  parent.insertBefore(node, parent.firstChild);

  const input = qs('.twpp-search-input', node);
  input.addEventListener('input', apply);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      input.value = '';
      apply();
      input.blur();
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      jump(event.shiftKey ? -1 : 1);
    }
  });
  qs('.twpp-search-clear', node).addEventListener('click', () => {
    input.value = '';
    apply();
    input.focus();
  });
  qs('.twpp-search-next', node).addEventListener('click', () => jump(1));
  qs('.twpp-search-prev', node).addEventListener('click', () => jump(-1));

  bar = node;
  return bar;
}

function destroy() {
  clearMarks();
  bar?.remove();
  bar = null;
  document.querySelectorAll('.twpp-search').forEach((el) => el.remove());
}

defineFeature({
  id: 'chatSearch',
  label: 'Buscador de chat',
  section: 'chat',
  default: false,
  interval: 1200,
  settings: [
    { key: 'chatSearchMode', label: 'Modo', type: 'select', options: [['hide', 'Ocultar no coincidencias'], ['dim', 'Atenuar']], default: 'hide' },
    { key: 'chatSearchRegex', label: 'Expresión regular', type: 'bool', default: false },
  ],
  css: `
    %SCOPE% .twpp-search {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 8px; background: #0e0e0e; border-bottom: 1px solid #1b1b1b;
    }
    %SCOPE% .twpp-search-input {
      flex: 1; min-width: 0; padding: 5px 8px;
      background: #060606; color: #efeff1;
      border: 1px solid #2a2a2d; border-radius: 6px;
      font-size: 12px; outline: none; font-family: inherit;
    }
    %SCOPE% .twpp-search-input:focus { border-color: #9147ff; }
    %SCOPE% .twpp-search-count {
      font-size: 11px; color: #adadb8;
      font-variant-numeric: tabular-nums; min-width: 38px; text-align: right;
    }
    %SCOPE% .twpp-search button {
      background: transparent; color: #adadb8; border: none; cursor: pointer;
      padding: 2px 6px; font-size: 12px; border-radius: 4px; line-height: 1;
    }
    %SCOPE% .twpp-search button:hover { background: #1f1f23; color: #efeff1; }
    %SCOPE% .twpp-chat-hidden { display: none !important; }
    %SCOPE% .twpp-chat-dim { opacity: .2 !important; }
    %SCOPE% .twpp-chat-match {
      background: rgba(0, 212, 170, .12) !important;
      border-left: 2px solid #00d4aa !important;
      padding-left: 4px !important;
    }
    %SCOPE% .twpp-chat-current { box-shadow: inset 2px 0 0 #00d4aa !important; }
  `,
  tick() {
    if (!ensureUI()) return;
    const input = qs('.twpp-search-input', bar);
    if (input && input.value.trim()) apply();
  },
  onDisable: destroy,
  onRoute: destroy,
});
