import assert from 'node:assert/strict';
import test from 'node:test';

// Regex representativo importado o copiado de la lógica de hide-extensions
const KNOWN_PLAYER_ICONS = new RegExp(
  'Icon-(Settings|Gear|Volume|Fullscreen|Theater|Pause|Play|Mute|Unmute|Rewind|Forward|' +
    'Quality|Clip|Share|Subscribe|Follow|Bits|Prime|Notifications|Messages|Search|Menu|Close|' +
    'Chevron|Arrow|Drops|Points|Reward|Emote|Mod|Chat|Crown|Heart|Rerun|Pin|Mute-User|Bit|' +
    'Hype|Extension|Collapse|Expand|Info|Rec|Resume|Exit|Picture|PictureInPicture|Pip|RewindLive|' +
    'PlaybackSettings|Live|Cast|Airplay|Subtitles|CC|Audio|AudioOnly|AudioTrack|Accessibility|Studio)',
  'i',
);

const SAFE_BUTTON_LABEL =
  /pantalla|fullscreen|teatro|theater|volumen|volume|silenciar|mute|pausa|pause|reproducir|play|ajustes|settings|calidad|quality|clip|compartir|share|subt[ií]tulos|captions|audio|pip|directo|live|accesibilidad|accessibility/i;

test('KNOWN_PLAYER_ICONS reconoce todos los controles nativos esenciales del reproductor', () => {
  const nativeIcons = [
    'Icon-Settings',
    'Icon-Gear',
    'Icon-Volume',
    'Icon-Fullscreen',
    'Icon-Theater',
    'Icon-Pause',
    'Icon-Play',
    'Icon-Mute',
    'Icon-Unmute',
    'Icon-PictureInPicture',
    'Icon-PlaybackSettings',
    'Icon-Quality',
    'Icon-Clip',
    'Icon-Subtitles',
    'Icon-CC',
    'Icon-Audio',
    'Icon-AudioOnly',
    'Icon-Accessibility',
    'Icon-Studio',
    'Icon-Pip',
    'Icon-RewindLive',
    'Icon-Cast',
    'Icon-Airplay',
    'Icon-Points',
    'Icon-Reward',
  ];

  for (const icon of nativeIcons) {
    assert.equal(
      KNOWN_PLAYER_ICONS.test(icon),
      true,
      `Debe reconocer el icono del player: ${icon}`,
    );
  }
});

test('KNOWN_PLAYER_ICONS no coincide con iconos desconocidos de extensiones externas', () => {
  const unknownIcons = [
    'Icon-CustomOverlayX',
    'Icon-ThirdPartyTracker',
    'Icon-SponsorExt',
  ];

  for (const icon of unknownIcons) {
    assert.equal(
      KNOWN_PLAYER_ICONS.test(icon),
      false,
      `No debe reconocer icono de extensión externa: ${icon}`,
    );
  }
});

test('SAFE_BUTTON_LABEL protege los botones esenciales por su texto o aria-label', () => {
  const safeLabels = [
    'Pantalla completa (f)',
    'Fullscreen (f)',
    'Ajustes',
    'Settings',
    'Pausar (espacio)',
    'Play (space)',
    'Silenciar (m)',
    'Subtítulos',
    'Modo teatro (alt+t)',
  ];

  for (const label of safeLabels) {
    assert.equal(
      SAFE_BUTTON_LABEL.test(label),
      true,
      `Debe proteger botón con aria-label: ${label}`,
    );
  }
});
