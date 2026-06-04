// Catálogo de coches del Assetto Corsa BASE (vanilla, v1.x + actualizaciones
// gratuitas) — SIN packs DLC de pago (Dream Pack 1/2/3, Japanese, Red, Tripl3,
// Porsche Packs, Ready to Race). Por eso aquí NO hay Porsche, RUF, Nissan GT-R,
// McLaren F1 GTR, Lamborghini, Ford GT40, Maserati, monoplazas modernos, etc.
// La app permite añadir coches personalizados a mano (mods o DLC) en el selector.

export interface CarGroup {
  category: string;
  cars: string[];
}

export const CAR_GROUPS: CarGroup[] = [
  {
    category: 'Calle / Road',
    cars: [
      'Abarth 500 EsseEsse',
      'Abarth 500 EsseEsse Step 1',
      'Alfa Romeo Giulietta QV',
      'Alfa Romeo MiTo QV',
      'Audi R8 V10 plus',
      'BMW 1M',
      'BMW 1M Stage 3',
      'BMW M3 E92',
      'BMW Z4',
      'Ferrari 458 Italia',
      'Ferrari F40',
      'KTM X-Bow R',
      'Lotus Elise SC',
      'Lotus Evora S',
      'Lotus Exige S',
      'Lotus Exige S Roadster',
      'McLaren MP4-12C',
      'Mercedes-Benz SLS AMG',
      'Shelby Cobra 427 S/C',
      'Toyota GT86',
    ],
  },
  {
    category: 'Hypercars',
    cars: [
      'Ferrari LaFerrari',
      'Ferrari 599XX EVO',
      'McLaren P1',
      'Pagani Huayra',
      'Pagani Zonda R',
    ],
  },
  {
    category: 'GT (carreras)',
    cars: [
      'BMW M3 GT2',
      'BMW Z4 GT3',
      'Ferrari 458 Italia GT2',
      'Lotus Evora GTC',
      'Lotus Evora GTE',
      'McLaren MP4-12C GT3',
      'Mercedes-Benz SLS AMG GT3',
    ],
  },
  {
    category: 'Track Day / Sport',
    cars: [
      'Lotus 2-Eleven',
      'Lotus 2-Eleven GT4',
      'Lotus Evora GX',
      'Lotus Evora GT4',
      'Lotus Exige 240R',
      'Lotus Exige Scura',
      'Lotus Exige V6 Cup',
    ],
  },
  {
    category: 'Clásicos',
    cars: [
      'BMW M3 E30',
      'BMW M3 E30 Group A',
      'BMW M3 E30 Drift',
      'Classic Team Lotus Type 49',
      'Lotus 98T',
    ],
  },
  {
    category: 'Fórmula / Open Wheel',
    cars: [
      'Lotus Exos 125',
      'Lotus Exos 125 S1',
      'Tatuus FA01 (Formula Abarth)',
    ],
  },
];

// Lista plana, sin duplicados, ordenada — útil para buscadores.
export const ALL_CARS: string[] = Array.from(
  new Set(CAR_GROUPS.flatMap((g) => g.cars))
).sort((a, b) => a.localeCompare(b));
