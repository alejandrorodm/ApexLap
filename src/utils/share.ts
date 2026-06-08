// Compartir una "tarjeta" de un récord/pique como IMAGEN:
//   - Web: dibuja un PNG en un <canvas> y lo comparte con la hoja del sistema
//     (navigator.share con fichero) o lo descarga + copia un resumen.
//   - Nativo: captura una vista con react-native-view-shot y la comparte con
//     expo-sharing (ver nativeShare.tsx). Si algo falla, cae a texto.
//
// El acceso al DOM (document/navigator/canvas) va siempre detrás de
// Platform.OS === 'web', así que en el bundle nativo nunca se ejecuta.
import { Platform } from 'react-native';
import { colors } from '../theme';
import { formatTime } from './time';
import { notify } from './alerts';
import { APP_URL, ShareCard, shareCardText } from './shareTypes';
// Metro resuelve `nativeShare.web.ts` en web (stub), así que view-shot/expo-sharing
// no entran en el bundle web.
import { shareCardNative } from './nativeShare';

export type { ShareCard } from './shareTypes';

export async function shareCard(c: ShareCard): Promise<void> {
  if (Platform.OS === 'web') {
    await shareWeb(c, shareCardText(c));
    return;
  }
  await shareCardNative(c);
}

// ── Web ─────────────────────────────────────────────────────────────────────

async function shareWeb(c: ShareCard, text: string): Promise<void> {
  const g = globalThis as any;
  const nav = g.navigator;

  let blob: Blob | null = null;
  try {
    blob = await renderCard(c);
  } catch {
    blob = null; // si el canvas falla, caemos a compartir/copiar solo texto
  }

  // 1) Compartir CON imagen (móvil): navigator.share aceptando ficheros.
  if (blob && nav?.canShare && nav?.share && typeof g.File === 'function') {
    const file = new g.File([blob], 'apexlap.png', { type: 'image/png' });
    if (nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], text });
        return;
      } catch {
        /* cancelado o no permitido: seguimos con la descarga */
      }
    }
  }

  // 2) Sin share de ficheros (escritorio): descarga la imagen + copia el texto.
  //    Damos AVISO porque si no parece que el botón "no hace nada".
  if (blob) {
    downloadBlob(g, blob, 'apexlap.png');
    let copied = false;
    try {
      await nav?.clipboard?.writeText?.(text);
      copied = true;
    } catch {
      /* portapapeles no disponible */
    }
    notify(
      '📲 Tarjeta lista',
      copied
        ? 'Imagen descargada (apexlap.png) y resumen copiado al portapapeles. Pégala/súbela al grupo.'
        : 'Imagen descargada (apexlap.png). Ya puedes mandarla al grupo.'
    );
    return;
  }

  // 3) Si ni siquiera hubo imagen, intenta compartir/copiar el texto a secas.
  if (nav?.share) {
    try {
      await nav.share({ text });
      return;
    } catch {
      /* cancelado */
    }
  }
  try {
    await nav?.clipboard?.writeText?.(text);
    notify('📋 Copiado', 'Resumen copiado al portapapeles para mandarlo al grupo.');
  } catch {
    notify('Compartir', text);
  }
}

function downloadBlob(g: any, blob: Blob, name: string): void {
  const url = g.URL.createObjectURL(blob);
  const a = g.document.createElement('a');
  a.href = url;
  a.download = name;
  g.document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => g.URL.revokeObjectURL(url), 2000);
}

const DISPLAY = 'Orbitron, Inter, Arial, sans-serif';
const SANS = 'Inter, Arial, sans-serif';

async function renderCard(c: ShareCard): Promise<Blob> {
  const g = globalThis as any;
  // Fuerza la carga de las variantes de Orbitron e Inter que usa la tarjeta
  // ANTES de dibujar (si no, el canvas usaría la fuente de reserva).
  const fonts = g.document?.fonts;
  if (fonts?.load) {
    try {
      await Promise.all([
        fonts.load('900 200px Orbitron'),
        fonts.load('800 28px Orbitron'),
        fonts.load('900 58px Inter'),
        fonts.load('800 46px Inter'),
        fonts.ready,
      ]);
    } catch {
      /* si falla la carga, se dibuja con la fuente que haya */
    }
  }

  const W = 1080;
  const H = 1350;
  const M = 80; // margen
  const canvas = g.document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d no disponible');

  // Fondo
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0B0D12');
  bg.addColorStop(1, '#06070A');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Bandera de cuadros DIFUMINADA en la cabecera (toque racing de fondo).
  ctx.save();
  ctx.filter = 'blur(20px)';
  ctx.globalAlpha = 0.22;
  drawChecker(ctx, -60, -60, W + 120, 560, 74, '#141A2B', '#37425C');
  ctx.restore();
  // Funde la bandera con el fondo hacia abajo para que no compita con el texto.
  const fade = ctx.createLinearGradient(0, 230, 0, 560);
  fade.addColorStop(0, 'rgba(11,13,18,0)');
  fade.addColorStop(1, '#0B0D12');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 230, W, 340);

  // Franja superior roja→amarillo (banda de meta).
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, W * 0.72, 12);
  ctx.fillStyle = colors.accent;
  ctx.fillRect(W * 0.72, 0, W * 0.28, 12);

  // Marca APEX·LAP + tagline.
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `900 64px ${DISPLAY}`;
  ctx.fillStyle = colors.text;
  ctx.fillText('APEX', M, 128);
  const apexW = ctx.measureText('APEX').width;
  ctx.fillStyle = colors.primary;
  ctx.fillText('LAP', M + apexW + 6, 128);
  ctx.textAlign = 'right';
  ctx.font = `800 18px ${DISPLAY}`;
  ctx.fillStyle = colors.textFaint;
  setSpacing(ctx, '4px');
  ctx.fillText('LEAGUE · RACING', W - M, 122);
  setSpacing(ctx, '0px');
  ctx.textAlign = 'left';

  // Badge en "pastilla" (RÉCORD / PIQUE GANADO).
  const badge = c.badge.toUpperCase();
  ctx.font = `800 26px ${DISPLAY}`;
  setSpacing(ctx, '3px');
  const padX = 22;
  const bw = ctx.measureText(badge).width + padX * 2;
  const bh = 52;
  const by = 178;
  ctx.fillStyle = colors.accent;
  roundRect(ctx, M, by, bw, bh, 12);
  ctx.fill();
  ctx.fillStyle = colors.bgDeep;
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, M + padX, by + bh / 2 + 1);
  ctx.textBaseline = 'alphabetic';
  setSpacing(ctx, '0px');

  // Coche / Circuito con etiqueta (sin emojis).
  label(ctx, 'COCHE', M, 362);
  fitText(ctx, c.car, M, 426, W - 2 * M, 66, colors.text);
  label(ctx, 'CIRCUITO', M, 506);
  fitText(ctx, c.track, M, 562, W - 2 * M, 44, colors.textDim);

  // Tiempo HÉROE, centrado y con resplandor.
  label(ctx, 'TIEMPO', M, 686);
  ctx.save();
  ctx.shadowColor = 'rgba(255,214,10,0.45)';
  ctx.shadowBlur = 36;
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.accent;
  fitTextCentered(ctx, formatTime(c.timeMs), W / 2, 840, W - 2 * M, 188);
  ctx.restore();
  ctx.textAlign = 'left';

  // Piloto.
  label(ctx, 'PILOTO', M, 952);
  fitText(ctx, c.driverName, M, 1012, W - 2 * M, 50, colors.gold);

  // Nota opcional (condiciones, nº de vueltas…).
  if (c.note) {
    ctx.font = `600 30px ${SANS}`;
    ctx.fillStyle = colors.textDim;
    ctx.fillText(c.note, M, 1064);
  }

  // Bandera de cuadros NÍTIDA al pie (2 filas) + URL.
  drawChecker(ctx, 0, H - 184, W, 52, 26, colors.text, '#0B0D12');
  ctx.textAlign = 'center';
  ctx.font = `700 26px ${DISPLAY}`;
  ctx.fillStyle = colors.textFaint;
  setSpacing(ctx, '2px');
  ctx.fillText(APP_URL.replace('https://', ''), W / 2, H - 64);
  setSpacing(ctx, '0px');

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob nulo'))),
      'image/png'
    );
  });
}

// Tablero de cuadros (bandera de carrera). Crudo y rápido con fillRect.
function drawChecker(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  sq: number,
  ca: string,
  cb: string
): void {
  const cols = Math.ceil(w / sq);
  const rows = Math.ceil(h / sq);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      ctx.fillStyle = (r + col) % 2 === 0 ? ca : cb;
      ctx.fillRect(x + col * sq, y + r * sq, sq, sq);
    }
  }
}

// Etiqueta pequeña en mayúsculas (Orbitron, espaciada) tipo "COCHE", "TIEMPO".
function label(ctx: any, text: string, x: number, y: number): void {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 22px ${DISPLAY}`;
  ctx.fillStyle = colors.primary; // rojo de carrera: se aprecia bien sobre el fondo
  setSpacing(ctx, '5px');
  ctx.fillText(text, x, y);
  setSpacing(ctx, '0px');
}

// letterSpacing del canvas (Chrome/Safari/FF recientes); si no existe, se ignora.
function setSpacing(ctx: any, value: string): void {
  try {
    ctx.letterSpacing = value;
  } catch {
    /* navegador sin soporte: sin espaciado extra */
  }
}

function roundRect(
  ctx: any,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Dibuja texto a la izquierda encogiendo la fuente hasta que quepa en maxW.
function fitText(
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxW: number,
  size: number,
  color: string
): void {
  let s = size;
  ctx.fillStyle = color;
  do {
    ctx.font = `900 ${s}px ${SANS}`;
    if (ctx.measureText(text).width <= maxW || s <= 22) break;
    s -= 2;
  } while (true);
  ctx.fillText(text, x, y);
}

function fitTextCentered(
  ctx: any,
  text: string,
  cx: number,
  y: number,
  maxW: number,
  size: number
): void {
  let s = size;
  do {
    ctx.font = `900 ${s}px ${DISPLAY}`;
    if (ctx.measureText(text).width <= maxW || s <= 60) break;
    s -= 6;
  } while (true);
  ctx.fillText(text, cx, y);
}
