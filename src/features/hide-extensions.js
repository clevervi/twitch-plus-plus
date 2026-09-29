/**
 * Sin extensiones.
 *
 * El CSS se encarga de los casos conocidos. La parte JS cubre lo que Twitch
 * renderiza dinámicamente (iframes y overlays de extensiones) y, de forma
 * opt-in, los botones desconocidos del player mediante una allowlist de iconos
 * que se puede ampliar sin tocar código.
 */
import { qsAll } from '../core/dom.js';
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';
import { get as storeGet } from '../core/store.js';

const EXTENSION_HINT = /extension|ext-twitch|\/extensions\/|extension-panel|twitch-ext-/i;

const KNOWN_PLAYER_ICONS =
  /Icon-(Settings|Gear|Volume|Fullscreen|Theater|Pause|Play|Mute|Unmute|Rewind|Forward|Quality|Clip|Share|Subscribe|Follow|Bits|Prime|Notifications|Messages|Search|Menu|Close|Chevron|Arrow|Drops|Points|Reward|Emote|Mod|Chat|Crown|Heart|Rerun|Pin|Mute-User|Bit|Hype|Extension|Collapse|Expand|Info|Rec|Resume|Exit)/i;

const known = new Set();
const removed = new Set();

function kill(element) {
  if (!element || removed.has(element)) return;
  removed.add(element);
  element.style.setProperty('display', 'none', 'important');
}

function restore() {
  for (const node of removed) {
    node.style?.removeProperty('display');
  }
  removed.clear();
}

function extensionLike(element) {
  const hay = [
    element.getAttribute?.('src') || '',
    element.getAttribute?.('id') || '',
    element.getAttribute?.('title') || '',
    element.getAttribute?.('class') || '',
    element.getAttribute?.('data-test-selector') || '',
  ]
    .join(' ')
    .toLowerCase();
  return EXTENSION_HINT.test(hay);
}

function playerOverlaySweep() {
  for (const player of selectAll('player')) {
    for (const frame of qsAll('iframe', player)) {
      if (extensionLike(frame)) kill(frame);
    }
    for (const box of qsAll('div', player)) {
      if (!/overlay/.test(box.className || '')) continue;
      if (!box.querySelector('iframe')) continue;
      kill(box);
    }
  }
}

function unknownButtonSweep() {
  const extra = String(storeGet('extensionExtras') || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  for (const player of selectAll('player')) {
    for (const button of qsAll('button', player)) {
      if (removed.has(button)) continue;
      const svg = button.querySelector('svg');
      const signature = (svg?.getAttribute('class') || '').match(/\bIcon-[A-Za-z0-9_-]+\b/);
      if (!signature) continue;
      if (KNOWN_PLAYER_ICONS.test(signature[0])) continue;
      if (extra.some((needle) => signature[0].toLowerCase().includes(needle.toLowerCase()))) {
        kill(button);
        continue;
      }
      if (known.has(signature[0])) {
        kill(button);
        continue;
      }
      known.add(signature[0]);
      log('icono nuevo en el player (oculto por heurística):', signature[0]);
    }
  }
}

defineFeature({
  id: 'hideExtensions',
  label: 'Sin extensiones',
  section: 'clean',
  default: true,
  interval: 1500,
  settings: [
    { key: 'extensionHeuristic', label: 'Ocultar botones desconocidos del player', type: 'bool', default: true },
    { key: 'extensionExtras', label: 'Iconos extra a ocultar (separados por coma)', type: 'text', placeholder: 'Icon-Promo, Icon-Quest' },
  ],
  css: `
    %SCOPE% button.Navigation__open,
    %SCOPE% [class*="Navigation__open"],
    %SCOPE% button[data-a-target="extensions-button"],
    %SCOPE% button[data-test-selector="extensions-button"],
    %SCOPE% [data-a-target="extensions-button"],
    %SCOPE% [data-test-selector="extensions-button"],
    %SCOPE% [aria-label*="Extension" i],
    %SCOPE% [aria-label*="extensión" i],
    %SCOPE% [data-a-target="extensions-menu"],
    %SCOPE% [data-test-selector="extensions-menu"],
    %SCOPE% [data-test-selector="extensions-panel"],
    %SCOPE% [data-a-target="extensions-panel"],
    %SCOPE% [data-test-selector="extension-panel"],
    %SCOPE% [data-a-target="extension-panel"],
    %SCOPE% [data-a-target="video-extension-overlay"],
    %SCOPE% [data-test-selector="video-extension-overlay"],
    %SCOPE% [data-a-target="extension-overlay"],
    %SCOPE% [data-test-selector="extension-overlay"],
    %SCOPE% [data-a-target="extension-view"],
    %SCOPE% [data-test-selector="extension-view"],
    %SCOPE% .video-extension-overlay,
    %SCOPE% .extension-overlay,
    %SCOPE% .extensions-overlay,
    %SCOPE% .extension-view,
    %SCOPE% [class*="video-extension"],
    %SCOPE% [class*="extension-overlay"],
    %SCOPE% [class*="extensions-overlay"],
    %SCOPE% [class*="ExtensionOverlay"],
    %SCOPE% [class*="extension-view"],
    %SCOPE% [data-test-selector="extension-component"],
    %SCOPE% [data-a-target="extension-component"],
    %SCOPE% [class*="extension-component"],
    %SCOPE% [id^="twitch-ext-"],
    %SCOPE% [id*="extension-iframe"],
    %SCOPE% [id*="extension-overlay"],
    %SCOPE% iframe[src*="extension"],
    %SCOPE% iframe[src*="ext-twitch"],
    %SCOPE% iframe[src*="/extensions/"],
    %SCOPE% iframe[id*="extension"],
    %SCOPE% iframe[id^="twitch-ext-"],
    %SCOPE% iframe[title*="Extension" i],
    %SCOPE% iframe[data-test-selector*="extension"],
    %SCOPE% [data-test-selector="extension-banner"],
    %SCOPE% [data-a-target="extension-banner"],
    %SCOPE% .extension-banner,
    %SCOPE% [data-test-selector="extension-slot"],
    %SCOPE% [class*="extensions-dock"],
    %SCOPE% [class*="extension-dock"] { display: none !important; }
  `,
  tick() {
    playerOverlaySweep();
    if (storeGet('extensionHeuristic')) unknownButtonSweep();
  },
  onDisable: restore,
});
