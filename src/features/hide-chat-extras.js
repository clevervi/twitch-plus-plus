import { defineFeature } from '../core/registry.js';

defineFeature({
  id: 'hideChatExtras',
  label: 'Sin Bits / normas chat',
  section: 'chat',
  default: true,
  css: `
    %SCOPE% [data-a-target="bits-button"],
    %SCOPE% [data-test-selector="bits-button"],
    %SCOPE% [data-a-target="chat-rules-button"],
    %SCOPE% [data-test-selector="chat-rules-button"],
    %SCOPE% [data-a-target="chat-commands-button"],
    %SCOPE% [data-test-selector="chat-commands-button"] { display: none !important; }
  `,
});
