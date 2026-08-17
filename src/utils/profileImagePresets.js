// src/utils/profileImagePresets.js
//
// Built-in default avatar/banner presets - pure inline SVG, zero external
// image requests or bundled binary assets. Each preset's `dataUrl` is a
// ready-to-use string for both the picker thumbnail (<img src>) and the
// actual profile.avatarUrl/coverUrl value once applied, so there is only
// one rendering path to keep in sync.
const svgToDataUrl = (svg) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const GRADIENTS = [
    { id: 'sunset', label: 'Sunset', from: '#FF9A56', to: '#FF6B9D' },
    { id: 'ocean', label: 'Ocean', from: '#2E9CCA', to: '#0F5FA6' },
    { id: 'aurora', label: 'Aurora', from: '#8B5CF6', to: '#3B82F6' },
    { id: 'ember', label: 'Ember', from: '#F43F5E', to: '#F97316' },
    { id: 'mint', label: 'Mint', from: '#10B981', to: '#0EA5A5' },
    { id: 'grape', label: 'Grape', from: '#A855F7', to: '#EC4899' },
];

const avatarGradientSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g-${id})"/>
</svg>`;

const avatarCharacterSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g-${id})"/>
  <circle cx="100" cy="78" r="34" fill="rgba(255,255,255,0.92)"/>
  <path d="M30,200 C30,146 60,120 100,120 C140,120 170,146 170,200 Z" fill="rgba(255,255,255,0.92)"/>
</svg>`;

const THEMED_ICONS = {
    rocket: '<path d="M100 40c22 14 32 40 30 68-10 4-20 4-30 0-10 4-20 4-30 0-2-28 8-54 30-68z" fill="rgba(255,255,255,0.95)"/><circle cx="100" cy="80" r="9" fill-opacity="0.35" fill="#1F2937"/><path d="M78 108l-16 24 24-8z" fill="rgba(255,255,255,0.75)"/><path d="M122 108l16 24-24-8z" fill="rgba(255,255,255,0.75)"/><path d="M92 128h16l-8 26z" fill="rgba(255,255,255,0.75)"/>',
    star: '<path d="M100 40l16 34 37 5-27 26 6 37-32-17-32 17 6-37-27-26 37-5z" fill="rgba(255,255,255,0.95)"/>',
    mountain: '<path d="M20 150l45-60 30 36 20-26 65 74z" fill="rgba(255,255,255,0.95)"/><circle cx="140" cy="66" r="14" fill="rgba(255,255,255,0.7)"/>',
    compass: '<circle cx="100" cy="100" r="52" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="6"/><path d="M100 62l16 34-16 34-16-34z" fill="rgba(255,255,255,0.95)"/>',
};

const avatarThemedSvg = ({ from, to }, id, iconKey) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="200" height="200" fill="url(#g-${id})"/>
  ${THEMED_ICONS[iconKey]}
</svg>`;

export const AVATAR_PRESETS = [
    ...GRADIENTS.map((g) => ({ id: `avatar-gradient-${g.id}`, label: g.label, dataUrl: svgToDataUrl(avatarGradientSvg(g, g.id)) })),
    ...[GRADIENTS[1], GRADIENTS[2], GRADIENTS[4], GRADIENTS[5]].map((g) => ({ id: `avatar-character-${g.id}`, label: `${g.label} Silhouette`, dataUrl: svgToDataUrl(avatarCharacterSvg(g, `char-${g.id}`)) })),
    { id: 'avatar-icon-rocket', label: 'Rocket', dataUrl: svgToDataUrl(avatarThemedSvg(GRADIENTS[3], 'icon-rocket', 'rocket')) },
    { id: 'avatar-icon-star', label: 'Star', dataUrl: svgToDataUrl(avatarThemedSvg(GRADIENTS[2], 'icon-star', 'star')) },
    { id: 'avatar-icon-mountain', label: 'Mountain', dataUrl: svgToDataUrl(avatarThemedSvg(GRADIENTS[4], 'icon-mountain', 'mountain')) },
    { id: 'avatar-icon-compass', label: 'Compass', dataUrl: svgToDataUrl(avatarThemedSvg(GRADIENTS[1], 'icon-compass', 'compass')) },
];

// 1200x428 matches ImageCropModal's own 'wide' export size, so a preset
// looks identical in aspect ratio to a real uploaded+cropped cover.
const COVER_W = 1200;
const COVER_H = 428;

const coverWaveSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_W} ${COVER_H}">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#g-${id})"/>
  <path d="M0 320 C 200 260, 400 380, 600 300 S 1000 240, ${COVER_W} 320 L ${COVER_W} ${COVER_H} L 0 ${COVER_H} Z" fill="rgba(255,255,255,0.10)"/>
  <path d="M0 380 C 250 340, 450 420, 700 360 S 1050 300, ${COVER_W} 380 L ${COVER_W} ${COVER_H} L 0 ${COVER_H} Z" fill="rgba(255,255,255,0.08)"/>
</svg>`;

const coverMeshSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_W} ${COVER_H}">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#g-${id})"/>
  <circle cx="220" cy="120" r="220" fill="rgba(255,255,255,0.12)"/>
  <circle cx="950" cy="340" r="260" fill="rgba(255,255,255,0.10)"/>
  <circle cx="700" cy="60" r="140" fill="rgba(255,255,255,0.08)"/>
</svg>`;

const coverGeoSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_W} ${COVER_H}">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#g-${id})"/>
  ${Array.from({ length: 9 }).map((_, i) => `<line x1="${i * 160 - 100}" y1="0" x2="${i * 160 - 100 + 400}" y2="${COVER_H}" stroke="rgba(255,255,255,0.07)" stroke-width="34"/>`).join('')}
</svg>`;

const coverDotsSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_W} ${COVER_H}">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#g-${id})"/>
  ${Array.from({ length: 8 }).flatMap((_, row) => Array.from({ length: 22 }).map((_, col) => `<circle cx="${col * 58 + (row % 2 ? 29 : 0)}" cy="${row * 58}" r="5" fill="rgba(255,255,255,0.14)"/>`)).join('')}
</svg>`;

const coverPeaksSvg = ({ from, to }, id) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${COVER_W} ${COVER_H}">
  <defs>
    <linearGradient id="g-${id}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="${COVER_W}" height="${COVER_H}" fill="url(#g-${id})"/>
  <path d="M0 428 L180 220 L360 340 L560 140 L780 320 L1000 200 L${COVER_W} 340 L${COVER_W} 428 Z" fill="rgba(255,255,255,0.10)"/>
  <path d="M0 428 L260 300 L480 400 L720 260 L${COVER_W} 380 L${COVER_W} 428 Z" fill="rgba(255,255,255,0.14)"/>
</svg>`;

const COVER_BUILDERS = [coverWaveSvg, coverMeshSvg, coverGeoSvg, coverDotsSvg, coverPeaksSvg];

export const COVER_PRESETS = GRADIENTS.map((g, i) => {
    const build = COVER_BUILDERS[i % COVER_BUILDERS.length];
    return { id: `cover-${g.id}`, label: g.label, dataUrl: svgToDataUrl(build(g, `cover-${g.id}`)) };
});
