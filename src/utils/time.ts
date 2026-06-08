// Parseo y formateo de tiempos de vuelta.
// Formato canónico mostrado: m:ss.mmm  (p.ej. 1:42.356)

/** Convierte milisegundos a "m:ss.mmm". */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--:--.---';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor(ms % 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

/**
 * Formatea un tiempo de sector. Los sectores suelen durar menos de un minuto,
 * así que se muestran como "ss.mmm" (p.ej. "31.234"); si pasan del minuto, se
 * cae al formato completo "m:ss.mmm".
 */
export function formatSector(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '--.---';
  if (ms >= 60_000) return formatTime(ms);
  const seconds = Math.floor(ms / 1000);
  const millis = Math.floor(ms % 1000);
  return `${seconds}.${String(millis).padStart(3, '0')}`;
}

/** Diferencia con signo respecto a una referencia, p.ej. "+0.482" o "-1.230". */
export function formatDelta(ms: number, referenceMs: number): string {
  const diff = ms - referenceMs;
  const sign = diff > 0 ? '+' : diff < 0 ? '-' : '';
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  const millis = Math.floor(abs % 1000);
  return `${sign}${seconds}.${String(millis).padStart(3, '0')}`;
}

/**
 * Intenta interpretar texto libre como un tiempo de vuelta y devuelve ms.
 * Acepta:  "1:42.356", "1:42:356", "102.356", "102356" (ms), "1 42 356".
 * Devuelve null si no se puede interpretar.
 */
export function parseTime(input: string): number | null {
  const raw = input.trim();
  if (!raw) return null;

  // Normaliza separadores a un patrón con grupos.
  // Caso con dos puntos / símbolos: m:ss.mmm  o  m:ss:mmm  o  ss.mmm
  const parts = raw.split(/[:.,\s]+/).filter(Boolean);

  if (parts.length === 0) return null;

  // Solo dígitos en un único bloque -> asumimos milisegundos totales.
  if (parts.length === 1) {
    if (!/^\d+$/.test(parts[0])) return null;
    return parseInt(parts[0], 10);
  }

  // 2 grupos: ss.mmm  (segundos y milésimas)
  if (parts.length === 2) {
    const [s, mmm] = parts;
    if (!/^\d+$/.test(s) || !/^\d+$/.test(mmm)) return null;
    const millis = parseInt(mmm.padEnd(3, '0').slice(0, 3), 10);
    return parseInt(s, 10) * 1000 + millis;
  }

  // 3 grupos: m:ss.mmm
  const [m, s, mmm] = parts;
  if (![m, s, mmm].every((p) => /^\d+$/.test(p))) return null;
  const seconds = parseInt(s, 10);
  if (seconds > 59) return null;
  const millis = parseInt(mmm.padEnd(3, '0').slice(0, 3), 10);
  return parseInt(m, 10) * 60_000 + seconds * 1000 + millis;
}

/** Fecha relativa breve en español: "hace 3 d", "hace 2 h", "ahora". */
export function timeAgo(epochMs: number, nowMs: number): string {
  const diff = Math.max(0, nowMs - epochMs);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `hace ${d} d`;
  const mo = Math.floor(d / 30);
  return `hace ${mo} mes${mo > 1 ? 'es' : ''}`;
}
