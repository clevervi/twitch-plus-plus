import assert from 'node:assert/strict';
import test from 'node:test';

import { channelFromHref, thumbnailUrl, parseViewerText } from '../src/core/twitch.js';
import { candidates } from '../src/core/selectors.js';

test('channelFromHref extrae correctamente canales válidos y descarta rutas reservadas', () => {
  assert.equal(channelFromHref('/ibai'), 'ibai');
  assert.equal(channelFromHref('/auronplay/about'), 'auronplay');
  assert.equal(channelFromHref('/rubius?referrer=raid'), 'rubius');

  // Rutas reservadas de Twitch
  assert.equal(channelFromHref('/directory'), null);
  assert.equal(channelFromHref('/directory/following'), null);
  assert.equal(channelFromHref('/settings'), null);
  assert.equal(channelFromHref('/subscriptions'), null);
  assert.equal(channelFromHref('/wallet'), null);
  assert.equal(channelFromHref('/drops'), null);

  // Entradas inválidas
  assert.equal(channelFromHref(''), null);
  assert.equal(channelFromHref(null), null);
  assert.equal(channelFromHref('//malicious.com'), null);
  assert.equal(channelFromHref('https://twitch.tv/ibai'), null);
});

test('thumbnailUrl genera la URL del CDN oficial de Twitch con resolución ajustada en 16:9', () => {
  assert.equal(
    thumbnailUrl('ibai'),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-320x180.jpg',
  );
  assert.equal(
    thumbnailUrl('ibai', 220),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-220x124.jpg',
  );
  assert.equal(
    thumbnailUrl('ibai', 260),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-260x146.jpg',
  );
  assert.equal(
    thumbnailUrl('ibai', 320),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-320x180.jpg',
  );
  assert.equal(
    thumbnailUrl('ibai', 440),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-440x248.jpg',
  );
  assert.equal(
    thumbnailUrl('ibai', 720),
    'https://static-cdn.jtvnw.net/previews-ttv/live_user_ibai-720x405.jpg',
  );
});

test('sideNav.group acota los selectores a la sidebar y no afecta a navs externos', () => {
  const groupCandidates = candidates('sideNav.group');
  assert.ok(groupCandidates.length > 0);
  // Ningún candidato debe ser genéricamente "nav .tw-transition-group" sin acotar a la sidebar
  assert.equal(groupCandidates.includes('nav .tw-transition-group'), false);
  assert.ok(groupCandidates.some((sel) => sel.includes('side-nav')));
});

test('parseViewerText analiza diversos formatos de números de Twitch', () => {
  assert.equal(parseViewerText('500'), 500);
  assert.equal(parseViewerText('1.250'), 1250);
  assert.equal(parseViewerText('1,250'), 1250);
  assert.equal(parseViewerText('12.5K'), 12500);
  assert.equal(parseViewerText('12,5K'), 12500);
  assert.equal(parseViewerText('1.2M'), 1200000);
  assert.equal(parseViewerText('1,5 mil'), 1500);
  assert.equal(parseViewerText(''), null);
  assert.equal(parseViewerText(null), null);
});
