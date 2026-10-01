/** Miniaturas de canal al pasar el ratón por una card de la sidebar. */
import { log } from '../core/log.js';
import { defineFeature } from '../core/registry.js';
import { selectAll } from '../core/selectors.js';
import { get as storeGet } from '../core/store.js';
import { channelFromCard, thumbnailUrl, visibleChannels, waitForHoverDialog } from '../core/twitch.js';

const cache = new Map();
const bound = new WeakSet();
let generation = 0;
let leaveTimer = null;
let activeBalloon = null;

function ttl() {
  const seconds = Number(storeGet('thumbCacheTtl'));
  return (Number.isFinite(seconds) ? seconds : 60) * 1000;
}

function width() {
  const value = Number(storeGet('thumbWidth'));
  return Number.isFinite(value) && value >= 160 ? value : 320;
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

function getBalloon(dialog) {
  if (!dialog) return null;
  if (dialog.classList?.contains('tw-balloon') || dialog.getAttribute?.('data-a-target') === 'tw-balloon') {
    return dialog;
  }
  return dialog.querySelector?.('.tw-balloon, [data-a-target="tw-balloon"]') || dialog;
}

function restoreBalloon(balloon) {
  if (!balloon) return;
  balloon.style.removeProperty('width');
  balloon.style.removeProperty('max-width');
  balloon.style.removeProperty('min-width');
}

function cleanup() {
  if (activeBalloon) {
    restoreBalloon(activeBalloon);
    activeBalloon = null;
  }
  for (const node of document.querySelectorAll('img.twpp-sidebar-thumb')) {
    const parent = node.closest('.tw-balloon') || node.parentElement;
    node.remove();
    if (parent) restoreBalloon(parent);
  }
}

function inject(card, channel) {
  const local = generation;
  waitForHoverDialog().then((dialog) => {
    if (!dialog || !dialog.isConnected || local !== generation) return;

    // Verificar que el diálogo de hover está alineado verticalmente con la card
    const cardRect = card.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    if (cardRect.height > 0 && dialogRect.height > 0) {
      const cardCenterY = cardRect.top + cardRect.height / 2;
      const dialogCenterY = dialogRect.top + dialogRect.height / 2;
      if (Math.abs(cardCenterY - dialogCenterY) > 220) return;
    }

    // Limpieza global de cualquier miniatura previa
    cleanup();

    const balloon = getBalloon(dialog);
    const targetWidth = width();

    // Adaptar el ancho del globo para que la imagen no se recorte ni se comprima
    if (balloon) {
      balloon.style.width = `${targetWidth}px`;
      balloon.style.maxWidth = `${targetWidth}px`;
      balloon.style.minWidth = `${targetWidth}px`;
      activeBalloon = balloon;
    }

    const image = document.createElement('img');
    image.className = 'twpp-sidebar-thumb';
    image.decoding = 'async';
    image.alt = `Vista previa de ${channel}`;
    image.src = thumbnailUrl(channel, targetWidth);
    image.style.cssText = [
      'width:100%',
      'height:auto',
      'aspect-ratio:16/9',
      'object-fit:cover',
      'display:block',
      'border-radius:6px',
      'margin-top:8px',
      'background:#0e0e10',
      'box-shadow:0 2px 8px rgba(0,0,0,0.35)',
    ].join(';');

    image.addEventListener('error', () => {
      image.remove();
      restoreBalloon(balloon);
      if (activeBalloon === balloon) activeBalloon = null;
    }, { once: true });

    balloon.append(image);
  });
}

function bind(card) {
  if (bound.has(card)) return;
  bound.add(card);
  let timer = null;
  card.addEventListener('mouseenter', () => {
    clearTimeout(leaveTimer);
    generation += 1;
    const channel = channelFromCard(card);
    if (!channel) return;
    clearTimeout(timer);
    timer = setTimeout(() => preload(channel), 120);
    inject(card, channel);
  });
  card.addEventListener('mouseleave', () => {
    generation += 1;
    clearTimeout(timer);
    clearTimeout(leaveTimer);
    const leaveGen = generation;
    leaveTimer = setTimeout(() => {
      if (leaveGen === generation) cleanup();
    }, 80);
  });
}

function sweep() {
  for (const card of selectAll('sideNav.card')) {
    if (channelFromCard(card)) bind(card);
  }
}

function teardown() {
  clearTimeout(leaveTimer);
  cleanup();
  cache.clear();
}

defineFeature({
  id: 'sidebarThumbnailPreview',
  label: 'Miniatura en sidebar',
  section: 'sidebar',
  default: false,
  interval: 2500,
  settings: [
    {
      key: 'thumbWidth',
      label: 'Tamaño de miniatura',
      type: 'select',
      options: [
        ['220', '220px (Compacta)'],
        ['260', '260px (Mediana)'],
        ['320', '320px (Estándar 16:9)'],
        ['380', '380px (Grande)'],
        ['440', '440px (Extra grande)'],
        ['720', '720px (Máxima)'],
      ],
      default: '320',
    },
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
