export function $(selector, root = document) {
  return root.querySelector(selector);
}

export function $$(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

export function qsAll(selector, root = document) {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

export function qs(selector, root = document) {
  try {
    return root.querySelector(selector);
  } catch {
    return null;
  }
}

export function findFirst(selectors, root = document) {
  for (const selector of selectors) {
    const el = qs(selector, root);
    if (el) return el;
  }
  return null;
}

export function isVisible(el) {
  if (!el || !el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  if (!rect.width && !rect.height) return false;
  const style = getComputedStyle(el);
  return style.visibility !== 'hidden' && style.display !== 'none';
}

export function throttle(fn, wait) {
  let last = 0;
  let timer = null;
  let pending = null;
  return function throttled(...args) {
    pending = args;
    const remaining = wait - (Date.now() - last);
    if (remaining <= 0) {
      last = Date.now();
      fn.apply(this, pending);
      pending = null;
      return;
    }
    if (timer) return;
    timer = setTimeout(() => {
      timer = null;
      last = Date.now();
      if (pending) fn.apply(this, pending);
      pending = null;
    }, remaining);
  };
}

export function debounce(fn, wait) {
  let timer = null;
  return function debounced(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), wait);
  };
}

export function onIdle(fn, timeout = 900) {
  if (typeof requestIdleCallback === 'function') return requestIdleCallback(fn, { timeout });
  return setTimeout(fn, 250);
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') node.setAttribute('style', value);
    else if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value);
    else if (value !== null && value !== undefined) node.setAttribute(key, value);
  }
  for (const child of [].concat(children)) {
    if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

export function ready(fn) {
  if (document.readyState !== 'loading') return fn();
  return document.addEventListener('DOMContentLoaded', fn, { once: true });
}
