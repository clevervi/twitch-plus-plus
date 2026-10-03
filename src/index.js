/**
 * Punto de entrada del userscript.
 */
import { diagnostics, setFeature, start } from './app.js';
import { start as startBridge } from './core/bridge.js';
import { VERSION } from './core/version.js';

start();

globalThis.TwitchPP = {
  version: VERSION,
  diagnostics,
  enable: (id) => setFeature(id, true),
  disable: (id) => setFeature(id, false),
};

// Tras fijar el global, para que el puente pueda leerlo al responder.
startBridge();
