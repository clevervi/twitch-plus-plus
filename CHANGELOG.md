# Changelog

## 2.0.0

- Arquitectura modular: cada feature es un módulo en `src/features/` con ciclo de vida propio (enable/disable/route) y su propio intervalo de ejecución.
- Catálogo remoto (`catalog.json`): el repo publica selectores y features experimentales sin necesidad de una release del script; se cachea, se valida y hace fallback a lo local.
- Auto-actualización: `@updateURL`/`@downloadURL` apuntan a `dist/`, y el panel avisa e instala con un clic.
- Store con esquema tipado y migraciones (`src/core/migrations.js`): una config corrupta o de una versión vieja ya no rompe el arranque.
- Aislamiento de errores: una feature que falla 3 veces seguidas se desactiva sola y avisa; el resto sigue funcionando.
- Scheduler con latido único, pausa con la pestaña oculta y sin bucles agresivos.
- Registro de selectores con candidatos y fallback (`src/core/selectors.js`) en lugar de selectores sueltos.
- Buscador de chat mejorado: regex opcional, modo ocultar/atenuar y navegación entre coincidencias.
- Nuevas features: `chatKeywordHighlight`, `oledContrast`, ajuste de ancho de sidebar y contadores de ratio configurables.
- `catalog` (activar/desactivar), `autoUpdate` y `debug` como opciones del panel.
- Tests con `node:test` (41) incluido un smoke test que arranca el bundle real en un DOM simulado; lint y build sin dependencias.

## 1.3.0

- Versión anterior (script de un solo archivo): OLED, sidebar compacta, ocultar offline, buscador de chat, miniaturas, analítica de viewers, auto Channel Points y pausa de chat.
