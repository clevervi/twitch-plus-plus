import { log } from './log.js';
import { all } from './registry.js';

const STYLE_ID = 'twpp-style';
let current = '';

function sheet() {
  let node = document.getElementById(STYLE_ID);
  if (!node) {
    node = document.createElement('style');
    node.id = STYLE_ID;
    (document.head || document.documentElement).appendChild(node);
  }
  return node;
}

function build() {
  const chunks = [];
  for (const feature of all()) {
    if (!feature.css) continue;
    chunks.push(feature.css.replace(/%SCOPE%/g, `html.twpp-${feature.id}`));
  }
  return chunks.join('\n');
}

/** Reconstruye el CSS consolidado (llamar tras añadir features remotas). */
export function rebuild() {
  current = build();
  sheet().textContent = current;
  log('CSS reconstruido:', `${(current.length / 1024).toFixed(1)} KB`);
  return current;
}

export function css() {
  if (!current) rebuild();
  return current;
}
