import { CatalogEntry } from '../types';

/**
 * Normaliza un nombre de circuito para comparaciones insensibles a prefijos,
 * acentos, mayúsculas, guiones o espacios (ej: "ks_silverstone-gp" -> "silverstonegp").
 */
export function normTrackKey(s: string): string {
  if (!s) return '';
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ks_|^rss_|^tatuus_|^abarth_/, '')
    .replace(/[-_·\s]+/g, '');
}

/**
 * Encuentra el circuito correspondiente en la lista de customTracks de la liga,
 * tolerando variaciones entre nombres técnicos ("ks_silverstone-gp") y bonitos ("Silverstone · GP").
 */
export function findCustomTrack(
  customTracks: CatalogEntry[],
  trackName: string
): CatalogEntry | undefined {
  if (!trackName || !customTracks || !customTracks.length) return undefined;

  // 1. Coincidencia exacta
  const exact = customTracks.find((t) => t.name === trackName);
  if (exact) return exact;

  const key = normTrackKey(trackName);

  // 2. Coincidencia normalizada
  const normMatch = customTracks.find((t) => normTrackKey(t.name) === key);
  if (normMatch) return normMatch;

  // 3. Substring match en ambas direcciones (ej: "monza" vs "Monza GP")
  return customTracks.find((t) => {
    const k = normTrackKey(t.name);
    return (k.length >= 3 && key.length >= 3) && (k.includes(key) || key.includes(k));
  });
}
