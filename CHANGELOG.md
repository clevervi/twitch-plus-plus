# Changelog

## 2.2.3 — 2026-09-30

- **Multi-idioma en auto-claim**: soporte ampliado para inglés (`claim bonus`), español (`reclamar bonificación`), portugués (`resgatar bônus`), alemán (`bonus abholen`), francés (`réclamer un bonus`) y ruso (`забрать бонус`).
- **Fix controles del reproductor (BUG A)**: ampliación completa de `KNOWN_PLAYER_ICONS`, protección `SAFE_BUTTON_LABEL` para botones estándar de Twitch y cambio de `extensionHeuristic` a `default: false`.
- **Fix miniaturas de sidebar (BUG B)**: limpieza estricta en `mouseleave` y `inject`, validación de proximidad vertical card-tooltip y acotación de `sideNav.group` a la barra lateral.
- **Fix botón flotante FAB (BUG C)**: restaurada la opacidad base `.22` y `pointer-events: auto`, asegurando que el botón `++` siempre sea visible e interactivo.
- **Fix analytics (BUG D)**: reseteo de `counted` en `onRoute()` y `teardown()` en `viewer-analytics.js`.
- **UI & Performance**: listener de `resize` del panel con `{ passive: true }` y sincronización de atajos por defecto (`Alt+Shift+T` / `Alt+Shift+P`).
- **Test suite**: 64 tests unitarios pasando al 100% (añadidos `test/player-extensions.test.mjs`, `test/sidebar.test.mjs` y `test/auto-claim.test.mjs`).

## 2.2.2 — 2026-09-30

- **Fix auto-claim**: evita pulsar el menú nativo de saldo/potenciadores de Twitch mediante `FORBIDDEN_HINT` y comprobación del icono de cofre.
- **Selectores actualizados**: eliminación de selectores genéricos de botón en `community-points-summary`.

## 2.2.1 — 2026-09-30

- **Menú inteligente**: detecta posición en pantalla y abre hacia abajo o arriba sin salirse del viewport.
- **Selectores actualizados**: soporte para editor de chat Slate y selectores en español.

## 2.2.0

- **FAB draggable**: el botón `++` se puede arrastrar a cualquier posición de la pantalla; la posición se guarda entre sesiones. Ya no tapa los botones de Twitch (Channel Points, emotes, etc.).
- **Posición por defecto corregida**: el FAB arranca en `bottom:56px` en vez de `bottom:14px`, evitando la zona de botones del chat.
- **Flash de bienvenida**: al cargar la página el FAB aparece brevemente (2.5 s) para que el usuario sepa que está activo.
- **Fix: toasts invisibles**: la clase CSS del shadow DOM no coincidía con la que creaba el JS (`toast` vs `twpp-toast`).
- **Fix: botón Pausar chat roto**: faltaba el atributo `data-action="pause"` y el click handler no lo reconocía.

## 2.1.0

- `probe.html`: pega un volcado del DOM de Twitch y el script se ejecuta contra él en un iframe aislado, diciendo qué features fallan y qué selectores dejan de resolver. Es la herramienta para arreglar cambios de Twitch sin depurar en vivo.
- Salud de selectores: cada clave del registro recuerda qué candidato funciona y cuántos fallos acumula. Disponible en `TwitchPP.diagnostics.selectors()`, `broken()`, `report()` y en el botón *Diagnóstico* del panel.
- `TwitchPP.diagnostics.probe()`: fuerza todas las features contra el DOM actual, recoge los errores y restaura la configuración del usuario.
- `TwitchPP.diagnostics.report()`: informe de texto listo para pegar en un issue.
- Arranque a prueba de fallos: cada capa va en su propio `try/catch`; si algo peta se registra, se lanza `twpp:boot-error` y se avisa con un toast en vez de dejar al usuario sin panel.
- Importación de la configuración del script de un solo archivo (clave `twpp`) la primera vez, con sus migraciones.
- OLED respeta el tema de Twitch: con el ajuste *Solo en tema oscuro de Twitch* (activo por defecto) no se impone el negro si el usuario está en tema claro, y reaplica solo cuando cambia el tema.
- `when()` en el registro: una feature puede estar habilitada y aun así inactiva por condición, sin tocar la config del usuario.
- Fin del flash de tema: `@run-at document-start` y el CSS se inyecta antes de que Twitch pinte; la UI y el scheduler esperan al DOM.
- El estado de las features pasa a vivir en el DOM (atributos y clases) en vez de en `WeakSet`: canales offline, menciones y palabras clave ya no se quedan sin reevaluar al cambiar de canal, al desactivar y al editar los ajustes.
- Las tareas de red no se ejecutan fuera de `twitch.tv`, para que un catálogo remoto no contamine una medida.
- Tests: 52 (los nuevos cubren la importación de la config antigua, `when()`, la salud de selectores, la sonda, el informe y que `probe.html` parsea).

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

## 2.2.4 — 2026-10-01

- Fix tooltip miniatura sidebar en layout moderno, aspect ratio 16:9 estricto, optimizaciones de CPU y sync de ajustes en panel

## 2.2.5 — 2026-10-01

- Auditoría exhaustiva de los 20 bugs del inventario v1.3.0: autoClaim post-click check, chatPause estado nativo sincronizado, sidebarCompact protección de avatar, multi-pestaña GM_addValueChangeListener, FAB con detección de proximidad y pointer-events seguros, restauración de foco previo y Escape en el panel, cola de toasts y limpieza de chatSearch

## 2.2.6 — 2026-10-01

- Resolución completa de hallazgos v7: throttle() robusto sin doble ejecución ni argumentos obsoletos, scheduler con MIN_RUN_GAP anti-coalescencia, heurística de extensiones invertida a detección explícita EXTENSION_ICON_HINT protegiendo todos los controles de player (Subtitles, CC, PiP, Audio, RewindLive, Studio)

## 2.2.7 — 2026-10-01

- Actualización de selectores con base en informe de consola en vivo: soporte para sideNav.link, sideNav.more, claimBonus y pauseChat en Twitch moderno

## 2.2.8 — 2026-10-01

- Fix controles de player con overlays específicos, acotación estricta de tooltips de sidebar, corrección FAB no invasivo y selectores robustos

## 2.2.9 — 2026-10-01

- Blindaje integral: fijar escape CSS en modo limpio, limites de regex en menciones, observador dinamico en scheduler, atajo de panel en inputs y soporte de mayus

## 2.2.10 — 2026-10-01

- **Grants que faltaban**: `GM_deleteValue` y `GM_addValueChangeListener` no estaban declarados en el encabezado. Sin ellos, «Restablecer configuración» no borraba nada y la sincronización entre pestañas nunca ocurría.
- **`managerName()` corregido**: comprobaba `GM_info` con `typeof === 'function'` cuando `GM_info` es un objeto, así que el informe siempre decía «desconocido».
- **Diagnóstico de APIs**: `TwitchPP.diagnostics.apis()` y la línea «APIs ausentes» en `report()`.
- **Matriz de compatibilidad** en el README, con lo verificado y lo supuesto.
- **Tests**: 88 unitarios en verde.

## 2.2.11 — 2026-10-01

- **Botón flotante siempre visible**: la regla base de `.fab` era `opacity: 0` y `pointer-events: none`, así que el botón `++` no se veía ni se podía pulsar salvo que el ratón estuviera a menos de 140 px. Ahora está presente a `.3` y siempre pulsable; `awake` y `near` suben opacidad en lugar de hacerlo aparecer.
- **La sonda no dejaba la configuración sucia**: `probe()` encendía todas las features y las restauraba al final, sin protección. Una excepción a mitad dejaba el panel con todo encendido y persistido, justo en la herramienta que sirve para recuperar la configuración. Ahora restaura en un `finally`.
- **Temporizador huérfano en miniaturas**: `sidebar-thumbnails` programaba un `setTimeout` de 2 s sin guardar el identificador, y `teardown()` no lo podía cancelar. Apagar la feature antes de los dos segundos dejaba el precargado vivo, pidiendo imágenes al CDN de Twitch con la feature apagada.
- **Diagnóstico de rendimiento**: `TwitchPP.diagnostics.perf()` devuelve ticks, media de ticks por segundo, consultas al DOM, ráfagas de mutación y tiempo de arranque. `report()` incluye dos líneas nuevas con las cifras.
- **La CI se desincronizó de `npm run verify`**: `ci.yml` repetía los pasos a mano y se quedó sin el detector de idioma, que no se ejecutó en ningún pull request. Ahora delega en `verify`, y hay un test que falla si vuelven a separarse.
- **Correcciones de proceso**: el validador de PR lee las etiquetas desde la API en vez del payload del evento, y no se aplica a los PR de Dependabot, que no pueden llevar issue.
- **Tests**: 122 unitarios en verde, antes 99.
