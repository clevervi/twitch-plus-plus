/**
 * Pausa de chat.
 */
import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { ChatPause } from './chat-pause.js';

defineFeature({
  id: 'chatPause',
  label: 'Pausar chat',
  section: 'chat',
  default: true,
  interval: 400,
  tick() {
    ChatPause.ensure();
  },
});
