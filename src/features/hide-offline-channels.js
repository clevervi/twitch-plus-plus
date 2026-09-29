/** Oculta cards de la sidebar cuyo canal está offline. */
import { qs } from '../core/dom.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';

const marked = new WeakSet();

function isOffline(card) {
  if (qs('[class*="offline"], [class*="Offline"]', card)) return true;
  if (qs('[data-test-selector*="offline"]', card)) return true;
  if (/offline|desconectado/i.test(card.getAttribute?.('aria-label') || '')) return true;
  return false;
}

function sweep() {
  for (const card of selectAll('sideNav.card')) {
    if (marked.has(card)) continue;
    if (isOffline(card)) {
      marked.add(card);
      card.setAttribute('data-twpp-offline', '1');
    } else {
      card.removeAttribute('data-twpp-offline');
    }
  }
}

function clear() {
  for (const card of selectAll('sideNav.card')) card.removeAttribute('data-twpp-offline');
}

defineFeature({
  id: 'hideOfflineChannels',
  label: 'Ocultar offline en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2000,
  css: `
    %SCOPE% [data-a-target="side-nav-card"][data-twpp-offline="1"],
    %SCOPE% .side-nav-card[data-twpp-offline="1"] { display: none !important; }
  `,
  tick: sweep,
  onEnable: sweep,
  onDisable: clear,
  onRoute: clear,
});
