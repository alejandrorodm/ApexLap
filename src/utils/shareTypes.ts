// Tipos y texto del "share card", sin dependencias de plataforma. Lo usan tanto
// el camino web (canvas, share.ts) como el nativo (view-shot, nativeShare.tsx).
import { formatTime } from './time';

export const APP_URL = 'https://apexlap.web.app';

export interface ShareCard {
  badge: string; // "RÉCORD", "PIQUE GANADO"…
  car: string;
  track: string;
  timeMs: number;
  driverName: string;
  note?: string; // línea extra: condiciones, nº de vueltas…
}

/** Resumen en texto para compartir/copiar cuando no hay imagen. */
export function shareCardText(c: ShareCard): string {
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
