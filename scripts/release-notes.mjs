#!/usr/bin/env node
/**
 * Imprime el apartado del CHANGELOG de una versión, que es lo que se usa como
 * cuerpo de la release de GitHub. Se puede usar en local para revisar lo que
 * se va a publicar antes de crearla.
 *
 *   node scripts/release-notes.mjs          # versión actual de package.json
 *   node scripts/release-notes.mjs 2.2.10   # versión concreta
 */
import { readFileSync } from 'node:fs';
import { argv } from 'node:process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Apartado de `## <version>` hasta el siguiente `## `, o hasta el final. */
export function seccionDelChangelog(changelog, version) {
  const escapada = String(version).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const cabecera = new RegExp(`^##\\s+${escapada}\\s*(—|-|$)`);
  const lineas = String(changelog || '').split(/\r?\n/);
  const inicio = lineas.findIndex((linea) => cabecera.test(linea));
  if (inicio === -1) return '';

  let fin = lineas.length;
  for (let indice = inicio + 1; indice < lineas.length; indice += 1) {
    if (lineas[indice].startsWith('## ')) {
      fin = indice;
      break;
    }
  }
  return lineas.slice(inicio + 1, fin).join('\n').trim();
}

export function versionActual() {
  return JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8')).version;
}

function ejecutar() {
  const version = argv[2] || versionActual();
  const notas = seccionDelChangelog(readFileSync(resolve(ROOT, 'CHANGELOG.md'), 'utf8'), version);
  if (!notas) {
    process.stderr.write(`  release-notes: el CHANGELOG no tiene un apartado para ${version}\n`);
    process.exit(1);
  }
  process.stdout.write(`${notas}\n`);
}

if (argv[1] && import.meta.url === pathToFileURL(argv[1]).href) ejecutar();
