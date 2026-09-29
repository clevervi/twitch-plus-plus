import { defineFeature } from '../core/registry.js';
import { get as storeGet, onChange } from '../core/store.js';

let stop = null;

function applyWidth() {
  const raw = Number(storeGet('sidebarWidth'));
  const width = Number.isFinite(raw) ? Math.min(120, Math.max(50, raw)) : 72;
  document.documentElement.style.setProperty('--twpp-sidebar-width', `${width}px`);
}

defineFeature({
  id: 'sidebarCompact',
  label: 'Sidebar compacta',
  section: 'sidebar',
  default: false,
  settings: [{ key: 'sidebarWidth', label: 'Ancho (px)', type: 'number', default: 72, min: 50, max: 120 }],
  css: `
    %SCOPE% [data-a-target="side-nav-bar"],
    %SCOPE% .side-nav,
    %SCOPE% [data-test-selector="side-nav"],
    %SCOPE% nav[aria-label="Primary navigation"] {
      width: var(--twpp-sidebar-width, 72px) !important;
      min-width: var(--twpp-sidebar-width, 72px) !important;
      max-width: var(--twpp-sidebar-width, 72px) !important;
    }
    %SCOPE% [data-a-target="side-nav-card"] > *:not(:first-child),
    %SCOPE% .side-nav-card > *:not(:first-child) { display: none !important; }
    %SCOPE% [data-a-target="side-nav-card"] p,
    %SCOPE% .side-nav-card p,
    %SCOPE% [data-a-target="side-nav-card"] span,
    %SCOPE% .side-nav-card span { display: none !important; }
    %SCOPE% [data-a-target="side-nav-card"],
    %SCOPE% .side-nav-card {
      justify-content: center !important;
      padding: 6px !important;
    }
    %SCOPE% [data-a-target="side-nav-card"] [data-a-target="side-nav-card-viewer-count"],
    %SCOPE% .side-nav-card [class*="viewer-count"] { display: none !important; }
    %SCOPE% [data-a-target="side-nav-bar"] [data-a-target="side-nav-more"],
    %SCOPE% .side-nav__more,
    %SCOPE% [data-a-target="side-nav-bar"] h3,
    %SCOPE% [data-a-target="side-nav-bar"] h4 { display: none !important; }
    %SCOPE% [data-a-target="side-nav-bar"] a[data-a-target="side-nav-link"] > :not(svg):not(img):not(div:first-child) {
      display: none !important;
    }
  `,
  onEnable() {
    applyWidth();
    stop = onChange(applyWidth);
  },
  onDisable() {
    stop?.();
    stop = null;
    document.documentElement.style.removeProperty('--twpp-sidebar-width');
  },
});
