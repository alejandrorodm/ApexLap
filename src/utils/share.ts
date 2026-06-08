// Compartir una "tarjeta" de un récord/pique, SIN dependencias nativas nuevas:
//   - Web: dibuja una imagen PNG en un <canvas> y la comparte con la hoja de
//     compartir del sistema (navigator.share con fichero, típico en móvil) o, si
//     no se puede, la descarga y copia además un resumen al portapapeles.
//   - Nativo: Share.share de React Native con un resumen en texto + la URL.
//
// El acceso al DOM (document/navigator/canvas) va siempre detrás de
// Platform.OS === 'web', así que en el bundle nativo nunca se ejecuta.
import { Platform, Share } from 'react-native';
import { formatTime } from './time';
import { colors } from '../theme';

const APP_URL = 'https://apexlap.web.app';

export interface ShareCard {
  badge: string; // "RÉCORD", "PIQUE GANADO"…
  car: string;
  track: string;
  timeMs: number;
  driverName: string;
  note?: string; // línea extra: condiciones, nº de vueltas…
}

function buildText(c: ShareCard): string {
  const lines = [
    `🏁 ApexLap · ${c.badge}`,
    `🚗 ${c.car}`,
    `📍 ${c.track}`,
    `⏱ ${formatTime(c.timeMs)} — 👑 ${c.driverName}`,
  ];
  if (c.note) lines.push(c.note);
  lines.push(APP_URL);
  return lines.join('\n');
}

export async function shareCard(c: ShareCard): Promise<void> {
  const text = buildText(c);
  if (Platform.OS === 'web') {
    await shareWeb(c, text);
    return;
  }
  try {
    await Share.share({ message: text });
  } catch {
    /* el usuario canceló: nada que hacer */
  }
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
  if (blob) downloadBlob(g, blob, 'apexlap.png');
  try {
    await nav?.clipboard?.writeText?.(text);
  } catch {
    /* portapapeles no disponible: da igual */
  }

  // 3) Si ni siquiera hubo imagen, intenta compartir el texto a secas.
  if (!blob && nav?.share) {
    try {
      await nav.share({ text });
    } catch {
      /* cancelado */
    }
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
  // Mejor esfuerzo: espera a que la fuente de marca (Orbitron) esté lista.
  try {
    await g.document?.fonts?.ready;
  } catch {
    /* sin Font Loading API: usa la fuente que haya */
  }

  const W = 1080;
  const H = 1350;
  const M = 90; // margen
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

  // Franja roja superior + tarjeta interior con borde dorado
  ctx.fillStyle = colors.primary;
  ctx.fillRect(0, 0, W, 16);
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  roundRect(ctx, M - 24, 140, W - 2 * (M - 24), H - 280, 28);
  ctx.stroke();

  // Marca APEX·LAP
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = `900 70px ${DISPLAY}`;
  ctx.fillStyle = colors.text;
  ctx.fillText('APEX', M, 250);
  const apexW = ctx.measureText('APEX').width;
  ctx.fillStyle = colors.primary;
  ctx.fillText('LAP', M + apexW + 6, 250);

  // Badge (RÉCORD / PIQUE GANADO)
  ctx.font = `800 30px ${SANS}`;
  ctx.fillStyle = colors.accent;
  ctx.fillText(c.badge.toUpperCase(), M, 300);

  // Coche y circuito (se encogen si no caben)
  fitText(ctx, `🚗 ${c.car}`, M, 470, W - 2 * M, 58, colors.text);
  fitText(ctx, `📍 ${c.track}`, M, 545, W - 2 * M, 40, colors.textDim);

  // Tiempo enorme, centrado
  ctx.textAlign = 'center';
  ctx.fillStyle = colors.accent;
  fitTextCentered(ctx, formatTime(c.timeMs), W / 2, 850, W - 2 * M, 200);

  // Piloto
  ctx.font = `800 46px ${SANS}`;
  ctx.fillStyle = colors.gold;
  ctx.fillText(`👑 ${c.driverName}`, W / 2, 960);

  // Nota opcional (condiciones, nº de vueltas…)
  if (c.note) {
    ctx.font = `600 32px ${SANS}`;
    ctx.fillStyle = colors.textDim;
    ctx.fillText(c.note, W / 2, 1020);
  }

  // Pie con URL
  ctx.font = `700 30px ${SANS}`;
  ctx.fillStyle = colors.textFaint;
  ctx.fillText(APP_URL.replace('https://', ''), W / 2, H - 110);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b: Blob | null) => (b ? resolve(b) : reject(new Error('toBlob nulo'))),
      'image/png'
    );
  });
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
