import { CatalogEntry } from '../types';

/**
 * Extrae tokens alfanuméricos relevantes de un nombre de circuito.
 * E.j. "Drag · Drag1000" -> ["drag", "drag1000"]
 * E.j. "Drag 1000m"      -> ["drag", "1000m"]
 * E.j. "Silverstone - GP" -> ["silverstone", "gp"]
 */
export function getTrackTokens(s: string): string[] {
  if (!s) return [];
  const clean = s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^ks_|^rss_|^tatuus_|^abarth_/, '')
    .replace(/[^a-z0-9]+/g, ' ');

  return clean
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
}

export function normTrackKey(s: string): string {
  if (!s) return '';
  return getTrackTokens(s).join('');
}

/**
 * Encuentra el circuito correspondiente en la lista de customTracks de la liga,
 * tolerando variaciones avanzadas ("Drag · Drag1000" vs "Drag 1000m", "ks_silverstone-gp" vs "Silverstone · GP").
 */
export function findCustomTrack(
  customTracks: CatalogEntry[],
  trackName: string
): CatalogEntry | undefined {
  if (!trackName || !customTracks || !customTracks.length) return undefined;

  // 1. Coincidencia exacta
  const exact = customTracks.find((t) => t.name === trackName);
  if (exact) return exact;

  const targetTokens = getTrackTokens(trackName);
  if (!targetTokens.length) return undefined;

  // 2. Coincidencia normalizada directa
  const targetKey = targetTokens.join('');
  const normMatch = customTracks.find((t) => normTrackKey(t.name) === targetKey);
  if (normMatch) return normMatch;

  // 3. Comparación por extracción de números de distancia/layout (ej: "1000" en Drag1000 y Drag 1000m)
  const extractNumbers = (tokens: string[]) =>
    tokens
      .map((t) => t.match(/\d+/g))
      .filter(Boolean)
      .flat() as string[];

  const targetNums = extractNumbers(targetTokens);

  let bestMatch: CatalogEntry | undefined = undefined;
  let bestScore = 0;

  for (const item of customTracks) {
    const itemTokens = getTrackTokens(item.name);
    if (!itemTokens.length) continue;

    const itemNums = extractNumbers(itemTokens);

    // Si ambos nombres incluyen números (ej: 400m vs 1000m), los números DEBEN coincidir
    if (targetNums.length > 0 && itemNums.length > 0) {
      const numMatch = targetNums.some((tn) => itemNums.includes(tn));
      if (!numMatch) continue;
    }

    // Puntuación de coincidencia de palabras/tokens
    let matches = 0;
    for (const tt of targetTokens) {
      if (
        itemTokens.some(
          (it) => it.includes(tt) || tt.includes(it) || normTrackKey(it) === normTrackKey(tt)
        )
      ) {
        matches++;
      }
    }

    const score = matches / Math.max(targetTokens.length, 1);
    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = item;
    }
  }

  return bestMatch;
}
