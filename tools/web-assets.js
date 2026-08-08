// Prepara los assets de la web tras `expo export`:
//   · dist/og.png              imagen de la tarjeta al compartir el enlace
//   · dist/icon-{192,512}.png  iconos del manifiesto PWA
//   · dist/apple-touch-icon.png
//   · dist/manifest.webmanifest
//   · parchea dist/index.html con idioma, descripción, Open Graph y theme-color
//
// Sin esto, pegar https://apexlap.web.app en WhatsApp o Discord (que es como se
// reparte esta app) muestra un enlace pelado, y "Añadir a pantalla de inicio"
// no tiene ni nombre ni icono propios.
const fs = require('fs');
const path = require('path');
const {
  canvas,
  readPng,
  writePng,
  fillRect,
  thickLine,
  resize,
  composite,
  hex,
} = require('./png-lib');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const iconFile = path.join(rootDir, 'assets', 'icon.png');

const SITE = 'https://apexlap.web.app';
const TITLE = 'ApexLap · Liga de vueltas de Assetto Corsa';
const DESC =
  'Guarda tus vueltas de Assetto Corsa, pelea los récords de tu liga y ' +
  'convoca piques con tus colegas. Marcador en vivo, apuestas y clasificación.';

const RED = hex('#FF1E14');
const YELLOW = hex('#FFD60A');
const WHITE = hex('#F6F7FB');
const DEEP = hex('#06070A');

// ── Rótulo "APEXLAP" ────────────────────────────────────────────────────────
// Alfabeto mínimo de trazo recto (solo las letras que hace falta pintar), al
// estilo geométrico de Orbitron. Cada letra se dibuja dentro de una caja W×H
// con grosor de trazo S.
const GLYPHS = {
  A: (img, x, y, W, H, S, c) => {
    fillRect(img, x, y, S, H, c);
    fillRect(img, x + W - S, y, S, H, c);
    fillRect(img, x, y, W, S, c);
    fillRect(img, x, y + (H - S) / 2, W, S, c);
  },
  P: (img, x, y, W, H, S, c) => {
    fillRect(img, x, y, S, H, c);
    fillRect(img, x, y, W, S, c);
    fillRect(img, x, y + (H - S) / 2, W, S, c);
    fillRect(img, x + W - S, y, S, (H + S) / 2, c);
  },
  E: (img, x, y, W, H, S, c) => {
    fillRect(img, x, y, S, H, c);
    fillRect(img, x, y, W, S, c);
    fillRect(img, x, y + (H - S) / 2, W, S, c);
    fillRect(img, x, y + H - S, W, S, c);
  },
  X: (img, x, y, W, H, S, c) => {
    thickLine(img, x + S / 2, y + S / 2, x + W - S / 2, y + H - S / 2, S, c);
    thickLine(img, x + W - S / 2, y + S / 2, x + S / 2, y + H - S / 2, S, c);
  },
  L: (img, x, y, W, H, S, c) => {
    fillRect(img, x, y, S, H, c);
    fillRect(img, x, y + H - S, W, S, c);
  },
};

function drawWord(img, word, x, y, W, H, S, gap, colorFor) {
  let cx = x;
  for (const ch of word) {
    const draw = GLYPHS[ch];
    if (draw) draw(img, cx, y, W, H, S, colorFor(ch, cx));
    cx += W + gap;
  }
  return cx - gap; // x final del rótulo
}

// ── Imagen de compartir (Open Graph) ────────────────────────────────────────
function buildOgImage(icon) {
  const w = 1200;
  const h = 630;
  const img = canvas(w, h);

  // Fondo base + resplandor rojo arriba, como el degradado del marco web.
  fillRect(img, 0, 0, w, h, DEEP);
  const glowX = 560;
  const glowY = -40;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - glowX) / 700;
      const dy = (y - glowY) / 520;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < 1) {
        const t = (1 - d) ** 2;
        img.data[(y * w + x) * 4] += Math.round(70 * t);
        img.data[(y * w + x) * 4 + 1] += Math.round(9 * t);
        img.data[(y * w + x) * 4 + 2] += Math.round(6 * t);
      }
    }
  }
  // Rayado diagonal tenue (el mismo gesto que el fondo de la app).
  for (let i = -h; i < w; i += 28) {
    thickLine(img, i, 0, i + h * 0.5, h, 2, WHITE, 0.03);
  }

  // Banda de meta superior: rojo largo + amarillo corto.
  fillRect(img, 0, 0, w * 0.78, 9, RED);
  fillRect(img, w * 0.78, 0, w * 0.22, 9, YELLOW);

  // Icono de la app a la izquierda.
  const size = 300;
  composite(img, resize(icon, size, size), 92, (h - size) / 2 - 26);

  // Rótulo: APEX en blanco, LAP en rojo.
  const W = 66;
  const H = 96;
  const S = 18;
  const gap = 16;
  const wordX = 470;
  const wordY = 214;
  const endX = drawWord(img, 'APEXLAP', wordX, wordY, W, H, S, gap, (ch, cx) =>
    cx >= wordX + 4 * (W + gap) ? RED : WHITE
  );

  // Subrayado rojo + remate amarillo, y el guiño de la bandera a cuadros.
  fillRect(img, wordX, wordY + H + 30, endX - wordX, 7, RED);
  fillRect(img, wordX, wordY + H + 30, 90, 7, YELLOW);

  const sq = 26;
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col * sq < w; col++) {
      if ((row + col) % 2 === 0) {
        fillRect(img, col * sq, h - 2 * sq + row * sq, sq, sq, WHITE, 0.92);
      }
    }
  }
  return img;
}

// ── Manifiesto PWA ──────────────────────────────────────────────────────────
const MANIFEST = {
  name: 'ApexLap',
  short_name: 'ApexLap',
  description: DESC,
  start_url: '/',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait',
  background_color: '#06070A',
  theme_color: '#FF1E14',
  lang: 'es',
  categories: ['games', 'sports'],
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
  ],
};

// ── Etiquetas del <head> ────────────────────────────────────────────────────
const HEAD_TAGS = `
    <meta name="description" content="${DESC}" />
    <meta name="theme-color" content="#FF1E14" />
    <link rel="manifest" href="/manifest.webmanifest" />
    <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
    <meta name="mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="ApexLap" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="ApexLap" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:title" content="${TITLE}" />
    <meta property="og:description" content="${DESC}" />
    <meta property="og:url" content="${SITE}/" />
    <meta property="og:image" content="${SITE}/og.png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="ApexLap — liga de vueltas de Assetto Corsa" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${TITLE}" />
    <meta name="twitter:description" content="${DESC}" />
    <meta name="twitter:image" content="${SITE}/og.png" />
`;

function patchIndexHtml() {
  const file = path.join(distDir, 'index.html');
  if (!fs.existsSync(file)) {
    throw new Error('No existe dist/index.html: lanza antes `expo export`.');
  }
  let html = fs.readFileSync(file, 'utf8');

  // Idempotente: si ya se parcheó (re-export sobre el mismo dist), no duplica.
  if (html.includes('property="og:title"')) {
    html = html.replace(/\n\s*<meta name="description"[\s\S]*?twitter:image"[^>]*>\n/, '\n');
  }
  html = html.replace('<html lang="en">', '<html lang="es">');
  html = html.replace('<title>ApexLap</title>', `<title>${TITLE}</title>`);
  html = html.replace('</head>', `${HEAD_TAGS}  </head>`);
  fs.writeFileSync(file, html);
}

function main() {
  if (!fs.existsSync(distDir)) {
    throw new Error('No existe dist/: lanza antes `expo export --platform web`.');
  }
  const icon = readPng(iconFile);

  writePng(buildOgImage(icon), path.join(distDir, 'og.png'));
  writePng(resize(icon, 512, 512), path.join(distDir, 'icon-512.png'));
  writePng(resize(icon, 192, 192), path.join(distDir, 'icon-192.png'));
  writePng(resize(icon, 180, 180), path.join(distDir, 'apple-touch-icon.png'));
  fs.writeFileSync(
    path.join(distDir, 'manifest.webmanifest'),
    JSON.stringify(MANIFEST, null, 2)
  );
  patchIndexHtml();

  console.log('✓ Web: og.png, iconos PWA, manifiesto y metadatos de index.html');
}

main();
