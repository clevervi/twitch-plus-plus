/**
 * Declaracion de la feature de reconexion.
 *
 * Sin reloj ni temporizadores: aqui se comprueba lo que protege de verdad, que
 * es que los valores por defecto sean los prudentes. Una recarga en bucle puede
 * acabar con la IP bloqueada por Twitch, asi que arrancar apagada y sin permiso
 * para recargar no es un detalle de estilo.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { get } from '../src/core/registry.js';
import '../src/features/auto-reconnect.js';

const ID = 'autoReconnect';

describe('declaracion de reconexion', () => {
  it('existe y va en Automatizacion', () => {
    const f = get(ID);
    assert.ok(f, 'la feature deberia estar registrada');
    assert.equal(f.section, 'auto');
  });

  it('arranca apagada', () => {
    assert.equal(get(ID).default, false);
  });

  it('no recarga la pagina salvo permiso explicito', () => {
    const recarga = get(ID).settings.find((s) => s.key === 'reconnectReload');
    assert.ok(recarga, 'deberia existir el ajuste de recarga');
    assert.equal(recarga.type, 'bool');
    assert.equal(recarga.default, false);
  });

  it('la espera maxima nunca es menor que la inicial', () => {
    const ajustes = Object.fromEntries(get(ID).settings.map((s) => [s.key, s]));
    const minimoInicial = Math.min(...ajustes.reconnectBase.options.map(([v]) => Number(v)));
    const minimoMaximo = Math.min(...ajustes.reconnectMax.options.map(([v]) => Number(v)));
    assert.ok(
      minimoMaximo >= minimoInicial,
      `espera maxima (${minimoMaximo}s) no puede ser menor que la inicial (${minimoInicial}s)`,
    );
  });

  it('ofrece esperas prudentes, ninguna por debajo de 5 s', () => {
    const ajustes = Object.fromEntries(get(ID).settings.map((s) => [s.key, s]));
    for (const clave of ['reconnectBase', 'reconnectMax']) {
      for (const [valor] of ajustes[clave].options) {
        assert.ok(Number(valor) >= 5, `${clave} ofrece ${valor}s, que es demasiado agresivo`);
      }
    }
  });

  it('expone onEnable y onDisable para no dejar timers vivos', () => {
    const f = get(ID);
    assert.equal(typeof f.onEnable, 'function');
    assert.equal(typeof f.onDisable, 'function');
  });
});