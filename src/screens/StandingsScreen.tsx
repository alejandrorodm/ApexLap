// "Liga": clasificación por puntos (piques ganados + apuestas acertadas) y
// lista de piques (abiertos y cerrados) para entrar al detalle y apostar.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font, PODIUM } from '../theme';
import { Card, EmptyState, ScreenHeader } from '../components/ui';
import { useIsWideWeb } from '../responsive';
import { useApp } from '../context/AppContext';
import { subscribeChallenges, getChallengeBets } from '../firebase/db';
import {
  standings,
  ChallengeResult,
  POINTS,
} from '../utils/leaderboard';
import { aggregateDrivers, motesByDriver } from '../utils/achievements';
import { formatTime, timeAgo } from '../utils/time';
import { Challenge, Bet } from '../types';
import { RootStackParamList } from '../navigation/types';

const COND_ICON: Record<string, string> = { dry: '☀', wet: '🌧', mixed: '🌦' };
const MEDAL = ['🥇', '🥈', '🥉'];

export default function StandingsScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { league, userId, laps } = useApp();
  const wide = useIsWideWeb();
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [betsByChallenge, setBetsByChallenge] = useState<Record<string, Bet[]>>(
    {}
  );
  const now = Date.now();

  // Trae bastantes piques para que la clasificación histórica sea fiel.
  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {}, 200);
  }, [league?.id]);

  const closed = useMemo(
    () => challenges.filter((c) => c.status === 'closed' && c.winnerId),
    [challenges]
  );
  const open = useMemo(
    () => challenges.filter((c) => c.status !== 'closed'),
    [challenges]
  );

  // Carga las apuestas de cada pique cerrado (para puntuar los aciertos).
  const closedIds = closed.map((c) => c.id).join(',');
  useEffect(() => {
    if (!league || closed.length === 0) {
      setBetsByChallenge({});
      return;
    }
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        closed.map(async (c) => {
          try {
            return [c.id, await getChallengeBets(league.id, c.id)] as const;
          } catch {
            return [c.id, [] as Bet[]] as const;
          }
        })
      );
      if (!cancelled) setBetsByChallenge(Object.fromEntries(entries));
    })();
    return () => {
      cancelled = true;
    };
  }, [league?.id, closedIds]);

  const table = useMemo(() => {
    const results: ChallengeResult[] = closed.map((c) => ({
      challenge: c,
      bets: betsByChallenge[c.id] ?? [],
    }));
    return standings(results);
  }, [closed, betsByChallenge]);

  // Mote de cada piloto (comparativo en la liga) para mostrarlo junto al nombre.
  const motes = useMemo(
    () => motesByDriver(aggregateDrivers(laps, challenges)),
    [laps, challenges]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <ScreenHeader title="Liga" subtitle={league?.name ?? ''} />

        <Pressable
          style={styles.seasonBtn}
          onPress={() => navigation.navigate('Season')}
        >
          <Text style={styles.seasonBtnText}>🏆 Temporada · puntos F1 por evento ›</Text>
        </Pressable>

        {table.length > 0 ? (
          <Podium rows={table.slice(0, 3)} userId={userId} />
        ) : null}

        <View style={wide ? styles.cols : undefined}>
          <View style={wide ? styles.colMain : undefined}>
            <Text style={styles.sectionTitle}>🏆 Clasificación por puntos</Text>
            <Card>
          <Text style={styles.legend}>
            +{POINTS.win} por pique ganado · +{POINTS.correctBet} por acertar la
            apuesta
          </Text>
          {table.length === 0 ? (
            <Text style={styles.hint}>
              Aún no hay puntos. Cierra un pique (en su detalle) para repartirlos.
            </Text>
          ) : (
            <>
              <View style={styles.headerRow}>
                <Text style={[styles.hCell, styles.posCol]}>#</Text>
                <Text style={[styles.hCell, { flex: 1 }]}>Piloto</Text>
                <Text style={[styles.hCell, styles.numCol]}>🏆</Text>
                <Text style={[styles.hCell, styles.numCol]}>🎯</Text>
                <Text style={[styles.hCell, styles.ptsCol]}>Pts</Text>
              </View>
              {table.map((r, i) => {
                const mine = r.userId === userId;
                return (
                  <View
                    key={r.userId}
                    style={[
                      styles.row,
                      i < 3 && styles.rowTop,
                      mine && styles.rowMine,
                    ]}
                  >
                    <Text
                      style={[styles.posCol, styles.pos, i < 3 && styles.posMedal]}
                    >
                      {MEDAL[i] ?? `P${i + 1}`}
                    </Text>
                    <Text
                      style={[styles.name, { flex: 1 }, mine && styles.nameMine]}
                      numberOfLines={1}
                    >
                      {motes.get(r.userId) ? `${motes.get(r.userId)!.icon} ` : ''}
                      {r.driverName}
                      {mine ? ' · tú' : ''}
                    </Text>
                    <Text style={[styles.numCol, styles.cell]}>{r.wins}</Text>
                    <Text style={[styles.numCol, styles.cell]}>
                      {r.correctBets}
                    </Text>
                    <Text style={[styles.ptsCol, styles.pts]}>{r.points}</Text>
                  </View>
                );
              })}
            </>
          )}
            </Card>
          </View>

          <View style={wide ? styles.colSide : undefined}>
            <Text style={styles.sectionTitle}>🎰 Piques abiertos ({open.length})</Text>
        {open.length === 0 ? (
          <Text style={styles.hint}>
            Ninguno. Ve a la Ruleta y convoca uno para apostar.
          </Text>
        ) : (
          open.map((c) => (
            <ChallengeRow
              key={c.id}
              c={c}
              now={now}
              onPress={() =>
                navigation.navigate('Challenge', { challengeId: c.id })
              }
            />
          ))
        )}

        {closed.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>
              ✅ Piques cerrados ({closed.length})
            </Text>
            {closed.map((c) => (
              <ChallengeRow
                key={c.id}
                c={c}
                now={now}
                onPress={() =>
                  navigation.navigate('Challenge', { challengeId: c.id })
                }
              />
            ))}
          </>
        ) : null}

            {challenges.length === 0 ? (
              <EmptyState
                icon="🏆"
                title="Sin piques todavía"
                subtitle="Convoca uno en la Ruleta, apostad por el ganador y repartid puntos."
              />
            ) : null}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChallengeRow({
  c,
  now,
  onPress,
}: {
  c: Challenge;
  now: number;
  onPress: () => void;
}) {
  const closed = c.status === 'closed';
  return (
    <Pressable
      style={[styles.chRow, closed && styles.chRowClosed]}
      onPress={onPress}
      {...({ dataSet: { anim: 'rise' } } as any)}
    >
      <View style={{ flex: 1 }}>
        <View style={styles.chTitleRow}>
          {!closed ? (
            <View
              style={styles.liveDot}
              {...({ dataSet: { anim: 'blink' } } as any)}
            />
          ) : null}
          <Text style={styles.chTitle} numberOfLines={1}>
            {COND_ICON[c.conditions]} {c.car}
          </Text>
        </View>
        <Text style={styles.chTrack} numberOfLines={1}>
          {c.track}
        </Text>
        <Text style={styles.chMeta}>
          {closed && c.winnerName
            ? `🏆 ${c.winnerName}`
            : `por ${c.createdByName} · ${timeAgo(c.createdAt, now)}`}
        </Text>
      </View>
      <Text style={styles.chCta}>{closed ? 'Ver ›' : 'Apostar ›'}</Text>
    </Pressable>
  );
}

// Podio: top-3 de la clasificación en tarjetas grandes (oro/plata/bronce).
function Podium({
  rows,
  userId,
}: {
  rows: { userId: string; driverName: string; points: number; wins: number; correctBets: number }[];
  userId: string | null;
}) {
  return (
    <View style={styles.podium}>
      {rows.map((r, i) => (
        <View
          key={r.userId}
          style={[
            styles.podCard,
            { borderTopColor: PODIUM[i] },
            r.userId === userId && styles.podMine,
          ]}
          {...({ dataSet: { anim: 'rise' } } as any)}
        >
          <Text style={styles.podMedal}>{MEDAL[i]}</Text>
          <Text style={[styles.podName, { color: PODIUM[i] }]} numberOfLines={1}>
            {r.driverName}
            {r.userId === userId ? ' · tú' : ''}
          </Text>
          <Text style={styles.podPts}>
            {r.points}
            <Text style={styles.podPtsUnit}> pts</Text>
          </Text>
          <Text style={styles.podSub}>
            🏆 {r.wins} · 🎯 {r.correctBets}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  cols: { flexDirection: 'row', gap: spacing.xl, alignItems: 'flex-start' },
  colMain: { flex: 1.3 },
  colSide: { flex: 1 },
  podium: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  podCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderTopWidth: 4,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    alignItems: 'center',
  },
  podMine: { backgroundColor: 'rgba(255,30,20,0.08)' },
  podMedal: { fontSize: 30 },
  podName: {
    fontSize: 14,
    fontWeight: '900',
    fontFamily: font.display,
    marginTop: spacing.xs,
    maxWidth: '100%',
  },
  podPts: {
    color: colors.accent,
    fontSize: 30,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  podPtsUnit: { color: colors.textDim, fontSize: 12, fontWeight: '800' },
  podSub: { color: colors.textFaint, fontSize: 12, fontWeight: '700', marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  seasonBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  seasonBtnText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0.4,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  legend: { color: colors.textFaint, fontSize: 13, marginBottom: spacing.md },
  hint: { color: colors.textFaint, fontSize: 14, lineHeight: 20 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hCell: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    marginHorizontal: -spacing.sm,
    borderRadius: radius.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { backgroundColor: 'rgba(255,214,10,0.06)' },
  rowMine: {
    backgroundColor: 'rgba(255,30,20,0.10)',
    borderBottomColor: colors.primaryDim,
  },
  posCol: { width: 44 },
  numCol: { width: 40, textAlign: 'center' },
  ptsCol: { width: 60, textAlign: 'right' },
  pos: {
    color: colors.textDim,
    fontWeight: '900',
    fontSize: 17,
    fontFamily: font.display,
  },
  posMedal: { fontSize: 24 },
  name: { color: colors.text, fontSize: 18, fontWeight: '800' },
  nameMine: { color: colors.primary, fontWeight: '900' },
  cell: { color: colors.textDim, fontSize: 16, fontWeight: '700' },
  pts: {
    color: colors.accent,
    fontSize: 25,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
  },
  chRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  chRowClosed: { borderLeftColor: colors.border },
  chTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  chTitle: { color: colors.text, fontSize: 17, fontWeight: '900', flex: 1 },
  chTrack: { color: colors.textDim, fontSize: 14, marginTop: 2, fontWeight: '600' },
  chMeta: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
  chCta: { color: colors.accent, fontWeight: '900', fontSize: 14 },
});
