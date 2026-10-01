import { defineFeature } from '../core/registry.js';
import { get as storeGet } from '../core/store.js';
import { isDarkTheme } from '../core/twitch.js';

defineFeature({
  id: 'darkMode',
  label: 'Tema OLED',
  section: 'visual',
  default: true,
  // Si el usuario está con el tema claro de Twitch, OLED no se impone: se
  // respeta su elección y el tick reevalúa la condición al cambiar el tema.
  when: () => !storeGet('respectTwitchTheme') || isDarkTheme(),
  interval: 1500,
  settings: [
    { key: 'respectTwitchTheme', label: 'Solo en tema oscuro de Twitch', type: 'bool', default: true },
  ],
  css: `
    %SCOPE% {
      --color-background-body: #000000 !important;
      --color-background-base: #000000 !important;
      --color-background-alt: #060606 !important;
      --color-background-alt-2: #0b0b0b !important;
      --color-background-float: #0b0b0b !important;
      --color-background-overlay: #000000 !important;
      --color-background-input: #0e0e0e !important;
      --color-background-input-hover: #141414 !important;
      --color-background-input-focus: #141414 !important;
      --color-background-button-secondary-default: #101010 !important;
      --color-background-button-secondary-hover: #1a1a1a !important;
      --color-background-button-secondary-active: #1f1f23 !important;
      --color-background-interactable-default: rgba(255,255,255,0.04) !important;
      --color-background-interactable-hover: rgba(255,255,255,0.08) !important;
      --color-background-interactable-active: rgba(255,255,255,0.12) !important;
      --color-background-tag-default: #1f1f23 !important;
      --color-border-base: #1b1b1b !important;
      --color-border-alt: #141414 !important;
      --color-border-input: #2a2a2d !important;
      --color-border-input-hover: #3a3a3d !important;
      --color-border-input-focus: #9147ff !important;
      --color-text-base: #efeff1 !important;
      --color-text-alt: #adadb8 !important;
      --color-text-alt-2: #7d7d88 !important;
      --color-text-link: #bf94ff !important;
      --color-text-link-hover: #d0b3ff !important;
      --shadow-elevation-1: 0 1px 2px rgba(0,0,0,0.9) !important;
      --shadow-elevation-2: 0 4px 8px rgba(0,0,0,0.9) !important;
      background-color: #000000 !important;
    }
    %SCOPE% body,
    %SCOPE% #root,
    %SCOPE% .tw-root--theme-dark { background-color: #000000 !important; }
    %SCOPE% [data-a-target="top-nav-container"],
    %SCOPE% .top-nav {
      background-color: #000000 !important;
      border-bottom-color: #1b1b1b !important;
    }
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"] {
      background-color: #000000 !important;
      border-right-color: #1b1b1b !important;
    }
    %SCOPE% .side-nav-card:hover,
    %SCOPE% [data-a-target="side-nav-card"]:hover { background-color: #0b0b0b !important; }
    %SCOPE% [data-a-target="video-player"],
    %SCOPE% .video-player,
    %SCOPE% .persistent-player,
    %SCOPE% [data-a-target="persistent-player"] { background-color: #000000 !important; }
    %SCOPE% .video-player__container { border-radius: 0 !important; }
    %SCOPE% .chat-scrollable-area__message-container,
    %SCOPE% [data-test-selector="chat-scrollable-area__message-container"],
    %SCOPE% [data-a-target="chat-scrollable-area"] { background-color: #000000 !important; }
    %SCOPE% .chat-input,
    %SCOPE% [data-a-target="chat-input"] {
      background-color: #0e0e0e !important;
      border-color: #2a2a2d !important;
    }
    %SCOPE% [role="menu"],
    %SCOPE% [role="dialog"],
    %SCOPE% [role="listbox"],
    %SCOPE% .tw-dialog-layer,
    %SCOPE% .tw-balloon,
    %SCOPE% .tw-tooltip {
      background-color: #0b0b0b !important;
      border-color: #2a2a2d !important;
      color: #efeff1 !important;
    }
    %SCOPE% *::-webkit-scrollbar-track { background: #060606 !important; }
    %SCOPE% *::-webkit-scrollbar-thumb { background: #1b1b1b !important; border-radius: 4px; }
    %SCOPE% *::-webkit-scrollbar-thumb:hover { background: #2a2a2d !important; }
  `,
});

defineFeature({
  id: 'oledContrast',
  label: 'Contraste OLED alto',
  section: 'visual',
  default: false,
  // El CSS de aquí fuerza texto blanco sobre variables de Twitch. Sin esta
  // condición, con el tema claro de Twitch se aplicaba igual y ponía texto
  // blanco sobre fondo blanco: `darkMode` respeta la elección del usuario,
  // pero esta feature no dependía de él y se colaba por detrás.
  when: () => !storeGet('respectTwitchTheme') || isDarkTheme(),
  css: `
    %SCOPE% {
      --color-text-base: #ffffff !important;
      --color-text-alt: #d3d3d9 !important;
      --color-text-alt-2: #a4a4ae !important;
      --color-border-base: #2a2a2d !important;
      --color-border-alt: #1f1f23 !important;
    }
    %SCOPE% a,
    %SCOPE% button { font-weight: 500 !important; }
  `,
});
