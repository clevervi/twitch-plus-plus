/** Presets: un clic y la config queda como quieres. */
export const PRESETS = {
  minimal: ['darkMode', 'cleanMode', 'autoClaim'],
  balanced: [
    'darkMode',
    'cleanMode',
    'hideExtensions',
    'hideUpNext',
    'hideStories',
    'hideChatExtras',
    'autoClaim',
    'sidebarThumbnailPreview',
  ],
  aggressive: [
    'darkMode',
    'oledContrast',
    'cleanMode',
    'theaterClean',
    'hideExtensions',
    'hideSidebar',
    'hideViewerCount',
    'hideUpNext',
    'hideStories',
    'hideChatExtras',
    'autoClaim',
    'mentionHighlight',
    'viewerAnalytics',
    'sidebarThumbnailPreview',
    'sidebarCompact',
    'hideOfflineChannels',
    'chatSearch',
    'chatKeywordHighlight',
  ],
};

export const PRESET_LABELS = {
  minimal: 'Minimal',
  balanced: 'Balanced',
  aggressive: 'Agresivo',
  custom: 'Personalizado',
};

export function idsOf(name) {
  return PRESETS[name] || [];
}
