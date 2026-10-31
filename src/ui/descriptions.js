/** Pista corta de qué hace cada feature. El panel la muestra bajo el label. */
export const DESCRIPTIONS = {
  darkMode: 'Fondo negro puro para el tema oscuro de Twitch.',
  oledContrast: 'Sube el contraste de textos y bordes sobre OLED.',
  theaterClean: 'Oculta la barra superior hasta que acercas el ratón.',
  cleanMode: 'Quita bloques promocionales y ruido de la página.',
  hideSidebar: 'Libera el ancho de la sidebar para el directo.',
  hideViewerCount: 'Oculta el contador de espectadores.',
  hideUpNext: 'Esconde la cola de recomendaciones del reproductor.',
  hideStories: 'Quita la bandeja de Stories de la cabecera.',
  hideExtensions: 'Oculta los botones de extensiones del player.',
  hideChatExtras: 'Esconde Bits y normas del chat.',
  hideOfflineChannels: 'Quita de la sidebar los canales desconectados.',
  mentionHighlight: 'Marca las líneas del chat donde te mencionan.',
  chatKeywordHighlight: 'Resalta las líneas con tus palabras clave.',
  chatSearch: 'Filtra o atenúa mensajes desde una barra de búsqueda.',
  chatFocus: 'Deja solo menciones, palabras clave y tus mensajes.',
  viewerAnalytics: 'Añade viewers reales y chatters activos.',
  sidebarCompact: 'Reduce el ancho de la sidebar.',
  sidebarThumbnailPreview: 'Vista previa del canal al pasar por la sidebar.',
  autoClaim: 'Reclama el cofre de puntos de canal al aparecer.',
  autoReconnect: 'Reintenta reproducir si el directo se congela.',
  raidGuard: 'Evita el salto automático al canal de la raid.',
  liveReturn: 'Vuelve al canal cuando el streamer reanuda.',
};

export function describe(id) {
  return DESCRIPTIONS[id] || '';
}
