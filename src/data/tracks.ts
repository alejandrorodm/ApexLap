// Catálogo de circuitos del Assetto Corsa BASE (vanilla, sin packs DLC de pago).
// Cada circuito puede tener varios trazados (layouts).
// Nota: el Nürburgring Nordschleife / 24h es Dream Pack 1 (DLC), por eso no está.

export interface Track {
  name: string;
  layouts: string[];
}

export const TRACKS: Track[] = [
  { name: 'Monza', layouts: ['GP', 'Junior', '1966 (sin chicanes)'] },
  { name: 'Spa-Francorchamps', layouts: ['GP'] },
  { name: 'Nürburgring', layouts: ['GP', 'Sprint'] },
  { name: 'Silverstone', layouts: ['GP', 'International', 'National', '1967'] },
  { name: 'Brands Hatch', layouts: ['GP', 'Indy'] },
  { name: 'Barcelona-Catalunya', layouts: ['GP', 'Moto'] },
  { name: 'Red Bull Ring', layouts: ['GP', 'National'] },
  { name: 'Imola', layouts: ['GP'] },
  { name: 'Mugello', layouts: ['GP'] },
  { name: 'Vallelunga', layouts: ['GP', 'Club', 'Sin chicane'] },
  { name: 'Magione', layouts: ['Full'] },
  { name: 'Zandvoort', layouts: ['GP'] },
  { name: 'Laguna Seca', layouts: ['Full'] },
  { name: 'Highlands', layouts: ['Long', 'Short', 'Drift'] },
  { name: 'Black Cat County', layouts: ['Long', 'Short'] },
  { name: 'Trento-Bondone', layouts: ['Hillclimb'] },
  { name: 'Drift', layouts: ['Track'] },
  { name: 'Fiorano', layouts: ['Full'] },
];

// Nombre legible "Circuito · Trazado" para mostrar y guardar.
export function trackLabel(name: string, layout: string): string {
  return `${name} · ${layout}`;
}

// Lista plana de todas las combinaciones circuito+trazado, ordenada.
export const ALL_TRACKS: string[] = TRACKS.flatMap((t) =>
  t.layouts.map((l) => trackLabel(t.name, l))
).sort((a, b) => a.localeCompare(b));
