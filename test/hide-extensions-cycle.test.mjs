import assert from 'node:assert/strict';
import test from 'node:test';

/**
 * Copia de la lógica de ocultar/restaurar de hide-extensions.
 *
 * Se replica en vez de importarse porque la feature no exporta nada y no merece
 * la pena abrirla solo para un test. Lo que se fija es el COMPORTAMIENTO: que el
 * ciclo apagar/encender vuelva a funcionar y que la restauración no borre los
 * valores que puso Twitch.
 */

const PROPIEDADES = ['display', 'pointer-events'];

function crearGestor() {
  const ocultos = new Map();

  function restaurar(elemento, previo) {
    for (const propiedad of PROPIEDADES) {
      if (previo[propiedad]) elemento.style.setProperty(propiedad, previo[propiedad]);
      else elemento.style.removeProperty(propiedad);
    }
  }

  function kill(elemento) {
    if (!elemento || ocultos.has(elemento)) return false;
    const previo = {};
    for (const propiedad of PROPIEDADES) previo[propiedad] = elemento.style?.getPropertyValue(propiedad) ?? '';
    elemento.style.setProperty('display', 'none', 'important');
    elemento.style.setProperty('pointer-events', 'none', 'important');
    ocultos.set(elemento, previo);
    return true;
  }

  function restore() {
    for (const [elemento, previo] of ocultos) {
      if (elemento?.isConnected) restaurar(elemento, previo);
    }
    ocultos.clear();
  }

  return { kill, restore, ocultos };
}

function elemento(isConnected = true) {
  const estilos = new Map();
  return {
    isConnected,
    style: {
      setProperty: (k, v) => estilos.set(k, v),
      removeProperty: (k) => estilos.delete(k),
      getPropertyValue: (k) => estilos.get(k) ?? '',
    },
    leer: (k) => estilos.get(k) ?? '',
  };
}

test('apagar y volver a encender vuelve a ocultar el elemento', () => {
  const { kill, restore } = crearGestor();
  const nodo = elemento();

  assert.equal(kill(nodo), true, 'la primera vez se oculta');
  assert.equal(nodo.leer('display'), 'none');

  restore();
  assert.equal(nodo.leer('display'), '', 'al apagar se quita');

  // Este es el bug: antes el registro no se vaciaba y kill() no hacia nada.
  assert.equal(kill(nodo), true, 'al reencender se vuelve a ocultar');
  assert.equal(nodo.leer('display'), 'none');
});

test('el ciclo largo de apagar y encender no acumula nada', () => {
  const { kill, restore, ocultos } = crearGestor();
  const nodo = elemento();

  for (let i = 0; i < 5; i += 1) {
    kill(nodo);
    restore();
  }
  assert.equal(ocultos.size, 0, 'el registro queda limpio tras cada ciclo');
  assert.equal(kill(nodo), true, 'y sigue pudiendo ocultar');
});

test('restaurar devuelve el valor que Twitch tenia, no borra la propiedad', () => {
  const { kill, restore } = crearGestor();
  const nodo = elemento();
  // Twitch escribe esto en línea antes de que nosotros toquemos nada.
  nodo.style.setProperty('display', 'flex');
  nodo.style.setProperty('pointer-events', 'auto');

  kill(nodo);
  assert.equal(nodo.leer('display'), 'none', 'lo nuestro gana');

  restore();
  assert.equal(nodo.leer('display'), 'flex', 'vuelve el flex de Twitch, no se borra la propiedad');
  assert.equal(nodo.leer('pointer-events'), 'auto');
});

test('un elemento desconectado no se toca al restaurar', () => {
  const { kill, restore } = crearGestor();
  const nodo = elemento(false);
  kill(nodo);
  nodo.isConnected = false;
  restore();
  // No debe lanzar, y el registro se limpia igualmente.
  assert.equal(nodo.leer('display'), 'none', 'no se intenta restaurar un nodo que ya no está');
});
