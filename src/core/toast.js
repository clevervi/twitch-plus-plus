import { log } from './log.js';

let host = null;
const queue = [];

export function setHost(node) {
  host = node;
  while (queue.length && host) {
    const item = queue.shift();
    if (Array.isArray(item)) show(item[0], item[1]);
    else show(item);
  }
}

export function show(message, duration = 1800) {
  if (!host) {
    console.info(`[Twitch++] ${message}`);
    log('toast (sin host):', message);
    queue.push([message, duration]);
    return;
  }
  const node = document.createElement('div');
  node.className = 'toast';
  node.textContent = String(message);
  host.appendChild(node);
  requestAnimationFrame(() => node.classList.add('in'));
  setTimeout(() => {
    node.classList.remove('in');
    setTimeout(() => node.remove(), 220);
  }, duration);
}
