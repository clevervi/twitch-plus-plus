/**
 * Atajos de teclado definidos con colisiones mínimas.
 * Alt+Shift evita colisiones con navegador.
 */
import { register as registerKeybind } from '../core/keybinds.js';

// Llamado desde app.js
export function registerKeybinds() {
  registerKeybind('panel', 'Abrir panel', 'Alt+Shift+T');
  registerKeybind('chatPause', 'Pausar chat', 'Alt+Shift+P');
  registerKeybind('pauseAll', 'Desactivar todo', 'Alt+Shift+X');
}
