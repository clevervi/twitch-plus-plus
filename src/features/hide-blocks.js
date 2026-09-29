import { defineFeature } from '../core/registry.js';

defineFeature({
  id: 'hideSidebar',
  label: 'Sin barra lateral',
  section: 'clean',
  default: false,
  css: `
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"] { display: none !important; }
  `,
});

defineFeature({
  id: 'hideViewerCount',
  label: 'Sin contador de viewers',
  section: 'clean',
  default: false,
  css: `
    %SCOPE% strong[data-a-target="animated-channel-viewers-count"],
    %SCOPE% [data-test-selector="viewer-count"],
    %SCOPE% .channel-info-bar__viewers,
    %SCOPE% [data-a-target="channel-viewer-count"],
    %SCOPE% [data-a-target="animated-channel-viewers-count"] { display: none !important; }
  `,
});

defineFeature({
  id: 'hideUpNext',
  label: 'Sin "A continuación"',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="up-next-queue"],
    %SCOPE% [data-test-selector="up-next-queue"],
    %SCOPE% [data-a-target="autoplay-toggle"],
    %SCOPE% [data-test-selector="autoplay"],
    %SCOPE% [data-a-target="recommended-channels"],
    %SCOPE% [data-test-selector="recommended-channels"],
    %SCOPE% [data-a-target="recommended-streams"],
    %SCOPE% [data-test-selector="recommended-streams"],
    %SCOPE% .up-next-queue { display: none !important; }
  `,
});

defineFeature({
  id: 'hideStories',
  label: 'Sin Stories',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="stories-tray"],
    %SCOPE% .stories-tray,
    %SCOPE% [data-test-selector="stories-tray"],
    %SCOPE% [data-a-target="stories-button"],
    %SCOPE% [data-test-selector="stories"] { display: none !important; }
  `,
});
