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

// ── Modo temporada: puntos F1 por posición en cada pique cerrado ─────────────

// Puntos por posición (1º…10º), estilo F1. A partir del 11º, 0 puntos.
export const SEASON_POINTS = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];

export interface SeasonResult {
  userId: string;
  driverName: string;
  timeMs: number;
  pos: number; // 1-based
  points: number;
}

export interface SeasonEvent {
  challenge: Challenge;
  results: SeasonResult[]; // orden de llegada (mejor vuelta por piloto)
}

export interface SeasonRow {
  userId: string;
  driverName: string;
  points: number;
  events: number; // eventos puntuados
  wins: number; // veces 1º
  podiums: number; // veces top-3
}

/**
 * Temporada: trata cada pique CERRADO como un evento y reparte puntos F1 según
 * el orden de llegada (mejor vuelta de cada piloto en ese pique). Devuelve los
 * eventos (con su orden) y la clasificación acumulada de la temporada.
 */
export function season(
  laps: Lap[],
  challenges: Challenge[]
): { events: SeasonEvent[]; table: SeasonRow[] } {
  const closed = challenges
    .filter((c) => c.status === 'closed' && c.winnerId)
    .sort((a, b) => (a.resolvedAt ?? a.createdAt) - (b.resolvedAt ?? b.createdAt));

  const rows = new Map<string, SeasonRow>();
  const events: SeasonEvent[] = [];

  for (const c of closed) {
    const order = bestPerDriver(lapsForChallenge(laps, c.id));
    if (order.length === 0) continue;
    const results: SeasonResult[] = order.map((l, i) => ({
      userId: l.userId,
      driverName: l.driverName,
      timeMs: l.timeMs,
      pos: i + 1,
      points: SEASON_POINTS[i] ?? 0,
    }));
    events.push({ challenge: c, results });

    for (const r of results) {
      let row = rows.get(r.userId);
      if (!row) {
        row = { userId: r.userId, driverName: r.driverName, points: 0, events: 0, wins: 0, podiums: 0 };
        rows.set(r.userId, row);
      }
      row.driverName = r.driverName;
      row.points += r.points;
      row.events += 1;
      if (r.pos === 1) row.wins += 1;
      if (r.pos <= 3) row.podiums += 1;
    }
  }

  const table = [...rows.values()].sort(
    (a, b) => b.points - a.points || b.wins - a.wins || b.podiums - a.podiums
  );
  // Los eventos más recientes primero para la lista.
  events.reverse();
  return { events, table };
}

// ── Ranking de habilidad (ELO) ───────────────────────────────────────────────

export interface EloRow {
  userId: string;
  driverName: string;
  elo: number;
  events: number; // piques disputados
  wins: number; // piques ganados
}

/**
 * Ranking de HABILIDAD por ELO multijugador. Cada pique cerrado es un "match":
 * se enfrenta a cada piloto contra todos los demás del pique (ganas ELO si
 * superas a alguien mejor, pierdes si te gana alguien peor). Todos parten de
 * 1000. Procesa los piques en orden cronológico.
 */
export function eloTable(laps: Lap[], challenges: Challenge[]): EloRow[] {
  const closed = challenges
    .filter((c) => c.status === 'closed' && c.winnerId)
    .sort((a, b) => (a.resolvedAt ?? a.createdAt) - (b.resolvedAt ?? b.createdAt));

  const K = 32;
  const R = new Map<string, number>();
  const names = new Map<string, string>();
  const events = new Map<string, number>();
  const wins = new Map<string, number>();

  for (const c of closed) {
    const order = bestPerDriver(lapsForChallenge(laps, c.id));
    const n = order.length;
    if (n < 2) continue;

    order.forEach((l) => {
      if (!R.has(l.userId)) R.set(l.userId, 1000);
      names.set(l.userId, l.driverName);
      events.set(l.userId, (events.get(l.userId) ?? 0) + 1);
    });
    wins.set(order[0].userId, (wins.get(order[0].userId) ?? 0) + 1);

    // Deltas contra las puntuaciones PREVIAS al evento (se aplican al final).
    const deltas = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const a = order[i].userId;
        const b = order[j].userId;
        const Ea = 1 / (1 + Math.pow(10, (R.get(b)! - R.get(a)!) / 400));
        const Sa = i < j ? 1 : 0; // i llegó por delante de j
        deltas.set(a, (deltas.get(a) ?? 0) + (K * (Sa - Ea)) / (n - 1));
      }
    }
    for (const [u, d] of deltas) R.set(u, R.get(u)! + d);
  }

  const rows: EloRow[] = [];
  for (const [u, elo] of R) {
    rows.push({
      userId: u,
      driverName: names.get(u) ?? 'Piloto',
      elo: Math.round(elo),
      events: events.get(u) ?? 0,
      wins: wins.get(u) ?? 0,
    });
  }
  return rows.sort((a, b) => b.elo - a.elo);
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
