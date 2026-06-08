// Cálculos de ranking, récords y estadísticas a partir de las vueltas.
import { Lap, Challenge, Bet } from '../types';

// Puntos de la liga.
export const POINTS = {
  win: 10, // ganar un pique (mejor vuelta válida)
  correctBet: 5, // acertar quién ganaría el pique
};

/**
 * Una vuelta cuenta para clasificación/récords/estadísticas si está verificada.
 * Las vueltas antiguas (sin `status`) también cuentan; solo se excluyen las
 * 'pending' (a la espera del anfitrión) y las 'rejected'.
 */
export function isCounted(l: Lap): boolean {
  return l.status == null || l.status === 'verified';
}

export interface LapFilter {
  car?: string;
  track?: string;
  conditions?: Lap['conditions'];
  noAssists?: boolean; // solo vueltas sin ayudas
}

export function applyFilter(laps: Lap[], f: LapFilter): Lap[] {
  return laps.filter((l) => {
    if (f.car && l.car !== f.car) return false;
    if (f.track && l.track !== f.track) return false;
    if (f.conditions && l.conditions !== f.conditions) return false;
    if (f.noAssists && l.assists) return false;
    return true;
  });
}

/** Ordena por tiempo ascendente (más rápida primero). */
export function byTime(laps: Lap[]): Lap[] {
  return [...laps].sort((a, b) => a.timeMs - b.timeMs);
}

/** Deja solo la mejor vuelta de cada piloto dentro del conjunto dado. */
export function bestPerDriver(laps: Lap[]): Lap[] {
  const best = new Map<string, Lap>();
  for (const l of laps.filter(isCounted)) {
    const cur = best.get(l.userId);
    if (!cur || l.timeMs < cur.timeMs) best.set(l.userId, l);
  }
  return byTime([...best.values()]);
}

export interface Record {
  key: string; // "car|track"
  car: string;
  track: string;
  lap: Lap; // vuelta récord
  count: number; // nº de vueltas registradas en ese combo
}

export interface TrackRecord {
  track: string;
  lap: Lap; // mejor vuelta absoluta del trazado
  count: number; // total de vueltas registradas en él
}

/**
 * Récord absoluto por circuito (una fila por trazado, la vuelta más rápida
 * registrada ahí con cualquier coche). Vista por defecto de "Tiempos": un
 * tiempo solo se entiende dentro de su circuito, comparar tiempos entre
 * Nürburgring y Brands Hatch no tiene sentido.
 *
 * Orden por relevancia: pistas con más vueltas registradas primero (es donde
 * hay pique). El nombre alfabético solo rompe empates.
 */
export function recordsByTrack(laps: Lap[]): TrackRecord[] {
  const map = new Map<string, TrackRecord>();
  for (const l of laps.filter(isCounted)) {
    const cur = map.get(l.track);
    if (!cur) {
      map.set(l.track, { track: l.track, lap: l, count: 1 });
    } else {
      cur.count += 1;
      if (l.timeMs < cur.lap.timeMs) cur.lap = l;
    }
  }
  return [...map.values()].sort(
    (a, b) => b.count - a.count || a.track.localeCompare(b.track)
  );
}

/** Todas las vueltas válidas registradas en un circuito, ordenadas por tiempo. */
export function lapsForTrack(laps: Lap[], track: string): Lap[] {
  return byTime(laps.filter((l) => isCounted(l) && l.track === track));
}

export interface CarRecord {
  car: string;
  lap: Lap; // mejor vuelta de ese coche en el circuito
  count: number; // nº de vueltas registradas con ese coche aquí
}

/**
 * Mejor vuelta por coche dentro de un circuito concreto, ordenado de más
 * rápido a más lento. Sirve para la vista por defecto del detalle de circuito:
 * de un vistazo, en qué tiempo ronda cada coche en esa pista. Comparar coches
 * distintos no es del todo justo, pero ayuda a hacerse una idea.
 */
export function bestPerCarOnTrack(laps: Lap[], track: string): CarRecord[] {
  const map = new Map<string, CarRecord>();
  for (const l of laps) {
    if (!isCounted(l) || l.track !== track) continue;
    const cur = map.get(l.car);
    if (!cur) {
      map.set(l.car, { car: l.car, lap: l, count: 1 });
    } else {
      cur.count += 1;
      if (l.timeMs < cur.lap.timeMs) cur.lap = l;
    }
  }
  return [...map.values()].sort(
    (a, b) => a.lap.timeMs - b.lap.timeMs || a.car.localeCompare(b.car)
  );
}

export interface TheoreticalBest {
  timeMs: number; // suma de los mejores sectores (tiempo ideal alcanzable)
  sectors: number[]; // mejor tiempo de cada sector
  sources: string[]; // piloto dueño de cada mejor sector
  realBestMs: number; // mejor vuelta REAL del conjunto (para el delta)
  fromLaps: number; // nº de vueltas (con sectores) que han contribuido
}

/**
 * Vuelta teórica: combina el MEJOR tiempo de cada sector entre un conjunto de
 * vueltas para dar el tiempo ideal alcanzable. Pensada para un mismo coche en un
 * mismo trazado (los sectores no son comparables entre coches/pistas distintas).
 *
 * Toma como referencia el nº de sectores de la vuelta más rápida y solo combina
 * vueltas con ESE nº de sectores (mezclar trazados con distinto nº de sectores
 * daría tiempos sin sentido). Devuelve null si no hay datos con sectores.
 */
export function theoreticalBest(laps: Lap[]): TheoreticalBest | null {
  const withSectors = laps.filter(
    (l) => isCounted(l) && l.sectors && l.sectors.length >= 2
  );
  if (withSectors.length === 0) return null;

  const sorted = byTime(withSectors);
  const n = sorted[0].sectors!.length;
  const eligible = sorted.filter((l) => l.sectors!.length === n);

  const best = new Array<number>(n).fill(Infinity);
  const sources = new Array<string>(n).fill('');
  for (const l of eligible) {
    l.sectors!.forEach((s, i) => {
      if (s < best[i]) {
        best[i] = s;
        sources[i] = l.driverName || 'Anónimo';
      }
    });
  }
  if (best.some((s) => !Number.isFinite(s))) return null;

  const timeMs = best.reduce((a, b) => a + b, 0);
  return {
    timeMs,
    sectors: best,
    sources,
    realBestMs: eligible[0].timeMs,
    fromLaps: eligible.length,
  };
}

export interface ProgressPoint {
  lap: Lap;
  at: number; // epoch ms
  timeMs: number;
  isPB: boolean; // marcó un nuevo mejor tiempo (PB) en ese momento
  runningBest: number; // mejor tiempo acumulado hasta este punto (incl.)
}

export interface ProgressCombo {
  key: string; // "car|track"
  car: string;
  track: string;
  count: number;
  points: ProgressPoint[]; // cronológico (más antiguo primero)
  pb: number; // mejor tiempo absoluto del combo
  first: number; // primer tiempo registrado
}

/**
 * Progresión de UN piloto por combinación coche+circuito a lo largo del tiempo.
 * Solo combos con 2+ vueltas (hace falta historia para ver evolución). Cada
 * punto marca si batió su mejor tiempo (PB) en ese momento. Ordena por actividad.
 */
export function driverProgress(laps: Lap[], userId: string): ProgressCombo[] {
  const byCombo = new Map<string, Lap[]>();
  for (const l of laps) {
    if (!isCounted(l) || l.userId !== userId) continue;
    const key = `${l.car}|${l.track}`;
    const arr = byCombo.get(key);
    if (arr) arr.push(l);
    else byCombo.set(key, [l]);
  }

  const combos: ProgressCombo[] = [];
  for (const [key, ls] of byCombo) {
    if (ls.length < 2) continue;
    const sorted = [...ls].sort((a, b) => a.createdAt - b.createdAt);
    let rb = Infinity;
    const points: ProgressPoint[] = sorted.map((l) => {
      const isPB = l.timeMs < rb;
      if (isPB) rb = l.timeMs;
      return { lap: l, at: l.createdAt, timeMs: l.timeMs, isPB, runningBest: rb };
    });
    combos.push({
      key,
      car: sorted[0].car,
      track: sorted[0].track,
      count: sorted.length,
      points,
      pb: rb,
      first: sorted[0].timeMs,
    });
  }
  return combos.sort(
    (a, b) => b.count - a.count || a.track.localeCompare(b.track)
  );
}

/** Récord (vuelta más rápida) por combinación coche+circuito. */
export function recordsByCombo(laps: Lap[]): Record[] {
  const map = new Map<string, Record>();
  for (const l of laps.filter(isCounted)) {
    const key = `${l.car}|${l.track}`;
    const cur = map.get(key);
    if (!cur) {
      map.set(key, { key, car: l.car, track: l.track, lap: l, count: 1 });
    } else {
      cur.count += 1;
      if (l.timeMs < cur.lap.timeMs) cur.lap = l;
    }
  }
  return [...map.values()].sort(
    (a, b) => a.track.localeCompare(b.track) || a.car.localeCompare(b.car)
  );
}

export interface DriverStats {
  userId: string;
  driverName: string;
  totalLaps: number;
  records: number; // nº de récords (combos) que ostenta
  bestLap?: Lap;
}

/** Estadísticas por piloto, incluyendo cuántos récords ostenta. */
export function driverStats(laps: Lap[]): DriverStats[] {
  const records = recordsByCombo(laps);
  const recordCount = new Map<string, number>();
  for (const r of records) {
    recordCount.set(r.lap.userId, (recordCount.get(r.lap.userId) ?? 0) + 1);
  }

  const map = new Map<string, DriverStats>();
  for (const l of laps.filter(isCounted)) {
    let s = map.get(l.userId);
    if (!s) {
      s = {
        userId: l.userId,
        driverName: l.driverName,
        totalLaps: 0,
        records: recordCount.get(l.userId) ?? 0,
        bestLap: undefined,
      };
      map.set(l.userId, s);
    }
    s.totalLaps += 1;
    s.driverName = l.driverName; // se queda con el nombre más reciente
    if (!s.bestLap || l.timeMs < s.bestLap.timeMs) s.bestLap = l;
  }
  return [...map.values()].sort(
    (a, b) => b.records - a.records || b.totalLaps - a.totalLaps
  );
}

// ── Piques: ganador, puntos y clasificación ─────────────────────────────────

/** Vueltas registradas para un pique concreto. */
export function lapsForChallenge(laps: Lap[], challengeId: string): Lap[] {
  return laps.filter((l) => l.challengeId === challengeId);
}

/** Ganador de un pique = la vuelta más rápida registrada en él (o null si no hay). */
export function challengeWinner(laps: Lap[], challengeId: string): Lap | null {
  const sorted = byTime(lapsForChallenge(laps, challengeId).filter(isCounted));
  return sorted[0] ?? null;
}

export interface ChallengeResult {
  challenge: Challenge;
  bets: Bet[];
}

export interface StandingRow {
  userId: string;
  driverName: string;
  points: number;
  wins: number; // piques ganados
  correctBets: number; // apuestas acertadas
}

/**
 * Clasificación por puntos de la liga. Solo cuentan los piques CERRADOS con
 * ganador fijado: el ganador suma `POINTS.win`; quien acertó la apuesta suma
 * `POINTS.correctBet` (apostar por ti mismo y ganar suma ambas cosas).
 */
export function standings(results: ChallengeResult[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  const row = (userId: string, name: string): StandingRow => {
    let r = map.get(userId);
    if (!r) {
      r = { userId, driverName: name, points: 0, wins: 0, correctBets: 0 };
      map.set(userId, r);
    } else if (name) {
      r.driverName = name; // nos quedamos con el nombre más reciente conocido
    }
    return r;
  };

  for (const { challenge, bets } of results) {
    if (challenge.status !== 'closed' || !challenge.winnerId) continue;

    const winner = row(challenge.winnerId, challenge.winnerName ?? '');
    winner.points += POINTS.win;
    winner.wins += 1;

    for (const b of bets) {
      if (b.predictedUserId === challenge.winnerId) {
        const bettor = row(b.userId, b.userName);
        bettor.points += POINTS.correctBet;
        bettor.correctBets += 1;
      }
    }
  }

  return [...map.values()].sort(
    (a, b) =>
      b.points - a.points || b.wins - a.wins || b.correctBets - a.correctBets
  );
}

/** Valores únicos presentes en las vueltas, para poblar filtros. */
export function uniqueValues(laps: Lap[]): { cars: string[]; tracks: string[] } {
  const cars = new Set<string>();
  const tracks = new Set<string>();
  for (const l of laps) {
    cars.add(l.car);
    tracks.add(l.track);
  }
  return {
    cars: [...cars].sort((a, b) => a.localeCompare(b)),
    tracks: [...tracks].sort((a, b) => a.localeCompare(b)),
  };
}
