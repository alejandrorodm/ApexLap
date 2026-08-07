// "Muro de rivalidad": construye un feed cronológico de la actividad de la liga
// a partir de las vueltas y los piques que ya hay (no escribe nada nuevo).
// Eventos: vuelta marcada, mejor marca personal, récord batido (con a quién se
// lo quitó y por cuánto), "te quitaron el récord", pique nuevo y pique ganado.
import { Lap, Challenge } from '../types';
import { isCounted } from './leaderboard';
import { formatTime, formatDelta } from './time';

export type FeedTone = 'normal' | 'record' | 'against' | 'win' | 'challenge';

export interface FeedEvent {
  id: string;
  at: number; // epoch ms para ordenar
  icon: string;
  text: string; // línea principal
  sub?: string; // coche · circuito · etc.
  tone: FeedTone;
  // Destino al pulsar la fila. Sin esto el muro es un callejón sin salida.
  track?: string;
  car?: string;
  challengeId?: string;
}

const MAX = 60;

export function buildFeed(
  laps: Lap[],
  challenges: Challenge[],
  userId: string | null
): FeedEvent[] {
  const events: FeedEvent[] = [];

  // Las vueltas se recorren por combo y en orden cronológico, llevando la mejor
  // marca vigente en cada momento. Así "batió el récord" significa que lo batió
  // ENTONCES (y sabemos a quién se lo quitó), no que la vuelta sea la mejor hoy.
  const byCombo = new Map<string, Lap[]>();
  for (const l of laps) {
    if (!isCounted(l)) continue;
    const key = `${l.car}|${l.track}`;
    const arr = byCombo.get(key);
    if (arr) arr.push(l);
    else byCombo.set(key, [l]);
  }

  for (const comboLaps of byCombo.values()) {
    const chrono = [...comboLaps].sort((a, b) => a.createdAt - b.createdAt);
    let best: Lap | null = null; // récord vigente del combo
    const bestByDriver = new Map<string, Lap>(); // mejor marca vigente de cada piloto

    for (const l of chrono) {
      const mine = l.userId === userId;
      const who = l.driverName || 'Anónimo';
      const sub = `🚗 ${l.car} · ${l.track}`;
      const prevBest = best;
      const prevMine = bestByDriver.get(l.userId) ?? null;

      const isRecord = !prevBest || l.timeMs < prevBest.timeMs;
      const isPB = !!prevMine && l.timeMs < prevMine.timeMs;

      const base = {
        id: `lap-${l.id}`,
        at: l.createdAt,
        track: l.track,
        car: l.car,
        challengeId: l.challengeId,
      };

      if (isRecord && prevBest && prevBest.userId === userId && !mine) {
        // El evento que más pica: te acaban de quitar el récord.
        events.push({
          ...base,
          icon: '🔥',
          text: `${who} te quitó el récord · ${formatTime(l.timeMs)}`,
          sub: `${sub} · ${formatDelta(l.timeMs, prevBest.timeMs)} · ¡a por él!`,
          tone: 'against',
        });
      } else if (isRecord && prevBest) {
        const victim = prevBest.driverName || 'Anónimo';
        events.push({
          ...base,
          icon: '👑',
          text: `${mine ? 'Batiste' : `${who} batió`} el récord · ${formatTime(l.timeMs)}`,
          sub: `${sub} · le quitó ${formatDelta(l.timeMs, prevBest.timeMs).replace('-', '')} a ${victim}`,
          tone: mine ? 'win' : 'record',
        });
      } else if (isRecord) {
        events.push({
          ...base,
          icon: '🏁',
          text: `${mine ? 'Estrenaste' : `${who} estrenó`} el combo · ${formatTime(l.timeMs)}`,
          sub,
          tone: mine ? 'win' : 'normal',
        });
      } else if (isPB) {
        events.push({
          ...base,
          icon: '⚡',
          text: `${mine ? 'Mejoraste tu marca' : `${who} mejoró su marca`} · ${formatTime(l.timeMs)}`,
          sub: `${sub} · ${formatDelta(l.timeMs, prevMine!.timeMs)}`,
          tone: mine ? 'win' : 'normal',
        });
      } else {
        events.push({
          ...base,
          icon: '🏁',
          text: `${mine ? 'Marcaste' : `${who} marcó`} ${formatTime(l.timeMs)}`,
          sub,
          tone: 'normal',
        });
      }

      if (isRecord) best = l;
      if (!prevMine || l.timeMs < prevMine.timeMs) bestByDriver.set(l.userId, l);
    }
  }

  for (const c of challenges) {
    if (c.status === 'closed' && c.winnerId) {
      events.push({
        id: `chwon-${c.id}`,
        at: c.resolvedAt ?? c.createdAt,
        icon: '🏆',
        text: `${c.winnerName || 'Alguien'} ganó el pique${
          c.winnerTimeMs ? ` · ${formatTime(c.winnerTimeMs)}` : ''
        }`,
        sub: `🚗 ${c.car} · ${c.track}`,
        tone: 'win',
        challengeId: c.id,
        track: c.track,
        car: c.car,
      });
    } else {
      events.push({
        id: `chnew-${c.id}`,
        at: c.createdAt,
        icon: '🎰',
        text: `Nuevo pique: ${c.car}`,
        sub: `${c.track} · por ${c.createdByName || 'alguien'}`,
        tone: 'challenge',
        challengeId: c.id,
        track: c.track,
        car: c.car,
      });
    }
  }

  events.sort((a, b) => b.at - a.at);
  return events.slice(0, MAX);
}
