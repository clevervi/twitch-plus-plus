/**
 * Pausa de chat.
 *
 * Usa el botón nativo de Twitch cuando existe; si no, congela el scroll del
 * contenedor de mensajes. Se mantiene vivo aunque Twitch recree el nodo.
 */
import { isVisible } from '../core/dom.js';
import { select } from '../core/selectors.js';
import { show as toast } from '../core/toast.js';

const state = {
  active: false,
  mode: null, // 'native' | 'scroll' | null
  el: null,
  top: 0,
  userScrolling: false,
  onScroll: null,
  onUser: null,
  userTimer: null,
  native: null,
};

function nativeButton() {
  const button = select('pauseChat');
  return button && isVisible(button) ? button : null;
}

/** Twitch cambia el aria-label cuando el chat está pausado por su propio botón. */
function nativeSaysPaused(button) {
  return /resume|reanudar/i.test(button?.getAttribute('aria-label') || '');
}

function findScrollable() {
  const container = select('chat.container');
  if (!container) return null;
  let node = container.parentElement;
  while (node && node !== document.body) {
    const overflow = getComputedStyle(node).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll' || overflow === 'overlay') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return container.parentElement || container;
}

function detach() {
  if (!state.el) return;
  state.el.removeEventListener('scroll', state.onScroll);
  state.el.removeEventListener('wheel', state.onUser);
  state.el.removeEventListener('touchmove', state.onUser);
  clearTimeout(state.userTimer);
  state.el = null;
}

function attach() {
  const node = findScrollable();
  if (!node) return false;
  if (node === state.el) return true;
  detach();

  state.el = node;
  state.onScroll = () => {
    if (!state.active || !state.el || state.userScrolling) return;
    if (Math.abs(state.el.scrollTop - state.top) > 1) state.el.scrollTop = state.top;
  };
  state.onUser = () => {
    state.userScrolling = true;
    clearTimeout(state.userTimer);
    state.userTimer = setTimeout(() => {
      state.userScrolling = false;
      if (state.el) state.top = state.el.scrollTop;
    }, 150);
  };
  node.addEventListener('scroll', state.onScroll, { passive: true });
  node.addEventListener('wheel', state.onUser, { passive: true });
  node.addEventListener('touchmove', state.onUser, { passive: true });
  return true;
}

export const ChatPause = {
  isActive() {
    return state.active;
  },

  pause() {
    const native = nativeButton();
    if (native) {
      native.click();
      state.active = true;
      state.mode = 'native';
      state.native = native;
      toast('Chat pausado');
      return true;
    }
    if (!attach()) return false;
    state.top = state.el.scrollTop;
    state.active = true;
    state.mode = 'scroll';
    toast('Chat pausado');
    return true;
  },

  resume() {
    if (state.mode === 'native' && state.native && state.native.isConnected) {
      state.native.click();
    }
    state.native = null;
    state.active = false;
    state.mode = null;
    detach();
    toast('Chat reanudado');
    return true;
  },

  toggle() {
    return state.active ? this.resume() : this.pause();
  },

  /** Lo llama el scheduler: reconcilia con Twitch y recoloca el scroll si recreó el contenedor. */
  ensure() {
    if (!state.active) return;
    if (state.mode === 'native') {
      const current = nativeButton();
      if (current && nativeSaysPaused(current)) {
        state.native = current;   // actualiza la referencia
        return;
      }
      // El botón nativo desapareció o ya no dice "Resume": Twitch desbloqueó el chat
      state.native = null;
      state.active = false;
      state.mode = null;
      detach();
      return;
    }
    if (state.mode === 'scroll') {
      if (!state.el || !state.el.isConnected) {
        attach();
        if (state.el) state.top = state.el.scrollTop;
      }
    }
  },
};
