// "Muro de rivalidad": construye un feed cronológico de la actividad de la liga
// a partir de las vueltas y los piques que ya hay (no escribe nada nuevo).
// Eventos: vuelta marcada, récord batido, "te quitaron el récord", pique nuevo
// y pique ganado.
import { Lap, Challenge } from '../types';
import { recordsByCombo, isCounted } from './leaderboard';
import { formatTime } from './time';

export type FeedTone = 'normal' | 'record' | 'against' | 'win' | 'challenge';

export interface FeedEvent {
  id: string;
  at: number; // epoch ms para ordenar
  icon: string;
  text: string; // línea principal
  sub?: string; // coche · circuito · etc.
  tone: FeedTone;
}

const MAX = 60;

export function buildFeed(
  laps: Lap[],
  challenges: Challenge[],
  userId: string | null
): FeedEvent[] {
  const events: FeedEvent[] = [];

  // Récord actual por combo coche+circuito → id de la vuelta récord.
  const recordLapIds = new Set(recordsByCombo(laps).map((r) => r.lap.id));

  // ¿En qué combos tengo yo alguna vuelta? (para detectar "te quitaron el récord")
  const myCombos = new Set<string>();
  if (userId) {
    for (const l of laps) {
      if (isCounted(l) && l.userId === userId) myCombos.add(`${l.car}|${l.track}`);
    }
  }

  for (const l of laps) {
    if (!isCounted(l)) continue;
    const mine = l.userId === userId;
    const isRecord = recordLapIds.has(l.id);
    const combo = `${l.car}|${l.track}`;
    const sub = `🚗 ${l.car} · 📍 ${l.track}`;
    const who = l.driverName || 'Anónimo';

    if (isRecord && !mine && myCombos.has(combo)) {
      // Alguien tiene el récord de un combo donde yo también ruedo: pique directo.
      events.push({
        id: `lap-${l.id}`,
        at: l.createdAt,
        icon: '🔥',
        text: `${who} manda en este combo · ${formatTime(l.timeMs)}`,
        sub: `${sub} · ¡a por él!`,
        tone: 'against',
      });
    } else if (isRecord) {
      events.push({
        id: `lap-${l.id}`,
        at: l.createdAt,
        icon: '👑',
        text: `${mine ? 'Batiste' : `${who} batió`} el récord · ${formatTime(l.timeMs)}`,
        sub,
        tone: mine ? 'win' : 'record',
      });
    } else {
      events.push({
        id: `lap-${l.id}`,
        at: l.createdAt,
        icon: '🏁',
        text: `${mine ? 'Marcaste' : `${who} marcó`} ${formatTime(l.timeMs)}`,
        sub,
        tone: 'normal',
      });
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
        sub: `🚗 ${c.car} · 📍 ${c.track}`,
        tone: 'win',
      });
    } else {
      events.push({
        id: `chnew-${c.id}`,
        at: c.createdAt,
        icon: '🎰',
        text: `Nuevo pique: ${c.car}`,
        sub: `📍 ${c.track} · por ${c.createdByName || 'alguien'}`,
        tone: 'challenge',
      });
    }
  }

  events.sort((a, b) => b.at - a.at);
  return events.slice(0, MAX);
}
