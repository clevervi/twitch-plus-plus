import { defineFeature } from '../core/registry.js';

defineFeature({
  id: 'theaterClean',
  label: 'Teatro limpio',
  section: 'visual',
  default: false,
  css: `
    %SCOPE% [data-a-target="top-nav-container"],
    %SCOPE% .top-nav {
      opacity: 0 !important;
      transition: opacity .25s ease !important;
    }
    %SCOPE% [data-a-target="top-nav-container"]:hover,
    %SCOPE% [data-a-target="top-nav-container"]:focus-within,
    %SCOPE% .top-nav:hover,
    %SCOPE% .top-nav:focus-within { opacity: 1 !important; }
    %SCOPE% .persistent-player,
    %SCOPE% [data-a-target="persistent-player"] {
      background-color: #000 !important;
      border-bottom: none !important;
      box-shadow: none !important;
    }
    %SCOPE% .video-player__container,
    %SCOPE% [data-a-target="video-player"] { border-radius: 0 !important; }
  `,
});
