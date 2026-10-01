// Comprueba si el buscador de chat se cuelga con una expresion regular patologica.
const lineaLarga = 'a'.repeat(40) + 'b';
const patron = '(a+)+$';

const re = new RegExp(patron, 'i');
const t0 = Date.now();
try {
  re.test(lineaLarga);
} catch (e) {
  console.log('lanzo:', e.name);
}
const ms = Date.now() - t0;
console.log('una prueba con', lineaLarga.length, 'caracteres:', ms, 'ms');
console.log(ms > 200 ? 'BLOQUEA: es un ReDoS real' : 'no llega a bloquear en esta medida');
