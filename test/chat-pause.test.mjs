import assert from 'node:assert/strict';
import test from 'node:test';

import { createDomStub } from '../tools/dom-stub.mjs';

async function chatPauseEntorno() {
  const stub = createDomStub();
  globalThis.document = stub.document;
  globalThis.window = stub.window;
  globalThis.getComputedStyle = stub.getComputedStyle;

  globalThis.GM_getValue = (key, fallback) => fallback;
  globalThis.GM_setValue = () => {};
  globalThis.GM_deleteValue = () => {};

  const boton = stub.document.createElement('button');
  boton.setAttribute('data-a-target', 'chat-pause-button');
  boton.setAttribute('aria-label', 'Reanudar chat');
  boton.textContent = 'Reanudar chat';
  let clics = 0;
  boton.click = () => {
    clics += 1;
    boton.setAttribute('aria-label', 'Pausar chat');
    boton.textContent = 'Pausar chat';
  };
  stub.document.querySelector = () => boton;

  const modulo = await import('../src/features/chat-pause.js');
  return { ChatPause: modulo.ChatPause, boton, clics: () => clics };
}

test('pause() no reanuda si Twitch ya tenía el chat pausado', async () => {
  const { ChatPause, clics } = await chatPauseEntorno();
  const antes = clics();

  const resultado = ChatPause.pause();

  assert.equal(resultado, true);
  assert.equal(clics(), antes, 'no debe pulsar un botón que ya está pausado');
  assert.equal(ChatPause.isActive(), true, 'debe quedar marcado como pausado');
});
