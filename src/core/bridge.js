/**
 * Puente de diagnostico hacia el mundo de la pagina.
 *
 * Con `@grant` Tampermonkey ejecuta el script en un mundo aislado, asi que
 * `globalThis.TwitchPP` no se ve desde la consola. La unica alternativa era
 * pegar el bundle con `eval`, que levanta una segunda copia sin acceso a `GM_*`:
 * arranca con los valores por defecto en vez de los ajustes reales y devuelve
 * `7/18 features` cuando la instalacion real decia `13/18`. Datos falsos.
 *
 * La pagina pide y el script responde. Lo que cruza el limite es siempre una
 * **cadena**: en los wrappers de seguridad entre mundos, un objeto puede llegar
 * vacio, una cadena nunca.
 *
 * Si el navegador lo bloquea, el puente simplemente no existe. Nada mas cambia.
 */
import { log } from '../core/log.js';

const NS_PETICION = 'twpp:diag:peticion';
const NS_RESPUESTA = 'twpp:diag:respuesta';
const TIMEOUT = 1500;

/** Se inyecta como texto en el mundo de la pagina. Sin acentos a proposito. */
const PUENTE_PAGINA = `(() => {
  if (window.TwitchPP) return;
  let secuencia = 0;
  const pedir = (op) => new Promise((resolve, reject) => {
    const id = ++secuencia;
    const alResponder = (ev) => {
      if (!ev.detail || ev.detail.id !== id) return;
      clearTimeout(temporizador);
      window.removeEventListener(${JSON.stringify(NS_RESPUESTA)}, alResponder);
      try { resolve(JSON.parse(ev.detail.json)); }
      catch (e) { reject(new Error('respuesta ilegible: ' + e)); }
    };
    const temporizador = setTimeout(() => {
      window.removeEventListener(${JSON.stringify(NS_RESPUESTA)}, alResponder);
      reject(new Error('el script no ha respondido'));
    }, ${TIMEOUT});
    window.addEventListener(${JSON.stringify(NS_RESPUESTA)}, alResponder);
    window.dispatchEvent(new CustomEvent(${JSON.stringify(NS_PETICION)}, { detail: { id, op } }));
  });
  window.TwitchPP = {
    via: 'puente',
    diagnostics: () => pedir('diagnostics'),
    motivoDe: (id) => pedir('motivo:' + id),
  };
})();`;

function instalar() {
  if (typeof document === 'undefined') return false;
  const script = document.createElement('script');
  script.textContent = PUENTE_PAGINA;
  (document.head || document.documentElement).append(script);
  script.remove();
  return true;
}

/** Escucha en el mundo aislado y contesta con una cadena JSON. */
function responder(evento) {
  // Un listener recibe el evento, no su `detail`. Leyendo `evento.op` esto
  // devuelve `undefined` siempre y el puente no contesta nunca.
  const detalle = evento && evento.detail;
  if (!detalle || typeof detalle !== 'object' || !detalle.op) return;
  const [op, arg] = String(detalle.op).split(':');

  let json;
  try {
    const datos =
      op === 'diagnostics'
        ? globalThis.TwitchPP?.diagnostics?.report?.() ?? { error: 'diagnostics no disponible' }
        : op === 'motivo'
          ? { id: arg, motivo: arg || '' }
          : { error: 'operacion desconocida: ' + op };
    json = JSON.stringify(datos);
  } catch (error) {
    json = JSON.stringify({ error: String(error?.message || error) });
  }

  window.dispatchEvent(new CustomEvent(NS_RESPUESTA, { detail: { id: detalle.id, json } }));
}

export function start() {
  if (typeof window === 'undefined' || !window.addEventListener) return;

  // `start` puede llamarse mas de una vez si la aplicacion se reinicia, y los
  // listeners se acumulan. Se quita el anterior antes de poner el nuevo.
  window.removeEventListener(NS_PETICION, responder);
  window.addEventListener(NS_PETICION, responder);

  try {
    instalar();
    log('puente de diagnostico activo');
  } catch (error) {
    // El puente es una comodidad. Si la CSP de la pagina lo bloquea, sigue todo
    // funcionando igual: solo se pierde la lectura desde la consola.
    log('puente de diagnostico no disponible:', error?.message || error);
  }
}