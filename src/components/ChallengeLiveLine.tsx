// Cómo va un pique ahora mismo: quién manda y a cuánto estás tú.
// Se pinta igual en Récords y en Liga para que el dato se lea siempre igual.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, radius, font } from '../theme';
import { ChallengeLive } from '../utils/leaderboard';
import { formatTime, formatDelta } from '../utils/time';

export function ChallengeLiveLine({
  live,
  compact,
}: {
  live: ChallengeLive;
  compact?: boolean;
}) {
  const { leader, myBest, myPos, myDeltaMs, entrants } = live;

  if (!leader) {
    return <Text style={styles.empty}>Sin vueltas todavía · sé el primero ›</Text>;
  }

  const leading = myPos === 1;
  return (
    <View style={styles.wrap}>
      <View style={styles.leaderRow}>
        <Text style={styles.medal}>🥇</Text>
        <Text style={[styles.leaderName, compact && styles.leaderNameSm]} numberOfLines={1}>
          {leader.driverName || 'Piloto'}
        </Text>
        <Text style={[styles.leaderTime, compact && styles.leaderTimeSm]}>
          {formatTime(leader.timeMs)}
        </Text>
      </View>

      <View style={styles.meRow}>
        {myBest ? (
          <View style={[styles.deltaPill, leading && styles.deltaPillLeading]}>
            <Text style={[styles.deltaText, leading && styles.deltaTextLeading]}>
              {leading ? 'vas 1º' : `tú ${formatDelta(myBest.timeMs, leader.timeMs)}`}
            </Text>
          </View>
        ) : (
          <View style={[styles.deltaPill, styles.deltaPillOut]}>
            <Text style={[styles.deltaText, styles.deltaTextOut]}>no has rodado</Text>
          </View>
        )}
        <Text style={styles.entrants}>
          {myPos ? `${myPos}º de ${entrants}` : `${entrants} ${entrants === 1 ? 'piloto' : 'pilotos'}`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 6, gap: 4 },
  empty: {
    marginTop: 6,
    color: colors.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  leaderRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  medal: { fontSize: 13 },
  leaderName: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  leaderNameSm: { fontSize: 13 },
  leaderTime: {
    color: colors.accent,
    fontFamily: font.display,
    fontSize: 16,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  leaderTimeSm: { fontSize: 14 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  deltaPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,30,20,0.14)',
  },
  deltaPillLeading: { backgroundColor: 'rgba(57,211,83,0.16)' },
  deltaPillOut: { backgroundColor: colors.surfaceAlt },
  deltaText: {
    color: colors.primary,
    fontFamily: font.display,
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  deltaTextLeading: { color: colors.green },
  deltaTextOut: {
    color: colors.textDim,
    fontFamily: undefined,
    fontSize: 12,
    fontWeight: '700',
  },
  entrants: { color: colors.textDim, fontSize: 12, fontWeight: '600' },
});
