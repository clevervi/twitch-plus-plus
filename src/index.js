/**
 * Punto de entrada del userscript.
 */
import { diagnostics, setFeature, start } from './app.js';
import { VERSION } from './core/version.js';

start();

globalThis.TwitchPP = {
  version: VERSION,
  diagnostics,
  enable: (id) => setFeature(id, true),
  disable: (id) => setFeature(id, false),
};
