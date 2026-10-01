import { defineFeature } from '../core/registry.js';

defineFeature({
  id: 'cleanMode',
  label: 'Modo limpio',
  section: 'clean',
  default: true,
  css: `
    %SCOPE% [data-a-target="prime-offer"],
    %SCOPE% .prime-offer,
    %SCOPE% .prime-offer-offer,
    %SCOPE% [data-test-selector="prime-offer"],
    %SCOPE% [data-a-target="upsell-banner"],
    %SCOPE% [data-test-selector="subscription-upsell"],
    %SCOPE% [data-a-target="chat-input-upsell"],
    %SCOPE% .chat-input__upsell,
    %SCOPE% [data-a-target="chat-room-header-prime-offer"],
    %SCOPE% [data-test-selector="chat-room-header-prime-offer"],
    %SCOPE% [data-a-target="gift-sub-banner"],
    %SCOPE% [data-test-selector="gift-sub-banner"],
    %SCOPE% [data-a-target="bits-upsell"],
    %SCOPE% [data-test-selector="bits-upsell-banner"],
    %SCOPE% [data-a-target="watch-streak-notification"],
    %SCOPE% [data-a-target="prime-gaming-button"],
    %SCOPE% [data-test-selector="prime-gaming"] { display: none !important; }
  `,
});
