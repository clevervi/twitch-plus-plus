// Detector de mezcla de idiomas en la documentación y las plantillas.
// Solo vigila los tokens que delatan prosa en inglés o en otro idioma
// colada dentro de un texto que debe estar en español.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';

const RAIZ = resolve('.');
const OBJETIVOS = ['.github', 'CONTRIBUTING.md', 'SECURITY.md', 'CODE_OF_CONDUCT.md'];

// Solo palabras que no pueden aparecer en español. La jerga del proyecto
// (feature, commit, workflow, build) es intencionada y no se vigila.
const SOSPECHOSOS = [
  ' the ',
  ' and ',
  ' with ',
  ' this ',
  ' that ',
  ' from ',
  ' have ',
  ' been ',
  ' was ',
  ' were ',
  ' which ',
  ' there ',
  ' about ',
  ' please ',
  ' should ',
  ' would ',
  ' could ',
  ' when ',
  ' what ',
  ' will ',
  ' your ',
  ' their ',
  ' into ',
  ' than ',
  ' then ',
  ' not ',
  ' but ',
  ' for ',
  ' are ',
  ' was ',
];

const RUTAS = [];
function recorrer(ruta) {
  const info = statSync(ruta);
  if (info.isDirectory()) {
    for (const entrada of readdirSync(ruta)) recorrer(join(ruta, entrada));
    return;
  }
  if (['.md', '.yml', '.yaml'].includes(extname(ruta))) RUTAS.push(ruta);
}

for (const objetivo of OBJETIVOS) recorrer(join(RAIZ, objetivo));

let fallos = 0;
for (const ruta of RUTAS) {
  const lineas = readFileSync(ruta, 'utf8').split(/\r?\n/);
  lineas.forEach((linea, indice) => {
    // Se ignoran los bloques de código y los identificadores: ahí el inglés es legítimo.
    const limpia = linea.replace(/`[^`]*`/g, '').replace(/\b[\w.-]+\.[a-z]{2,4}\b/g, '');
    for (const palabra of SOSPECHOSOS) {
      if (limpia.toLowerCase().includes(palabra)) {
        fallos += 1;
        process.stderr.write(`  ✗ ${relative(RAIZ, ruta)}:${indice + 1}: ${palabra.trim()}\n    ${linea.trim()}\n`);
      }
    }
  });
}

if (fallos) {
  process.stderr.write(`\nidioma: ${fallos} posible(s) mezcla(s) de idioma\n`);
  process.exit(1);
}
process.stdout.write(`  idioma: ${RUTAS.length} archivo(s) sin mezcla evidente\n`);
