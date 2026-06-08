// "Temporada": clasificación F1-style. Cada pique cerrado es un evento que
// reparte puntos por posición (25-18-15…). Tabla acumulada + lista de eventos.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, spacing, radius, font } from '../theme';
import { EmptyState } from '../components/ui';
import { useApp } from '../context/AppContext';
import { subscribeChallenges } from '../firebase/db';
import { season, SEASON_POINTS, SeasonEvent } from '../utils/leaderboard';
import { motesByDriver, aggregateDrivers } from '../utils/achievements';
import { formatTime, timeAgo } from '../utils/time';
import { Challenge } from '../types';
import { RootStackParamList } from '../navigation/types';

const MEDAL = ['🥇', '🥈', '🥉'];

export default function SeasonScreen() {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { league, userId, laps } = useApp();
  const now = Date.now();
  const [challenges, setChallenges] = useState<Challenge[]>([]);

  useEffect(() => {
    if (!league) return;
    return subscribeChallenges(league.id, setChallenges, () => {}, 200);
  }, [league?.id]);

  const { events, table } = useMemo(
    () => season(laps, challenges),
    [laps, challenges]
  );
  const motes = useMemo(
    () => motesByDriver(aggregateDrivers(laps, challenges)),
    [laps, challenges]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <Text style={styles.back}>‹ Volver</Text>
        </Pressable>
        <Text style={styles.title}>🏆 Temporada</Text>
        <Text style={styles.subtitle}>
          Puntos F1 por posición en cada pique · {SEASON_POINTS.slice(0, 3).join('-')}…
        </Text>
      </View>

      {table.length === 0 ? (
        <EmptyState
          icon="🏆"
          title="La temporada aún no ha arrancado"
          subtitle="Cierra piques (en su detalle) y se irán convirtiendo en eventos que reparten puntos."
        />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.challenge.id}
          contentContainerStyle={styles.content}
          ListHeaderComponent={
            <>
              {/* Clasificación de la temporada */}
              <Text style={styles.sectionTitle}>Clasificación</Text>
              <View style={styles.tableHead}>
                <Text style={[styles.posCol, styles.headCell]}>#</Text>
                <Text style={[styles.headCell, { flex: 1 }]}>Piloto</Text>
                <Text style={[styles.numCol, styles.headCell]}>Ev</Text>
                <Text style={[styles.numCol, styles.headCell]}>🥇</Text>
                <Text style={[styles.ptsCol, styles.headCell]}>Pts</Text>
              </View>
              {table.map((r, i) => {
                const mine = r.userId === userId;
                const mote = motes.get(r.userId);
                return (
                  <View
                    key={r.userId}
                    style={[styles.row, i < 3 && styles.rowTop, mine && styles.rowMine]}
                  >
                    <Text style={[styles.posCol, styles.pos, i < 3 && styles.posMedal]}>
                      {MEDAL[i] ?? `P${i + 1}`}
                    </Text>
                    <Text style={[styles.name, { flex: 1 }, mine && styles.nameMine]} numberOfLines={1}>
                      {mote ? `${mote.icon} ` : ''}
                      {r.driverName}
                      {mine ? ' · tú' : ''}
                    </Text>
                    <Text style={[styles.numCol, styles.cell]}>{r.events}</Text>
                    <Text style={[styles.numCol, styles.cell]}>{r.wins}</Text>
                    <Text style={[styles.ptsCol, styles.pts]}>{r.points}</Text>
                  </View>
                );
              })}

              <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>
                Eventos ({events.length})
              </Text>
            </>
          }
          renderItem={({ item }) => <EventCard event={item} now={now} userId={userId} />}
        />
      )}
    </SafeAreaView>
  );
}

function EventCard({
  event,
  now,
  userId,
}: {
  event: SeasonEvent;
  now: number;
  userId: string | null;
}) {
  const { challenge: c, results } = event;
  return (
    <View style={styles.event}>
      <View style={styles.eventHead}>
        <Text style={styles.eventCar} numberOfLines={1}>
          🚗 {c.car}
        </Text>
        <Text style={styles.eventAgo}>{timeAgo(c.resolvedAt ?? c.createdAt, now)}</Text>
      </View>
      <Text style={styles.eventTrack} numberOfLines={1}>
        📍 {c.track}
      </Text>
      {results.slice(0, 3).map((r) => (
        <View key={r.userId} style={styles.eventRow}>
          <Text style={styles.eventMedal}>{MEDAL[r.pos - 1]}</Text>
          <Text
            style={[styles.eventName, r.userId === userId && styles.nameMine]}
            numberOfLines={1}
          >
            {r.driverName}
          </Text>
          <Text style={styles.eventTime}>{formatTime(r.timeMs)}</Text>
          <Text style={styles.eventPts}>+{r.points}</Text>
        </View>
      ))}
      {results.length > 3 ? (
        <Text style={styles.eventMore}>
          +{results.length - 3} pilotos más
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bgScreen },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: { color: colors.primary, fontSize: 15, fontWeight: '700', marginBottom: spacing.xs },
  title: {
    color: colors.text,
    fontSize: 25,
    fontWeight: '900',
    fontFamily: font.display,
    letterSpacing: 0.5,
  },
  subtitle: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingBottom: 6,
  },
  headCell: {
    color: colors.textFaint,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  posCol: { width: 44 },
  numCol: { width: 34, textAlign: 'center' },
  ptsCol: { width: 48, textAlign: 'right' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    marginBottom: spacing.xs,
  },
  rowTop: { backgroundColor: colors.surfaceAlt, borderColor: colors.accentDim },
  rowMine: { borderColor: colors.primary, borderLeftWidth: 3 },
  pos: {
    color: colors.textDim,
    fontSize: 15,
    fontWeight: '900',
    fontFamily: font.display,
  },
  posMedal: { fontSize: 20 },
  name: { color: colors.text, fontSize: 15, fontWeight: '700', marginRight: spacing.xs },
  nameMine: { color: colors.primary },
  cell: { color: colors.textDim, fontSize: 14, fontWeight: '700', fontVariant: ['tabular-nums'] },
  pts: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '900',
    fontFamily: font.display,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  // Eventos
  event: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  eventHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventCar: { color: colors.text, fontSize: 17, fontWeight: '900', flex: 1, marginRight: spacing.sm },
  eventAgo: { color: colors.textFaint, fontSize: 11, fontWeight: '600' },
  eventTrack: { color: colors.textDim, fontSize: 13, fontWeight: '600', marginTop: 2, marginBottom: spacing.sm },
  eventRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  eventMedal: { fontSize: 16, width: 26 },
  eventName: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  eventTime: {
    color: colors.textDim,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginRight: spacing.md,
  },
  eventPts: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    width: 38,
    textAlign: 'right',
  },
  eventMore: { color: colors.textFaint, fontSize: 12, marginTop: 4 },
});
