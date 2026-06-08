// Logros y motes de la liga. Se calculan a partir de datos FIABLES (vueltas y
// piques); deliberadamente NO se usan las "ayudas", porque los importadores del
// juego no las capturan bien (siempre llegan como "sin ayudas").
import { Lap, Challenge } from '../types';
import { recordsByCombo, isCounted } from './leaderboard';

export interface DriverAgg {
  userId: string;
  name: string;
  laps: number; // vueltas válidas
  records: number; // récords (combos) que ostenta
  cars: number; // coches distintos
  tracks: number; // circuitos distintos
  wins: number; // piques ganados
  wetLaps: number; // vueltas en mojado
  days: number; // días distintos con actividad
}

/** Agrega métricas por piloto desde las vueltas + los piques cerrados. */
export function aggregateDrivers(
  laps: Lap[],
  challenges: Challenge[]
): DriverAgg[] {
  const recCount = new Map<string, number>();
  for (const r of recordsByCombo(laps)) {
    recCount.set(r.lap.userId, (recCount.get(r.lap.userId) ?? 0) + 1);
  }

  const winCount = new Map<string, number>();
  for (const c of challenges) {
    if (c.status === 'closed' && c.winnerId) {
      winCount.set(c.winnerId, (winCount.get(c.winnerId) ?? 0) + 1);
    }
  }

  interface Acc {
    name: string;
    laps: number;
    cars: Set<string>;
    tracks: Set<string>;
    wet: number;
    days: Set<string>;
  }
  const m = new Map<string, Acc>();
  for (const l of laps) {
    if (!isCounted(l)) continue;
    let a = m.get(l.userId);
    if (!a) {
      a = { name: l.driverName, laps: 0, cars: new Set(), tracks: new Set(), wet: 0, days: new Set() };
      m.set(l.userId, a);
    }
    a.laps += 1;
    if (l.driverName) a.name = l.driverName;
    a.cars.add(l.car);
    a.tracks.add(l.track);
    if (l.conditions === 'wet') a.wet += 1;
    const d = new Date(l.createdAt);
    a.days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const out: DriverAgg[] = [];
  for (const [userId, a] of m) {
    out.push({
      userId,
      name: a.name,
      laps: a.laps,
      records: recCount.get(userId) ?? 0,
      cars: a.cars.size,
      tracks: a.tracks.size,
      wins: winCount.get(userId) ?? 0,
      wetLaps: a.wet,
      days: a.days.size,
    });
  }
  return out;
}

export interface Badge {
  id: string;
  icon: string;
  name: string;
  desc: string;
  value: number; // progreso actual
  target: number; // meta
  unlocked: boolean;
}

/** Logros (desbloqueados o en progreso) de un piloto. */
export function badgesFor(a: DriverAgg): Badge[] {
  const b = (
    id: string,
    icon: string,
    name: string,
    desc: string,
    value: number,
    target: number
  ): Badge => ({ id, icon, name, desc, value, target, unlocked: value >= target });

  return [
    b('debut', '🏁', 'Debutante', 'Tu primera vuelta', a.laps, 1),
    b('rodador', '🔥', 'Rodador', '25 vueltas registradas', a.laps, 25),
    b('maquina', '⚙️', 'Máquina', '100 vueltas registradas', a.laps, 100),
    b('rey', '👑', 'Plusmarquista', 'Ostenta 3 récords a la vez', a.records, 3),
    b('ganador', '🏆', 'Ganador', 'Gana un pique', a.wins, 1),
    b('pistolero', '🔫', 'Pistolero', 'Gana 5 piques', a.wins, 5),
    b('coleccionista', '🚗', 'Coleccionista', 'Rueda 5 coches distintos', a.cars, 5),
    b('trotamundos', '🗺️', 'Trotamundos', 'Rueda 5 circuitos distintos', a.tracks, 5),
    b('mojado', '🌧️', 'Bajo la lluvia', '5 vueltas en mojado', a.wetLaps, 5),
    b('constante', '📅', 'Constante', 'Rueda en 3 días distintos', a.days, 3),
  ];
}

export interface Mote {
  icon: string;
  title: string;
}

// Motes comparativos (uno por categoría, en orden de prestigio). El piloto
// recibe el de MAYOR prestigio en el que lidera la liga.
const MOTE_DEFS: { key: keyof DriverAgg; icon: string; title: string }[] = [
  { key: 'records', icon: '👑', title: 'Dominador' },
  { key: 'wins', icon: '🏆', title: 'Campeón de piques' },
  { key: 'wetLaps', icon: '🌧️', title: 'Rey del mojado' },
  { key: 'laps', icon: '🔥', title: 'Incansable' },
  { key: 'tracks', icon: '🗺️', title: 'Trotamundos' },
  { key: 'cars', icon: '🚗', title: 'Coleccionista' },
];

/** Asigna a cada piloto su mote (el de más prestigio que lidera). Puede no haber. */
export function motesByDriver(aggs: DriverAgg[]): Map<string, Mote> {
  const res = new Map<string, Mote>();
  for (const def of MOTE_DEFS) {
    let max = 0;
    for (const a of aggs) max = Math.max(max, a[def.key] as number);
    if (max <= 0) continue;
    for (const a of aggs) {
      if ((a[def.key] as number) === max && !res.has(a.userId)) {
        res.set(a.userId, { icon: def.icon, title: def.title });
      }
    }
  }
  return res;
}
