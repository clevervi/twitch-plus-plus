import { get as storeGet, onChange, set as storeSet } from './store.js';
import { warn } from './log.js';

const actions = new Map();

const MODIFIERS = {
  alt: 'alt',
  option: 'alt',
  ctrl: 'ctrl',
  control: 'ctrl',
  shift: 'shift',
  meta: 'meta',
  cmd: 'meta',
  command: 'meta',
  super: 'meta',
};

const NAMED_KEYS = new Set([
  'escape', 'enter', 'return', 'space', 'tab', 'backspace', 'delete', 'insert', 'home', 'end',
  'pageup', 'pagedown', 'up', 'down', 'left', 'right', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright',
  'pause', 'printscreen', 'capslock', 'numlock', 'scrolllock', ...Array.from({ length: 12 }, (_, i) => `f${i + 1}`),
]);

/** Una tecla válida: un carácter, un nombre de tecla o F1–F12. */
function isKeyPart(part) {
  if (/^[a-z0-9]$/.test(part)) return true;
  if (NAMED_KEYS.has(part)) return true;
  return /^f([1-9]|1[0-2])$/.test(part);
}

/** `Alt+Shift+P` → {alt:true,shift:true,…,key:'p'} · cualquier basura → null */
function parseKeybind(str) {
  if (typeof str !== 'string' || !str.trim()) return null;
  const parts = String(str)
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length) return null;

  const combo = { alt: false, ctrl: false, shift: false, meta: false, key: '' };
  for (const part of parts) {
    if (MODIFIERS[part]) combo[MODIFIERS[part]] = true;
    else if (isKeyPart(part)) combo.key = part;
    else return null;
  }
  return combo.key ? combo : null;
}

function matchKeybind(combo, event) {
  if (!combo) return false;
  return (
    combo.alt === event.altKey &&
    combo.ctrl === event.ctrlKey &&
    combo.shift === event.shiftKey &&
    combo.meta === event.metaKey &&
    combo.key === String(event.key || '').toLowerCase()
  );
}

function isTypingTarget(target) {
  if (!target || !target.tagName) return false;
  const tag = target.tagName.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true;
}

let comboCache = null;

function buildComboCache() {
  const keybinds = storeGet('keybinds') || {};
  const map = new Map();
  for (const id of actions.keys()) map.set(id, parseKeybind(keybinds[id]));
  return map;
}

function combos() {
  if (!comboCache) comboCache = buildComboCache();
  return comboCache;
}

export function invalidateComboCache() {
  comboCache = null;
}

export function register(id, label, fallback, options = {}) {
  actions.set(id, {
    id,
    label,
    fallback,
    allowWhileTyping: options.allowWhileTyping ?? (id === 'panel'),
  });
  const keybinds = storeGet('keybinds') || {};
  if (typeof keybinds[id] === 'string') return;
  setCombo(id, fallback);
}

export function list() {
  return [...actions.values()];
}

export function comboOf(id) {
  return combos().get(id) || null;
}

export function bindGlobal(run) {
  window.addEventListener(
    'keydown',
    (event) => {
      if (event.repeat) return; // mantener pulsado no debe repetir la acción
      const map = combos();
      for (const action of actions.values()) {
        const combo = map.get(action.id);
        if (!combo) continue;
        if (!matchKeybind(combo, event)) continue;
        if (isTypingTarget(event.target) && !action.allowWhileTyping) continue;
        event.preventDefault?.();
        event.stopPropagation?.();
        run(action.id);
        return;
      }
    },
    true,
  );
}

export function setCombo(id, value) {
  const current = storeGet('keybinds') || {};
  const combo = parseKeybind(value);
  if (value && !combo) {
    warn('atajo inválido, se ignora:', value);
    return false;
  }
  const next = combo ? String(value).trim() : '';
  if (current[id] === next) return true;
  storeSet('keybinds', { ...current, [id]: next });
  invalidateComboCache();
  return true;
}

export function describe(value) {
  return parseKeybind(value) ? String(value).trim() : '—';
}

onChange((key) => {
  if (key === 'keybinds') invalidateComboCache();
});
