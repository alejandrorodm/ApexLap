// Utilidades mínimas de imagen para generar los assets de la web (imagen de
// compartir e iconos PWA) sin depender de ImageMagick ni de un binario nativo.
// Solo pngjs, que ya viene en el árbol de dependencias.
const fs = require('fs');
const { PNG } = require('pngjs');

/** Lienzo RGBA en crudo. */
function canvas(width, height) {
  return { width, height, data: Buffer.alloc(width * height * 4, 0) };
}

function readPng(file) {
  const png = PNG.sync.read(fs.readFileSync(file));
  return { width: png.width, height: png.height, data: png.data };
}

function writePng(img, file) {
  const png = new PNG({ width: img.width, height: img.height });
  img.data.copy(png.data);
  fs.writeFileSync(file, PNG.sync.write(png));
}

/** Mezcla un color sobre el píxel (x, y) respetando su alfa (0–1). */
function blend(img, x, y, [r, g, b], alpha = 1) {
  if (alpha <= 0) return;
  const xi = Math.round(x);
  const yi = Math.round(y);
  if (xi < 0 || yi < 0 || xi >= img.width || yi >= img.height) return;
  const i = (yi * img.width + xi) * 4;
  const a = Math.min(1, alpha);
  img.data[i] = img.data[i] * (1 - a) + r * a;
  img.data[i + 1] = img.data[i + 1] * (1 - a) + g * a;
  img.data[i + 2] = img.data[i + 2] * (1 - a) + b * a;
  img.data[i + 3] = Math.max(img.data[i + 3], Math.round(255 * a));
}

function fillRect(img, x, y, w, h, color, alpha = 1) {
  for (let yy = Math.max(0, Math.round(y)); yy < Math.min(img.height, Math.round(y + h)); yy++) {
    for (let xx = Math.max(0, Math.round(x)); xx < Math.min(img.width, Math.round(x + w)); xx++) {
      blend(img, xx, yy, color, alpha);
    }
  }
}

/**
 * Línea gruesa entre dos puntos. Recorre el eje dominante y pinta un cuadrado
 * de lado `thickness` en cada paso: suficiente para las diagonales de la "X".
 */
function thickLine(img, x0, y0, x1, y1, thickness, color, alpha = 1) {
  const steps = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)));
  const half = thickness / 2;
  for (let s = 0; s <= steps; s++) {
    const t = steps === 0 ? 0 : s / steps;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t;
    fillRect(img, x - half, y - half, thickness, thickness, color, alpha);
  }
}

/** Redimensiona con interpolación bilineal (para bajar el icono de 1024 px). */
function resize(src, width, height) {
  const out = canvas(width, height);
  const sx = src.width / width;
  const sy = src.height / height;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const fx = Math.min(src.width - 1, (x + 0.5) * sx - 0.5);
      const fy = Math.min(src.height - 1, (y + 0.5) * sy - 0.5);
      const x0 = Math.max(0, Math.floor(fx));
      const y0 = Math.max(0, Math.floor(fy));
      const x1 = Math.min(src.width - 1, x0 + 1);
      const y1 = Math.min(src.height - 1, y0 + 1);
      const dx = fx - x0;
      const dy = fy - y0;
      const o = (y * width + x) * 4;
      for (let c = 0; c < 4; c++) {
        const p00 = src.data[(y0 * src.width + x0) * 4 + c];
        const p10 = src.data[(y0 * src.width + x1) * 4 + c];
        const p01 = src.data[(y1 * src.width + x0) * 4 + c];
        const p11 = src.data[(y1 * src.width + x1) * 4 + c];
        const top = p00 + (p10 - p00) * dx;
        const bottom = p01 + (p11 - p01) * dx;
        out.data[o + c] = Math.round(top + (bottom - top) * dy);
      }
    }
  }
  return out;
}

/** Pega `src` sobre `dst` en (dx, dy) respetando el alfa del origen. */
function composite(dst, src, dx, dy) {
  for (let y = 0; y < src.height; y++) {
    for (let x = 0; x < src.width; x++) {
      const i = (y * src.width + x) * 4;
      const a = src.data[i + 3] / 255;
      if (a > 0) {
        blend(dst, dx + x, dy + y, [src.data[i], src.data[i + 1], src.data[i + 2]], a);
      }
    }
  }
}

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

module.exports = {
  canvas,
  readPng,
  writePng,
  blend,
  fillRect,
  thickLine,
  resize,
  composite,
  hex,
};
