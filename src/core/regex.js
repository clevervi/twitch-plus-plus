/**
 * Compilación de expresiones regulares que el usuario puede escribir.
 *
 * Existe por un motivo concreto: un patrón con cuantificadores anidados como
 * `(a+)+$` compila bien y luego se pasa **minutos** calculando. Comprobado en
 * este repo: 137 segundos contra una única línea de chat de 41 caracteres.
 *
 * Y como el script corre en la pestaña de Twitch, eso no congela una página:
 * congela Twitch.
 *
 * No se intenta interrumpir una expresión en curso. El daño ocurre dentro de
 * un solo `regex.test()`, así que cuando se vuelve a mirar el reloj ya es
 * tarde. El corte va ANTES de compilar, que es el único sitio donde sirve.
 */

/** Patrón más largo que se acepta. */
export const MAX_PATRON = 200;

/**
 * Cuantificador anidado: un grupo que se repite y dentro del grupo hay otro
 * cuantificador.
 *
 *   NESTADO             (a+)+   (a*)*   (\w+)*
 *   NESTADO_ALTERNATIVA (a|b)+  (x|y)*
 *   REPETICION_AGRUPADA (a){2,} (x){3,5}
 *
 * No es una lista exhaustiva, y no pretende serlo. Quien escribe el patrón no
 * es un atacante, es alguien copiando una expresión de internet. Esto corta
 * los casos reales, no todos los posibles.
 */
const NESTADO = /\((?:\?[:=!]?)?[^()]*[+*][^()]*\)[+*{]/;
const NESTADO_ALTERNATIVA = /\([^()]*\|[^()]*\)[+*{]/;
const REPETICION_AGRUPADA = /\((?:\?[:=!]?)?[^()]*\)\{\d+,\}/;
const CUANTIFICADO = /[+*]|\{\d+,\d*\}/;

export function patronPeligroso(patron) {
  if (typeof patron !== 'string' || !patron) return false;
  if (patron.length > MAX_PATRON) return true;
  if (NESTADO.test(patron)) return true;
  if (NESTADO_ALTERNATIVA.test(patron) && CUANTIFICADO.test(patron)) return true;
  if (REPETICION_AGRUPADA.test(patron)) return true;
  return false;
}

/**
 * Compila un patrón escrito por el usuario.
 *
 * Devuelve siempre un objeto:
 *   { regex, rechazado }
 *
 * - `rechazado` es `''` si todo va bien, o el motivo si no.
 * - Un patrón con **sintaxis** inválida no se marca como rechazado: no es un
 *   problema de rendimiento, y el llamante puede caer a texto plano sin
 *   avisar de nada.
 */
export function compilarSeguro(patron, flags = 'i') {
  const vacio = { regex: null, rechazado: '' };
  if (typeof patron !== 'string' || !patron) return vacio;

  if (patron.length > MAX_PATRON) {
    return { regex: null, rechazado: `patrón de más de ${MAX_PATRON} caracteres` };
  }
  if (patronPeligroso(patron)) {
    return { regex: null, rechazado: 'patrón con repetición anidada, se cuelga el navegador' };
  }
  try {
    return { regex: new RegExp(patron, flags), rechazado: '' };
  } catch {
    return vacio;
  }
}
