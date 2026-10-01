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
// Solo iconos claramente de extensión. Sin Overlay/Component genéricos.
const EXTENSION_ICON_HINT = /Icon-(Extension|Extensions|Puzzle|Plugin|Addon|Apps)/i;

const KNOWN_PLAYER_ICONS = new RegExp(
  'Icon-(Settings|Gear|Volume|Fullscreen|Theater|Pause|Play|Mute|Unmute|Rewind|Forward|' +
    'Quality|Clip|Share|Subscribe|Follow|Bits|Prime|Notifications|Messages|Search|Menu|Close|' +
    'Chevron|Arrow|Drops|Points|Reward|Emote|Mod|Chat|Crown|Heart|Rerun|Pin|Mute-User|Bit|' +
    'Hype|Extension|Collapse|Expand|Info|Rec|Resume|Exit|Picture|PictureInPicture|Pip|RewindLive|' +
    'PlaybackSettings|Live|Cast|Airplay|Subtitles|CC|Audio|AudioOnly|AudioTrack|Accessibility|Studio)',
  'i',
);

const SAFE_BUTTON_LABEL =
  /pantalla|fullscreen|teatro|theater|volumen|volume|silenciar|mute|pausa|pause|reproducir|play|ajustes|settings|calidad|quality|clip|compartir|share|subt[ií]tulos|captions|audio|pip|directo|live|accesibilidad|accessibility/i;

const known = new Set();
const removed = new WeakSet();
const removedRefs = new Set();

function kill(element) {
  if (!element || removed.has(element)) return;
  removed.add(element);
  removedRefs.add(element);
  element.style.setProperty('display', 'none', 'important');
  element.style.setProperty('pointer-events', 'none', 'important');
}

function restore() {
  for (const node of removedRefs) {
    if (!node?.isConnected) continue;
    node.style?.removeProperty('display');
    node.style?.removeProperty('pointer-events');
  }
  removedRefs.clear();
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
    // 1) iframes de extensión dentro del player
    for (const frame of qsAll('iframe', player)) {
      if (extensionLike(frame)) kill(frame);
    }

    // 2) Overlays de extensión SOLO con clases específicas.
    //    Ya NO usamos div[class*="overlay"] porque matchea los overlays
    //    legítimos del player (controles de pausa, settings, etc.).
    const overlaySelectors = [
      '.extension-container',
      '.extension-view',
      '[class*="extension-overlay"]',
      '[class*="extensions-overlay"]',
      '[class*="video-extension"]',
      '[data-test-selector="extension-overlay"]',
      '[data-a-target="extension-overlay"]',
      '[data-test-selector="video-extension-overlay"]',
      '[data-a-target="video-extension-overlay"]',
    ];
    for (const box of qsAll(overlaySelectors.join(','), player)) {
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
      const label = (button.getAttribute('aria-label') || button.getAttribute('title') || '').trim();
      if (SAFE_BUTTON_LABEL.test(label)) continue;
      const svg = button.querySelector('svg');
      const signature = (svg?.getAttribute('class') || '').match(/\bIcon-[A-Za-z0-9_-]+\b/);
      if (!signature) continue;
      if (KNOWN_PLAYER_ICONS.test(signature[0])) continue;

      if (extra.some((needle) => signature[0].toLowerCase().includes(needle.toLowerCase()))) {
        kill(button);
        continue;
      }

      if (EXTENSION_ICON_HINT.test(signature[0])) {
        kill(button);
        continue;
      }

      // Iconos desconocidos pero que no coinciden con extensiones conocidas: se conservan para no romper controles nuevos
      if (!known.has(signature[0])) {
        known.add(signature[0]);
        log('icono en el player no catalogado (conservado):', signature[0]);
      }
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
    { key: 'extensionHeuristic', label: 'Ocultar botones desconocidos del player', type: 'bool', default: false },
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
