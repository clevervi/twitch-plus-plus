/**
 * `chat-pause` es la única feature que manipula el scroll del chat y la única
 * que hace clic en un botón de Twitch. Un fallo aquí deja el chat congelado,
 * que es de las pocas cosas que el usuario no puede salir.
 *
 * El caso que motivó este fichero: `findScrollable()` empezaba el recorrido
 * en `container.parentElement`, así que nunca miraba el contenedor, que es
 * justamente el elemento con scroll. Caía al fallback, que devolvía un nodo que
 * no desliza, y forzar `scrollTop` sobre él no hace nada.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';

import { arrancar } from './harness.mjs';

let pagina;
let cerrar;
let botonDePausa;

before(async () => {
  ({ page: pagina, cerrar } = await arrancar());
  botonDePausa = await pagina.evaluate(() => {
    const { shadow } = window.__twpp || {};
    return !!shadow?.querySelector('[data-action="pause"]');
  });
  assert.ok(botonDePausa, 'el panel debe traer el botón de pausar chat');
});

after(async () => {
  await cerrar();
});

const MEDIDA = () =>
  pagina.evaluate(() => {
    const c = document.querySelector('.chat-scrollable-area__message-container');
    return { top: c.scrollTop, max: c.scrollHeight - c.clientHeight };
  });

const IR_A = (y) =>
  pagina.evaluate((v) => {
    document.querySelector('.chat-scrollable-area__message-container').scrollTop = v;
  }, y);

/**
 * Espera a que el scroll llegue a una posicion concreta.
 *
 * Este fichero usaba esperas fijas de 150-300 ms y con eso pasaba en local y
 * fallaba con la maquina ocupada: verde aqui, rojo en CI, sin cambio de
 * codigo. Espera corta no significa reliable.
 *
 * Sondea hasta 6 s en vez de 4: el suite completo corre varios navegadores y
 * bajo carga el latido del scheduler se retrasa. Prefiere tardar de mas a
 * fallar por reloj.
 */
async function esperarTop(esperado, ms = 6000) {
  const limite = Date.now() + ms;
  let visto = null;
  while (Date.now() < limite) {
    visto = (await MEDIDA()).top;
    if (visto === esperado) return visto;
    await pagina.waitForTimeout(80);
  }
  return visto;
}
const PAUSAR = () => pagina.evaluate(() => window.__twpp.shadow.querySelector('[data-action="pause"]').click());

/**
 * Deja la pausa en el estado que pide el test.
 *
 * El estado de la pausa es global al módulo, así que sin esto cada test
 * depende del anterior: el primero dejaba el chat pausado, el siguiente
 * pulsaba «pausar» pensando que reanudaba y sus aserciones fallaban por culpa
 * del test anterior, no del código.
 *
 * El botón del panel lleva la clase `on` cuando el chat está pausado
 * (`panel.js`), así que el estado se puede leer antes de actuar.
 */
async function dejarPausa(querido) {
  for (let intento = 0; intento < 4; intento += 1) {
    const actual = await pagina.evaluate(
      () => !!window.__twpp.shadow.querySelector('[data-action="pause"]').classList.contains('on'),
    );
    if (actual === Boolean(querido)) return;
    await PAUSAR();
    await pagina.waitForTimeout(120);
  }
  throw new Error(`no se pudo dejar la pausa en ${querido}`);
}

beforeEach(async () => {
  await pagina.evaluate(() => document.querySelector('#prueba-pausa-nativa')?.remove());
  await dejarPausa(false);
});

async function esperarPanelPausado(querido, ms = 6000) {
  const limite = Date.now() + ms;
  let visto = false;
  while (Date.now() < limite) {
    visto = await pagina.evaluate(
      () => !!window.__twpp.shadow.querySelector('[data-action="pause"]').classList.contains('on'),
    );
    if (visto === Boolean(querido)) return true;
    await pagina.waitForTimeout(100);
  }
  return false;
}

describe('el contenedor de chat tiene por donde hacer scroll', () => {
  it('la fixture se puede desplazar de verdad', async () => {
    // Sin esto los otros tests pasarían por la razón equivocada: si el
    // contenedor no deslizara, forzar el scrollTop no probaría nada.
    const m = await MEDIDA();
    assert.ok(m.max > 100, `el contenedor debe tener scroll real (max ${m.max})`);
  });
});

describe('pausar el chat congela el scroll', () => {
  it('al pausar, el scroll vuelve a la posicion pausada', async () => {
    await IR_A(300);
    assert.equal(await esperarTop(300), 300, 'partimos de 300');

    await PAUSAR();
    assert.equal(await esperarTop(300), 300, 'pausar no debe mover el chat');

    await IR_A(0);
    assert.equal(await esperarTop(300), 300, 'el scroll tiene que volver a la pausa');
  });

  it('tambien bloquea si se intenta ir mas abajo', async () => {
    await IR_A(300);
    await PAUSAR();
    await IR_A(900);
    assert.equal(await esperarTop(300), 300, 'tampoco puede bajar');
  });

  it('al reanudar, el chat vuelve a moverse', async () => {
    await IR_A(300);
    await PAUSAR();
    await PAUSAR(); // reanudar
    await IR_A(0);
    // Este es el que importa: si `detach()` faltara, el chat se quedaría
    // congelado para siempre y no habría forma de salir desde la interfaz.
    assert.equal(await esperarTop(0), 0, 'tras reanudar debe poder desplazarse libremente');
  });

  it('reanudar justo despues de la rueda no desactiva el siguiente bloqueo', async () => {
    await IR_A(300);
    await PAUSAR();

    await pagina.evaluate(() => {
      const contenedor = document.querySelector('.chat-scrollable-area__message-container');
      contenedor.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }));
      const boton = window.__twpp.shadow.querySelector('[data-action="pause"]');
      boton.click(); // reanudar: detach() cancela el temporizador de la rueda
      boton.click(); // volver a pausar antes de que se cumplan los 150 ms
    });

    await pagina.waitForTimeout(200);
    await IR_A(0);
    assert.equal(await esperarTop(300), 300, 'la pausa nueva tiene que volver a bloquear el scroll');
  });

  it('un ciclo largo de pausar y reanudar no deja el chat bloqueado', async () => {
    for (let i = 0; i < 5; i += 1) {
      await PAUSAR();
      await pagina.waitForTimeout(80);
      await PAUSAR();
      await pagina.waitForTimeout(80);
    }
    await IR_A(120);
    assert.equal(await esperarTop(120), 120, 'el último estado debe ser reanudado y libre');
  });
});

describe('el usuario puede salir de la pausa con la rueda', () => {
  it('una rueda permite desplazarse aunque este pausado', async () => {
    await IR_A(300);
    await PAUSAR();
    // El chat da al usuario 150 ms de escapada tras mover la rueda, para que no
    // se sienta que le han cerrado el chat en la cara.
    await pagina.evaluate(() => {
      const c = document.querySelector('.chat-scrollable-area__message-container');
      c.dispatchEvent(new WheelEvent('wheel', { bubbles: true, deltaY: 120 }));
    });
    await pagina.waitForTimeout(50);
    await IR_A(120);
    const conRueda = (await MEDIDA()).top;
    assert.equal(conRueda, 120, 'tras la rueda el usuario puede desplazarse');

    // Pasada la escapada vuelve a congelarse, pero **en la posición donde el
    // usuario lo dejó**: el temporizador hace `state.top = state.el.scrollTop`.
    // Es lo que hace que la pausa no pelee con el usuario: si volviera al 300
    // original, el chat daría un salto de 180 px solo.
    await pagina.waitForTimeout(400);
    await IR_A(600);
    assert.equal(await esperarTop(120), 120, 'la pausa se reancla donde el usuario soltó');
  });
});

describe('la pausa nativa de Twitch se refleja en el panel', () => {
  it('adopta el estado del botón nativo sin esperar a un cambio de ruta', async () => {
    await pagina.evaluate(() => {
      const boton = document.createElement('button');
      boton.id = 'prueba-pausa-nativa';
      boton.dataset.aTarget = 'chat-pause-button';
      boton.setAttribute('aria-label', 'Reanudar chat');
      boton.textContent = 'Reanudar chat';
      document.querySelector('[data-a-target="chat-room-component-layout"]').prepend(boton);
    });

    assert.equal(
      await esperarPanelPausado(true),
      true,
      'el panel debe marcar la pausa aunque Twitch la haya iniciado por su cuenta',
    );

    await pagina.evaluate(() => document.querySelector('#prueba-pausa-nativa')?.remove());
    await dejarPausa(false);
  });

  it('reanudar pulsa el botón nuevo si Twitch reemplazó el anterior', async () => {
    await pagina.evaluate(() => {
      const boton = document.createElement('button');
      boton.id = 'prueba-pausa-vieja';
      boton.dataset.aTarget = 'chat-pause-button';
      boton.setAttribute('aria-label', 'Reanudar chat');
      boton.textContent = 'Reanudar chat';
      document.querySelector('[data-a-target="chat-room-component-layout"]').prepend(boton);
    });
    assert.equal(await esperarPanelPausado(true), true, 'la pausa nativa debe adoptarse primero');

    await pagina.evaluate(() => {
      const sala = document.querySelector('[data-a-target="chat-room-component-layout"]');
      const vieja = document.querySelector('#prueba-pausa-vieja');
      const nueva = document.createElement('button');
      nueva.id = 'prueba-pausa-nativa';
      nueva.dataset.aTarget = 'chat-pause-button';
      nueva.setAttribute('aria-label', 'Reanudar chat');
      nueva.textContent = 'Reanudar chat';
      nueva.addEventListener('click', () => {
        nueva.setAttribute('aria-label', 'Pausar chat');
        nueva.textContent = 'Pausar chat';
      });
      vieja.remove();
      sala.prepend(nueva);
      // Sin esperar al `ensure()` de 600 ms: el botón viejo ya está desconectado.
      window.__twpp.shadow.querySelector('[data-action="pause"]').click();
    });

    await pagina.waitForTimeout(800);
    const siguePausado = await pagina.evaluate(
      () => window.__twpp.shadow.querySelector('[data-action="pause"]').classList.contains('on'),
    );
    assert.equal(siguePausado, false, 'el panel no debe volver a marcar pausa tras reanudar');

    await dejarPausa(false);
    await pagina.evaluate(() => document.querySelector('#prueba-pausa-nativa')?.remove());
  });
});