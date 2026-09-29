#!/usr/bin/env node
/** Sube la versión de package.json y escribe el apartado del CHANGELOG. */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkgPath = resolve(ROOT, 'package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

const [level, ...rest] = process.argv.slice(2);
const notes = rest.join(' ').trim();

function bump() {
  const [major, minor, patch] = String(pkg.version).split('.').map((n) => parseInt(n, 10) || 0);
  if (level === 'major') return `${major + 1}.0.0`;
  if (level === 'minor') return `${major}.${minor + 1}.0`;
  if (level === 'patch') return `${major}.${minor}.${patch + 1}`;
  throw new Error('uso: node scripts/bump.mjs <major|minor|patch> ["notas"]');
}

const next = bump();
pkg.version = next;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');

const changelogPath = resolve(ROOT, 'CHANGELOG.md');
let changelog = '# Changelog\n';
try {
  changelog = readFileSync(changelogPath, 'utf8');
} catch {
  /* se crea */
}
const today = new Date().toISOString().slice(0, 10);
const body = notes || '- pendiente de describir';
const section = `\n## ${next} — ${today}\n\n${body
  .split('\n')
  .map((line) => (line.startsWith('- ') ? line : `- ${line}`))
  .join('\n')}\n`;

writeFileSync(changelogPath, `${changelog.replace(/\s*$/, '')}\n${section}`, 'utf8');
process.stdout.write(`  ${pkg.version} → ${next}  (package.json + CHANGELOG.md)\n`);
