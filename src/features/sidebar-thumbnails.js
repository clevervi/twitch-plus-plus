/** Miniaturas de canal al pasar el ratón por una card de la sidebar. */
import { qs } from '../core/dom.js';
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';
import { get as storeGet } from '../core/store.js';
import { channelFromCard, thumbnailUrl, visibleChannels, waitForHoverDialog } from '../core/twitch.js';

const cache = new Map();
const bound = new WeakSet();
let generation = 0;

function ttl() {
  const seconds = Number(storeGet('thumbCacheTtl'));
  return (Number.isFinite(seconds) ? seconds : 60) * 1000;
}

function width() {
  const value = Number(storeGet('thumbWidth'));
  return Number.isFinite(value) ? value : 440;
}

function preload(channel) {
  if (!channel) return;
  const now = Date.now();
  const stamp = cache.get(channel);
  if (stamp && now - stamp < ttl()) return;
  cache.set(channel, now);
  const image = new Image();
  image.decoding = 'async';
  image.src = thumbnailUrl(channel, width());
}

function preloadVisible(limit = 8) {
  for (const channel of visibleChannels(limit)) preload(channel);
}

function inject(card, channel) {
  const local = generation;
  waitForHoverDialog().then((dialog) => {
    if (!dialog || !dialog.isConnected || local !== generation) return;
    const existing = qs('img.twpp-sidebar-thumb', dialog);
    if (existing) existing.remove();
    const image = document.createElement('img');
    image.className = 'twpp-sidebar-thumb';
    image.decoding = 'async';
    image.src = thumbnailUrl(channel, width());
    image.style.cssText = 'width:100%;display:block;border-radius:4px;margin-top:8px;';
    image.addEventListener('error', () => image.remove(), { once: true });
    dialog.append(image);
  });
}

function bind(card) {
  if (bound.has(card)) return;
  bound.add(card);
  let timer = null;
  card.addEventListener('mouseenter', () => {
    generation += 1;
    const channel = channelFromCard(card);
    if (!channel) return;
    clearTimeout(timer);
    timer = setTimeout(() => preload(channel), 120);
    inject(card, channel);
  });
  card.addEventListener('mouseleave', () => clearTimeout(timer));
}

function sweep() {
  for (const card of selectAll('sideNav.card')) bind(card);
  for (const group of selectAll('sideNav.group')) {
    for (const child of group.children) bind(child);
  }
}

function teardown() {
  for (const node of document.querySelectorAll('img.twpp-sidebar-thumb')) node.remove();
  cache.clear();
}

defineFeature({
  id: 'sidebarThumbnailPreview',
  label: 'Miniatura en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2500,
  settings: [
    { key: 'thumbWidth', label: 'Tamaño de miniatura', type: 'select', options: [['220', '220x248'], ['440', '440x248'], ['720', '720x405']], default: '440' },
    { key: 'thumbCacheTtl', label: 'Caché (segundos)', type: 'number', default: 60, min: 0, max: 3600 },
  ],
  tick: sweep,
  onEnable() {
    sweep();
    setTimeout(() => preloadVisible(8), 2000);
    log('miniaturas de sidebar activas');
  },
  onDisable: teardown,
  onRoute() {
    generation += 1;
    teardown();
  },
});
